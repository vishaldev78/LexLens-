import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { requireApiUser, UnauthorizedError } from "@/lib/auth";
import { getOwnedNotice } from "@/lib/lexlens/server/notices";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

/** Protected document access — files live outside public/ and are streamed
 *  only to the authenticated owner after an ownership check. */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const notice = await getOwnedNotice(id, user);
    if (!notice) return NextResponse.json({ error: "Notice not found." }, { status: 404 });

    const kind = req.nextUrl.searchParams.get("kind") ?? "notice";
    let relPath: string | null = null;
    let downloadName: string = notice.title || "document";

    if (kind === "evidence") {
      const eid = req.nextUrl.searchParams.get("eid") ?? "";
      if (!/^[a-z0-9]{10,40}$/i.test(eid)) return NextResponse.json({ error: "Invalid reference." }, { status: 400 });
      const row = await db.evidence.findFirst({ where: { id: eid, noticeId: notice.id, userId: user.id } });
      if (!row?.storedPath) return NextResponse.json({ error: "File not found." }, { status: 404 });
      relPath = row.storedPath;
      downloadName = row.name;
    } else {
      relPath = notice.filePath;
    }

    if (!relPath) return NextResponse.json({ error: "This notice has no stored document." }, { status: 404 });

    // Path-traversal guard: resolve and require the result to stay in uploads/.
    const abs = path.resolve(UPLOAD_ROOT, relPath);
    if (!abs.startsWith(UPLOAD_ROOT + path.sep)) {
      return NextResponse.json({ error: "Invalid reference." }, { status: 400 });
    }
    const exists = await stat(abs).then(() => true).catch(() => false);
    if (!exists) return NextResponse.json({ error: "File not found." }, { status: 404 });

    const buf = await readFile(abs);
    const ext = path.extname(abs).slice(1).toLowerCase();
    const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `inline; filename="${encodeURIComponent(downloadName)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    console.error("[lexlens/notices] file failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not load this file." }, { status: 500 });
  }
}
