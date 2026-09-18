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

/** OCR an image or scanned PDF through the document-understanding model. */
async function visionOcr(buf: Buffer, kind: UploadKind): Promise<VisionOcrResult> {
  if (!kind) return { text: null, reason: "No document type was detected." };
  try {
    // Prefer deployment environment variables, while retaining the SDK's
    // project/home-directory config lookup for local development.
    const baseUrl = process.env.ZAI_BASE_URL?.trim();
    const apiKey = process.env.ZAI_API_KEY?.trim();
    const zai = baseUrl && apiKey
      ? new (ZAI as unknown as new (config: { baseUrl: string; apiKey: string }) => Awaited<ReturnType<typeof ZAI.create>>)({ baseUrl, apiKey })
      : await ZAI.create();
    const mime = kind === "pdf" ? "application/pdf" : `image/${kind === "jpg" || kind === "jpeg" ? "jpeg" : kind}`;
    const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
    const textPart = { type: "text" as const, text: "Extract ALL text from this legal document, preserving reading order. Output only the extracted text, no commentary." };
    const content =
      kind === "pdf"
        ? [textPart, { type: "file_url" as const, file_url: { url: dataUrl } }]
        : [textPart, { type: "image_url" as const, image_url: { url: dataUrl } }];
    const res = await withTimeout(
      zai.chat.completions.createVision({
        model: "glm-4.5v",
        messages: [{ role: "user", content }],
        thinking: { type: "disabled" },
      }),
      45_000,
    );
    const text = (res.choices?.[0]?.message?.content ?? "").trim();
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
    return { text: null, reason: "The OCR service could not read this document." };
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
