// LexLens — reminder system (server side).
//
// Reminders are ALWAYS anchored to the deterministically calculated deadline
// (Notice.deadlineDate, produced by deadline-engine.ts). The API never accepts
// a reminder whose anchor is missing, stale, or beyond the deadline — so a
// reminder can never smuggle in an AI-invented or user-invented date.
//
// Scope: anonymous session only (HttpOnly cookie → SHA-256 session id).
// No user history: setting replaces the single ACTIVE reminder per notice,
// cancelling deletes it, and rows expire with the session (24h sliding TTL).

import { db } from "@/lib/db";
import type { Reminder } from "@prisma/client";
import { isoFromDate } from "./deadline";
import type { ReminderDTO } from "../types";

export type { ReminderDTO };

export function toReminderDTO(r: Reminder, noticeTitle: string): ReminderDTO {
  return {
    id: r.id,
    noticeId: r.noticeId,
    noticeTitle,
    deadlineDate: isoFromDate(r.deadlineDate) ?? "",
    deadlineRule: r.deadlineRule,
    sourceId: r.sourceId,
    remindAtMs: r.remindAt.getTime(),
    status: r.status === "NOTIFIED" ? "NOTIFIED" : "ACTIVE",
  };
}

/**
 * Keep ACTIVE reminders in sync when the deterministic deadline changes
 * (e.g. the user adds/corrects the receipt date). The reminder keeps its
 * offset ("N days before the deadline") and its time of day. If the deadline
 * disappears entirely, the reminder loses its anchor and is cancelled —
 * a reminder without a deterministic deadline must not survive.
 */
export async function syncRemindersWithDeadline(
  noticeId: string,
  oldDeadlineISO: string | null,
  newDeadlineISO: string | null,
): Promise<void> {
  if (oldDeadlineISO === newDeadlineISO) return;
  const active = await db.reminder.findMany({ where: { noticeId, status: "ACTIVE" } });
  if (active.length === 0) return;

  if (!newDeadlineISO) {
    await db.reminder.deleteMany({ where: { noticeId, status: "ACTIVE" } });
    return;
  }
  const oldMs = oldDeadlineISO ? Date.parse(`${oldDeadlineISO}T00:00:00Z`) : null;
  const newMs = Date.parse(`${newDeadlineISO}T00:00:00Z`);
  const delta = oldMs !== null && Number.isFinite(oldMs) ? newMs - oldMs : 0;

  for (const r of active) {
    await db.reminder.update({
      where: { id: r.id },
      data: {
        deadlineDate: new Date(`${newDeadlineISO}T00:00:00Z`),
        remindAt: new Date(r.remindAt.getTime() + delta),
      },
    });
  }
}
