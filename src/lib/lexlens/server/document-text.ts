// LexLens — server-side document text extraction.
//
// Pipeline (never trusts the client):
//   PDF (text layer)  → pdf-parse  → text
//   PDF (scanned)     → vision OCR (document understanding model) → text
//   PNG/JPG/WEBP      → vision OCR → text
//
// Validation: extension + declared MIME + magic bytes + size. Executables and
// anything unexpected are rejected before touching the analysis engine.

import ZAI from "z-ai-web-dev-sdk";

export const MAX_UPLOAD_MB = 10;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export type UploadKind = "pdf" | "png" | "jpg" | "jpeg" | "webp" | null;

export const ACCEPTED_MIMES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export const ACCEPT_MESSAGE =
  "This file type is not supported. Upload PDF, JPG, JPEG, PNG or WEBP.";

/** Detect the real file type from magic bytes — never trust the extension. */
export function detectKind(buf: Buffer, declaredMime: string, filename: string): UploadKind | "rejected" {
  if (buf.length === 0) return "rejected";
  if (buf.length > MAX_UPLOAD_BYTES) return "rejected";

  const magicPdf = buf.subarray(0, 5).toString("latin1") === "%PDF-";
  const magicPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const magicJpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const magicWebp =
    buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP";

  if (magicPdf) return "pdf";
  if (magicPng) return "png";
  if (magicJpg) return "jpg";
  if (magicWebp) return "webp";

  // Header-less JPEG (rare) — allow if declared/extension agree.
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (magicJpg && (declaredMime === "image/jpeg" || ext === "jpg" || ext === "jpeg")) return "jpeg";
  return "rejected";
}

/** Extract text from a PDF buffer. Returns null when no text layer exists. */
async function pdfText(buf: Buffer): Promise<string | null> {
  try {
    // Import the library entry directly: the package root contains debug code
    // that tries to read a test PDF from disk when loaded as the main module.
    const mod = await import("pdf-parse/lib/pdf-parse.js");
    const pdfParse = (mod as unknown as { default?: unknown }).default ?? mod;
    const out = (await (pdfParse as (b: Buffer) => Promise<{ text: string }>)(buf)) as { text: string };
    const text = (out.text ?? "").replace(/\u0000/g, "").trim();
    return text.length >= 40 ? text : null;
  } catch (err) {
    console.error("[lexlens/document] pdf-parse failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`OCR timeout after ${ms}ms`)), ms)),
  ]);
}

interface VisionOcrResult {
  text: string | null;
  reason?: string;
}

/** Send an image to the document-understanding model. */
async function visionOcrImage(buf: Buffer, kind: Exclude<UploadKind, "pdf" | null>): Promise<VisionOcrResult> {
  try {
    // Prefer deployment environment variables, while retaining the SDK's
    // project/home-directory config lookup for local development.
    const baseUrl = process.env.ZAI_BASE_URL?.trim();
    const apiKey = process.env.ZAI_API_KEY?.trim();
    const mime = `image/${kind === "jpg" || kind === "jpeg" ? "jpeg" : kind}`;
    const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
    const textPart = { type: "text" as const, text: "Extract ALL text from this legal document, preserving reading order. Output only the extracted text, no commentary." };
    const content = [textPart, { type: "image_url" as const, image_url: { url: dataUrl } }];

    let res: { choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }> };
    if (baseUrl && apiKey) {
      // The public Z AI API uses the OpenAI-compatible endpoint. The SDK's
      // createVision helper targets a separate /chat/completions/vision route.
      const response = await withTimeout(fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "glm-4.5v",
          messages: [{ role: "user", content }],
          thinking: { type: "disabled" },
        }),
      }), 45_000);
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 300);
        throw new Error(`Z AI vision request failed (${response.status}): ${detail}`);
      }
      res = (await response.json()) as typeof res;
    } else {
      const zai = await ZAI.create();
      res = await withTimeout(zai.chat.completions.createVision({
        model: "glm-4.5v",
        messages: [{ role: "user", content }],
        thinking: { type: "disabled" },
      }), 45_000) as typeof res;
    }
    const message = res.choices?.[0]?.message?.content ?? "";
    const text = (typeof message === "string" ? message : message.map((part) => part.text ?? "").join(" ")).trim();
    return text.length >= 40
      ? { text }
      : { text: null, reason: "The OCR service returned no readable text." };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[lexlens/document] vision OCR failed:", message);
    if (message.includes("Configuration file not found or invalid")) {
      return {
        text: null,
        reason:
          "This is a scanned document, but OCR is not configured. Add ZAI_BASE_URL and ZAI_API_KEY to .env, then restart the server.",
      };
    }
    const status = message.match(/failed \((\d{3})\)/)?.[1];
    if (status === "401" || status === "403") {
      return { text: null, reason: "OCR credentials were rejected. Check ZAI_BASE_URL and ZAI_API_KEY in Vercel, then redeploy." };
    }
    if (status === "429" && message.includes("1113")) {
      return { text: null, reason: "Z AI OCR is out of balance or has no resource package. Recharge the Z AI account, or configure another OCR provider." };
    }
    if (status === "429") {
      return { text: null, reason: "Z AI OCR is temporarily rate-limited. Please wait a moment and try again." };
    }
    if (status === "404") {
      return { text: null, reason: "The configured Z AI OCR endpoint or model was not found. Check ZAI_BASE_URL in Vercel." };
    }
    if (status === "400") {
      return { text: null, reason: "The OCR provider rejected the image request. Try a clearer or smaller PDF." };
    }
    return { text: null, reason: "The OCR service could not read this document." };
  }
}

