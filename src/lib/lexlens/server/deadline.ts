// LexLens — server-side deadline & status layer.
//
// The deterministic engine stays the single source of truth: the same rules
// the client uses (rules.ts / deadline-engine.ts) are mirrored here so the
// server can (a) recalculate a stored deadline the moment the user supplies a
// receipt date and (b) derive live statuses on every read. No LLM is ever
// involved in date math. Nothing is invented: when the anchor date is unknown,
// the deadline stays unknown.

import { addDaysISO, daysBetween, isValidISO, todayISO } from "../deadline-engine";
import { DEADLINE_RULES } from "../rules";
import type { CaseBase } from "../types";

export type NoticeStatus =
  | "ACTIVE"
  | "DUE_SOON"
  | "DUE_TODAY"
  | "OVERDUE"
  | "COMPLETED"
  | "NO_DEADLINE"
  | "UNKNOWN_DEADLINE";

export interface DerivedDeadline {
  deadlineDate: string | null;
  ruleLabel: string | null;
  sourceId: string | null;
  anchorDate: string | null;
  periodDays: number | null;
}

function isoFromDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  const iso = d.toISOString().slice(0, 10);
  return isValidISO(iso) ? iso : null;
}

function factISO(base: CaseBase, key: string): string | null {
  const f = base.facts.find((x) => x.key === key);
  return f && isValidISO(f.iso) ? f.iso : null;
}

/**
 * Recalculate the statutory deadline from stored data + a receipt date the
 * user just provided. Deterministic — mirrors DEADLINE_RULES exactly.
 */
export function deriveDeadline(
  noticeType: string,
  base: CaseBase | null,
  receiptDateISO: string | null,
): DerivedDeadline {
  const today = todayISO();

  // 1. Statute rule pack for known notice types.
  const rule = DEADLINE_RULES[noticeType]?.[0];
  if (rule) {
    let anchorISO: string | null = null;
    if (rule.anchor_field === "receipt_date") anchorISO = receiptDateISO;
    else if (rule.anchor_field === "explicit") {
      const stated = base?.stated_deadlines?.find((d) => isValidISO(d.explicit_date));
      anchorISO = stated?.explicit_date ?? null;
    } else anchorISO = base ? factISO(base, rule.anchor_field) : null;

    if (!anchorISO) {
      return { deadlineDate: null, ruleLabel: rule.label.en, sourceId: rule.source_id, anchorDate: null, periodDays: rule.period_days };
    }
    const period = rule.period_days ?? base?.stated_deadlines?.[0]?.period_days ?? null;
    if (!period || period <= 0) {
      return { deadlineDate: null, ruleLabel: rule.label.en, sourceId: rule.source_id, anchorDate: anchorISO, periodDays: null };
    }
    return {
      deadlineDate: addDaysISO(anchorISO, period, rule.business_days),
      ruleLabel: rule.label.en,
      sourceId: rule.source_id,
      anchorDate: anchorISO,
      periodDays: period,
    };
  }

  // 2. Generic notices — fall back to what the notice itself states.
  const stated = base?.stated_deadlines?.[0];
  if (stated) {
    if (stated.anchor === "explicit" && isValidISO(stated.explicit_date)) {
      return { deadlineDate: stated.explicit_date, ruleLabel: "Date stated in the notice", sourceId: null, anchorDate: stated.explicit_date, periodDays: null };
    }
    const period = stated.period_days;
    if (period && period > 0) {
      if (stated.anchor === "notice") {
        const noticeISO = base ? factISO(base, "notice_date") : null;
        if (noticeISO) return { deadlineDate: addDaysISO(noticeISO, period), ruleLabel: "Period stated in the notice", sourceId: null, anchorDate: noticeISO, periodDays: period };
      } else if (receiptDateISO) {
        return { deadlineDate: addDaysISO(receiptDateISO, period), ruleLabel: "Period stated in the notice", sourceId: null, anchorDate: receiptDateISO, periodDays: period };
      }
    }
  }

  return { deadlineDate: null, ruleLabel: null, sourceId: null, anchorDate: null, periodDays: null };
}

/** Live, per-request status — countdowns are never persisted. */
export function deriveStatus(
  completed: boolean,
  deadlineDateISO: string | null,
  hasDeadlineRule: boolean,
  today: string = todayISO(),
): { status: NoticeStatus; daysRemaining: number | null } {
  if (completed) return { status: "COMPLETED", daysRemaining: null };
  if (!deadlineDateISO || !isValidISO(deadlineDateISO)) {
    return { status: hasDeadlineRule ? "UNKNOWN_DEADLINE" : "NO_DEADLINE", daysRemaining: null };
  }
  const days = daysBetween(today, deadlineDateISO);
  if (days < 0) return { status: "OVERDUE", daysRemaining: days };
  if (days === 0) return { status: "DUE_TODAY", daysRemaining: 0 };
  if (days <= 7) return { status: "DUE_SOON", daysRemaining: days };
  return { status: "ACTIVE", daysRemaining: days };
}

export { isoFromDate, todayISO, daysBetween, isValidISO };
