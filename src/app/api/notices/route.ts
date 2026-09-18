import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { requireApiUser, UnauthorizedError } from "@/lib/auth";
import { detectKind, extractDocumentText, MAX_UPLOAD_BYTES, ACCEPT_MESSAGE } from "@/lib/lexlens/server/document-text";
import { toSummary } from "@/lib/lexlens/server/notices";
import { todayISO } from "@/lib/lexlens/deadline-engine";

export const runtime = "nodejs";
export const maxDuration = 120;

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

function safeExt(kind: string): string {
  return kind === "jpeg" ? "jpg" : kind;
}

export async function GET() {
  try {
    const user = await requireApiUser();
    const notices = await db.notice.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
    });
    const today = todayISO();
    return NextResponse.json({ notices: notices.map((n) => toSummary(n, today)) });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    console.error("[lexlens/notices] list failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not load your notices." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireApiUser();
    const contentType = req.headers.get("content-type") ?? "";

    let noticeText = "";
    let title = "";
    let sourceLabel = "";
    let fileType = "text";
    let filePath: string | null = null;
    let fileMime: string | null = null;
    let fileSize: number | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      const label = (form.get("label") as string | null) ?? "";
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No file was received. Please choose a file and try again." }, { status: 400 });
      }
      if (file.size === 0) {
        return NextResponse.json({ error: "This file is empty. Please choose a valid document." }, { status: 400 });
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json({ error: `File is larger than the ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB limit.` }, { status: 413 });
      }
      const buf = Buffer.from(await file.arrayBuffer());
      const kind = detectKind(buf, file.type || "", file.name);
      if (!kind || kind === "rejected") {
        return NextResponse.json({ error: ACCEPT_MESSAGE }, { status: 415 });
      }
      const extracted = await extractDocumentText(buf, kind);
      if (!extracted.ok) {
        return NextResponse.json({ error: extracted.reason ?? "Unable to process this file." }, { status: 422 });
      }
      noticeText = extracted.text;

      // Persist under uploads/<userId>/ — NEVER inside public/.
      const dir = path.join(UPLOAD_ROOT, user.id);
      await mkdir(dir, { recursive: true });
      const stored = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}.${safeExt(kind)}`;
      await writeFile(path.join(dir, stored), buf);
      filePath = `${user.id}/${stored}`;
      fileMime = file.type || null;
      fileSize = file.size;
      fileType = safeExt(kind);
      title = (label || file.name).replace(/\.[a-z0-9]{2,5}$/i, "").slice(0, 120) || "Uploaded notice";
      sourceLabel = file.name.slice(0, 160);
    } else {
      const body = (await req.json().catch(() => null)) as { text?: string; label?: string; source?: string } | null;
      noticeText = (body?.text ?? "").trim();
      title = (body?.label ?? "").slice(0, 120) || "Pasted notice";
      sourceLabel = (body?.source ?? "paste").slice(0, 160);
    }

    if (noticeText.length < 40) {
      return NextResponse.json(
        { error: "Notice text is too short. Upload a clearer document or paste a few more sentences." },
        { status: 400 },
      );
    }

    const notice = await db.notice.create({
      data: {
        userId: user.id,
        title,
        sourceLabel,
        fileType,
        filePath,
        fileMime,
        fileSize,
        noticeText: noticeText.slice(0, 20_000),
        analysisStatus: "PENDING",
      },
    });

    return NextResponse.json({ notice: toSummary(notice, todayISO()), chars: noticeText.length });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    console.error("[lexlens/notices] create failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "We couldn't process this document. Please make sure the file is valid and try again." }, { status: 500 });
  }
}
