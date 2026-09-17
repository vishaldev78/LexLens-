import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser, UnauthorizedError } from "@/lib/auth";
import { syncReminders } from "@/lib/lexlens/server/notify";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const user = await requireApiUser();
    await syncReminders(user);

    const url = new URL(req.url);
    const filter = url.searchParams.get("filter");
    const unreadOnly = filter === "unread";

    const [items, unreadCount] = await Promise.all([
      db.notification.findMany({
        where: { userId: user.id, ...(unreadOnly ? { isRead: false } : {}) },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { notice: { select: { id: true, title: true } } },
      }),
      db.notification.count({ where: { userId: user.id, isRead: false } }),
    ]);

    return NextResponse.json({
      notifications: items.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
        noticeId: n.notice?.id ?? null,
        noticeTitle: n.notice?.title ?? null,
      })),
      unreadCount,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    console.error("[lexlens/notifications] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not load notifications." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = (await req.json().catch(() => ({}))) as { action?: string; id?: string };
    if (body.action === "mark_all_read") {
      await db.notification.updateMany({ where: { userId: user.id, isRead: false }, data: { isRead: true } });
      return NextResponse.json({ ok: true });
    }
    if (body.action === "mark_read" && body.id && /^[a-z0-9]{10,40}$/i.test(body.id)) {
      await db.notification.updateMany({ where: { id: body.id, userId: user.id }, data: { isRead: true } });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    return NextResponse.json({ error: "Could not update notifications." }, { status: 500 });
  }
}