/** Render scanned PDF pages to PNG because the public vision endpoint is image-oriented. */
async function renderPdfPages(buf: Buffer): Promise<Buffer[]> {
  const { createCanvas } = await import("@napi-rs/canvas");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Use CDN worker to avoid missing pdf.worker.mjs in Vercel deployment.
  // The version must match the installed pdfjs-dist version.
  const PDFJS_VERSION = "6.3.289";
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/legacy/build/pdf.worker.min.mjs`;
  const document = await pdfjs.getDocument({
    data: new Uint8Array(buf),
    disableFontFace: true,
    useSystemFonts: false,
  }).promise;
  const pages: Buffer[] = [];
  const pageCount = Math.min(document.numPages, 8);
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.7 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({
      canvasContext: canvas.getContext("2d") as unknown as Parameters<typeof page.render>[0]["canvasContext"],
      viewport,
    } as never).promise;
    pages.push(canvas.toBuffer("image/png"));
  }
  return pages;
}

/** OCR an image or scanned PDF through the document-understanding model. */
async function visionOcr(buf: Buffer, kind: UploadKind): Promise<VisionOcrResult> {
  if (kind === null) return { text: null, reason: "No document type was detected." };
  if (kind !== "pdf") return visionOcrImage(buf, kind);
  try {
    const pages = await renderPdfPages(buf);
    const texts: string[] = [];
    let lastReason = "The OCR service could not read this document.";
    for (const page of pages) {
      const result = await visionOcrImage(page, "png");
      if (result.text) texts.push(result.text);
      if (result.reason) lastReason = result.reason;
    }
    return texts.length > 0 ? { text: texts.join("\n\n") } : { text: null, reason: lastReason };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[lexlens/document] PDF rasterization failed:", message);
    return { text: null, reason: "This scanned PDF could not be rendered for OCR. Please upload a clearer PDF or an image." };
  }
}

export interface ExtractResult {
  ok: boolean;
  text: string;
  reason?: string;
}

/** Full extraction entry point. Never throws — returns friendly reasons. */
export async function extractDocumentText(buf: Buffer, kind: UploadKind): Promise<ExtractResult> {
  if (kind === "pdf") {
    const layered = await pdfText(buf);
    if (layered) return { ok: true, text: layered.slice(0, 20_000) };
    // Scanned PDF — try OCR.
    const ocr = await visionOcr(buf, "pdf");
    if (ocr.text) return { ok: true, text: ocr.text.slice(0, 20_000) };
    return {
      ok: false,
      text: "",
      reason: ocr.reason ?? "Unable to read this scanned PDF. Please paste the notice text instead.",
    };
  }
  if (kind === "png" || kind === "jpg" || kind === "jpeg" || kind === "webp") {
    const ocr = await visionOcr(buf, kind);
    if (ocr.text) return { ok: true, text: ocr.text.slice(0, 20_000) };
    return {
      ok: false,
      text: "",
      reason: ocr.reason ?? "Unable to read this image. Please paste the notice text instead.",
    };
  }
  return { ok: false, text: "", reason: ACCEPT_MESSAGE };
}
