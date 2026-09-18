// LexLens — deterministic reminder & notification engine.
//
// Runs on dashboard / notices / notification reads (idempotent, cheap).
// For every active deadline it checks which reminder tiers have been crossed
// TODAY (7 / 3 / 1 days before, due date, overdue) and creates each
// notification exactly once — the Reminder table's UNIQUE key
// (userId + noticeId + reminderType + deadlineDate) is the dedup mechanism.
// Notifications are factual and conditional; they never state legal
// conclusions, only what the deadline system has already calculated.

import { db } from "@/lib/db";
import type { Notice, User } from "@prisma/client";
import { daysBetween, deriveStatus, isValidISO, todayISO } from "./deadline";

function titleCaseUsername(username: string): string {
  return username.charAt(0).toUpperCase() + username.slice(1);
}

/** Create a notification only if no unread/read one of the same type exists
 *  for the same notice (used for event-style notifications). */
async function notifyOnce(
  userId: string,
  noticeId: string | null,
  type: string,
  title: string,
  message: string,
) {
  const existing = await db.notification.findFirst({
    where: { userId, noticeId, type },
    select: { id: true },
  });
  if (existing) return;
  await db.notification.create({ data: { userId, noticeId, type, title, message } });
}

/** Fire a reminder tier once per (notice, deadline) via the Reminder table. */
async function fireReminderOnce(
  user: Pick<User, "id" | "username">,
  notice: Pick<Notice, "id" | "title" | "deadlineDate">,
  reminderType: "deadline_7" | "deadline_3" | "deadline_1" | "deadline_due" | "deadline_overdue",
  title: string,
  message: string,
) {
  if (!notice.deadlineDate) return;
  try {
    await db.reminder.create({
      data: {
        userId: user.id,
        noticeId: notice.id,
        reminderType,
        deadlineDate: notice.deadlineDate,
      },
    });
  } catch {
    // Unique constraint hit → this reminder was already generated. Done.
    return;
  }
  await db.notification.create({
    data: { userId: user.id, noticeId: notice.id, type: reminderType, title, message },
  });
}

/** Minimal user shape needed for reminder generation. */
export type ReminderUser = Pick<
  User,
  "id" | "username" | "notifyEnabled" | "remind7" | "remind3" | "remind1" | "remindDue" | "remindOverdue"
>;

/**
 * Sync reminders for every active, deadline-bearing notice of the user.
 * Returns nothing; safe to call on every dashboard/list/notification load.
 */
export async function syncReminders(user: ReminderUser): Promise<void> {
  if (!user.notifyEnabled) return;

  const notices = await db.notice.findMany({
    where: { userId: user.id, completed: false, deadlineDate: { not: null } },
    select: { id: true, title: true, deadlineDate: true },
  });
  if (!notices.length) return;

  const today = todayISO();
  const prefs = {
    deadline_7: user.remind7,
    deadline_3: user.remind3,
    deadline_1: user.remind1,
    deadline_due: user.remindDue,
    deadline_overdue: user.remindOverdue,
  } as const;

  for (const n of notices) {
    const iso = n.deadlineDate ? n.deadlineDate.toISOString().slice(0, 10) : null;
    if (!iso || !isValidISO(iso)) continue;
    const days = daysBetween(today, iso);
    const short = n.title.length > 60 ? `${n.title.slice(0, 57)}…` : n.title;

    if (days === 7 && prefs.deadline_7) {
      await fireReminderOnce(
        user, n, "deadline_7",
        "Deadline in 7 days",
        `Your notice "${short}" has a deadline 7 days away (${iso}). Review the report and your next steps.`,
      );
    }
    if (days === 3 && prefs.deadline_3) {
      await fireReminderOnce(
        user, n, "deadline_3",
        "Important: deadline in 3 days",
        `Your notice "${short}" has a deadline in 3 days (${iso}). If you plan to respond, do it now.`,
      );
    }
    if (days === 1 && prefs.deadline_1) {
      await fireReminderOnce(
        user, n, "deadline_1",
        "Your deadline is tomorrow",
        `The deadline for "${short}" is tomorrow (${iso}). Consider seeking qualified legal assistance if you have not acted yet.`,
      );
    }
    if (days === 0 && prefs.deadline_due) {
      await fireReminderOnce(
        user, n, "deadline_due",
        "Your deadline is today",
        `The deadline for "${short}" is today (${iso}). Review the notice report for your calculated window and options.`,
      );
    }
    if (days < 0 && prefs.deadline_overdue) {
      await fireReminderOnce(
        user, n, "deadline_overdue",
        "This deadline has passed",
        `The deadline for "${short}" has passed (${iso}). Review the notice and consider seeking qualified legal assistance.`,
      );
    }
  }
}

/** Event-style notifications created at analysis time / data changes. */
export async function notifyReportReady(userId: string, username: string, notice: Pick<Notice, "id" | "title">) {
  await notifyOnce(
    userId, notice.id, "report_ready",
    "New report ready",
    `${titleCaseUsername(username)}, your analysis of "${notice.title}" is complete. Open the notice to view the full report.`,
  );
}

export async function notifyAnalysisFailed(userId: string, notice: Pick<Notice, "id" | "title">) {
  await notifyOnce(
    userId, notice.id, "analysis_failed",
    "Analysis could not complete",
    `We couldn't complete the analysis for "${notice.title}". Your uploaded document has been saved — you can retry from My Notices.`,
  );
}

export async function notifyMissingInfo(userId: string, notice: Pick<Notice, "id" | "title">, missingLabel: string) {
  await notifyOnce(
    userId, notice.id, "missing_info",
    "Missing information required",
    `Add the ${missingLabel.toLowerCase()} for "${notice.title}" so the exact deadline can be calculated.`,
  );
}

export { deriveStatus };
