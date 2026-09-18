import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateSession, sessionExpiresAt } from "@/lib/session";
import { getOwnedNotice } from "@/lib/lexlens/server/notices";
import { isoFromDate } from "@/lib/lexlens/server/deadline";
import { toReminderDTO } from "@/lib/lexlens/server/reminders";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * Set / edit the deadline reminder for this session's notice.
 *
 * GUARANTEES (reminder spec):
 *  • The anchor is the DETERMINISTICALLY CALCULATED deadline stored on the
 *    notice — the client must echo it back, and a stale anchor is rejected
 *    (409) so a reminder can never attach to an AI-invented or outdated date.
 *  • No deadline calculated yet (receipt date missing) → 409, reminder refused.
 *  • The reminder time must be in the future and not after the deadline day.
 *  • One ACTIVE reminder per notice: setting again = edit (old row replaced).
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await getOrCreateSession();
    const { id } = await params;
    const notice = await getOwnedNotice(id, session.id);
    if (!notice) return NextResponse.json({ error: "Notice not found." }, { status: 404 });

    const body = (await req.json().catch(() => ({}))) as { remindAt?: number; deadline?: string };

    // 1. The reminder must be anchored to a calculated deadline.
    const storedDeadline = isoFromDate(notice.deadlineDate);
    if (!storedDeadline) {
      return NextResponse.json(
        { error: "A reminder needs a calculated deadline. Add the receipt date first — LexLens will calculate it instantly." },
        { status: 409 },
      );
    }

    // 2. The anchor the user saw must still be the current deterministic one.
    if (body.deadline !== storedDeadline) {
      return NextResponse.json(
        { error: "The deadline has changed since this page was opened. Please set the reminder again." },
        { status: 409 },
      );
    }

    // 3. Validate the requested time.
    const remindAtMs = Number(body.remindAt);
    if (!Number.isFinite(remindAtMs)) {
      return NextResponse.json({ error: "Please choose a valid reminder date and time." }, { status: 400 });
    }
    const now = Date.now();
    if (remindAtMs < now - 2 * 60 * 1000) {
      return NextResponse.json(
        { error: "That time has already passed. Please pick a future date and time." },
        { status: 400 },
      );
    }
    // Reminders may not be set beyond the deadline day (its local evening can
    // land on the next UTC day, so the guard allows deadline + 1 UTC day).
    const deadlineEndMs = Date.parse(`${storedDeadline}T00:00:00Z`) + 2 * 86_400_000;
    if (remindAtMs > deadlineEndMs) {
      return NextResponse.json(
        { error: "A reminder cannot be set after the deadline has passed." },
        { status: 400 },
      );
    }

    // 4. Exactly ONE ACTIVE reminder per notice — set/edit replaces it.
    const [, reminder] = await db.$transaction([
      db.reminder.deleteMany({ where: { noticeId: notice.id, sessionId: session.id, status: "ACTIVE" } }),
      db.reminder.create({
        data: {
          sessionId: session.id,
          noticeId: notice.id,
          deadlineDate: new Date(`${storedDeadline}T00:00:00Z`),
          deadlineRule: notice.deadlineRule,
          sourceId: notice.deadlineSourceId,
          remindAt: new Date(remindAtMs),
          status: "ACTIVE",
          expiresAt: sessionExpiresAt(),
        },
      }),
    ]);

    return NextResponse.json({ reminder: toReminderDTO(reminder, notice.title) });
  } catch (err) {
    console.error("[lexlens/reminder] set failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not set the reminder. Please try again." }, { status: 500 });
  }
}

/** Cancel the reminder for this notice (rows are deleted — nothing kept). */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await getOrCreateSession();
    const { id } = await params;
    const notice = await getOwnedNotice(id, session.id);
    if (!notice) return NextResponse.json({ error: "Notice not found." }, { status: 404 });

    await db.reminder.deleteMany({ where: { noticeId: notice.id, sessionId: session.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[lexlens/reminder] cancel failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not cancel the reminder." }, { status: 500 });
  }
}
