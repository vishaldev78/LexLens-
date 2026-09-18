import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { getOrCreateSession, sessionExpiresAt } from "@/lib/session";
import { getOwnedNotice, parseUserState } from "@/lib/lexlens/server/notices";
import { MAX_UPLOAD_BYTES, ACCEPT_MESSAGE } from "@/lib/lexlens/server/document-text";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");
const EVIDENCE_MIMES = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await getOrCreateSession();
    const { id } = await params;
    const notice = await getOwnedNotice(id, session.id);
    if (!notice) return NextResponse.json({ error: "Notice not found." }, { status: 404 });

    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (!files.length) return NextResponse.json({ error: "No files were received." }, { status: 400 });

    const dir = path.join(UPLOAD_ROOT, session.id, "evidence", notice.id);
    await mkdir(dir, { recursive: true });

    const saved: { id: string; name: string; size: number; type: string; addedAt: number }[] = [];
    for (const f of files.slice(0, 6)) {
      if (f.size === 0 || f.size > MAX_UPLOAD_BYTES) continue;
      const buf = Buffer.from(await f.arrayBuffer());
      // Magic-byte check: PDF/PNG/JPG/WEBP only.
      const ok =
        buf.subarray(0, 5).toString("latin1") === "%PDF-" ||
        (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) ||
        (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) ||
        (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP");
      if (!ok || (f.type && !EVIDENCE_MIMES.has(f.type))) continue;

      const ext = f.name.toLowerCase().endsWith(".pdf") ? "pdf" : f.name.toLowerCase().endsWith(".png") ? "png" : f.name.toLowerCase().endsWith(".webp") ? "webp" : "jpg";
      const stored = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      await writeFile(path.join(dir, stored), buf);

      const row = await db.evidence.create({
        data: {
          noticeId: notice.id,
          sessionId: session.id,
          expiresAt: sessionExpiresAt(),
          name: f.name.slice(0, 160),
          mimeType: f.type || "application/octet-stream",
          size: f.size,
          storedPath: `${session.id}/evidence/${notice.id}/${stored}`,
        },
      });
      saved.push({ id: row.id, name: row.name, size: row.size, type: row.mimeType, addedAt: row.createdAt.getTime() });

      // Mirror into userState.evidence so the case view picks it up.
      const state = parseUserState(notice.userState);
      state.evidence = [...state.evidence, { id: row.id, name: row.name, size: row.size, type: row.mimeType, addedAt: row.createdAt.getTime() }];
      await db.notice.update({ where: { id: notice.id }, data: { userState: JSON.stringify(state) } });
    }

    if (!saved.length) {
      return NextResponse.json({ error: ACCEPT_MESSAGE }, { status: 415 });
    }
    return NextResponse.json({ ok: true, evidence: saved });
  } catch (err) {
        console.error("[lexlens/notices] evidence failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not save the evidence files." }, { status: 500 });
  }
}
