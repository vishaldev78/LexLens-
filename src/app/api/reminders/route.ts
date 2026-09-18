import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateSession } from "@/lib/session";
import { toReminderDTO } from "@/lib/lexlens/server/reminders";

export const runtime = "nodejs";

/**
 * ACTIVE reminders for the current anonymous session, oldest first.
 * Consumed by the in-app reminder watcher, which fires a browser/local
 * notification when remindAtMs is due — the reminder time itself was chosen
 * by the user, but its legal anchor is always the deterministic deadline.
 */
export async function GET() {
  try {
    const session = await getOrCreateSession();
    const rows = await db.reminder.findMany({
      where: { sessionId: session.id, status: "ACTIVE" },
      include: { notice: { select: { title: true } } },
      orderBy: { remindAt: "asc" },
      take: 50,
    });
    return NextResponse.json({
      reminders: rows.map((r) => toReminderDTO(r, r.notice.title)),
      serverTime: Date.now(),
    });
  } catch (err) {
    console.error("[lexlens/reminders] list failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not load reminders." }, { status: 500 });
  }
}
