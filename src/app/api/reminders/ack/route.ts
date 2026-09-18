import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateSession } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Acknowledge that the browser has shown these reminders (fire exactly once).
 * Only rows owned by the CURRENT session can be acknowledged — the update is
 * scoped by sessionId, so a foreign id is silently ignored (privacy 404 rule).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getOrCreateSession();
    const body = (await req.json().catch(() => ({}))) as { ids?: unknown };
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 64).slice(0, 50)
      : [];
    if (ids.length === 0) return NextResponse.json({ ok: true, updated: 0 });

    const res = await db.reminder.updateMany({
      where: { id: { in: ids }, sessionId: session.id, status: "ACTIVE" },
      data: { status: "NOTIFIED", notifiedAt: new Date() },
    });
    return NextResponse.json({ ok: true, updated: res.count });
  } catch (err) {
    console.error("[lexlens/reminders] ack failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not acknowledge reminders." }, { status: 500 });
  }
}
