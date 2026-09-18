// LexLens — server-side deadline & status layer.
//
// The deterministic engine stays the single source of truth: the same rules
// the client uses (rules.ts / deadline-engine.ts) are mirrored here so the
// server can (a) recalculate a stored deadline the moment the user supplies a
// receipt date and (b) derive live statuses on every read. No LLM is ever
// involved in date math. Nothing is invented: when the anchor date is unknown,
// the deadline stays unknown (MISSING_REQUIRED_FACT).
//
// JURISDICTION (PRD §4/§6/§11): the rule pack is selected by (jurisdiction ×
// noticeType). The FDCPA rule only loads when its applicability was actually
// established. UNKNOWN cases get no statutory rule at all.

import { addDaysISO, calculateStatutoryDeadline, daysBetween, isValidISO, todayISO } from "../deadline-engine";
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
  status: "CALCULATED" | "MISSING_REQUIRED_FACT" | "NO_RULE";
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
 * user just provided. Deterministic — mirrors DEADLINE_RULES exactly through
 * the canonical calculateStatutoryDeadline wrapper (PRD §10).
 */
export function deriveDeadline(
  noticeType: string,
  base: CaseBase | null,
  receiptDateISO: string | null,
  jurisdiction: "INDIA" | "USA" | "UNKNOWN" = "UNKNOWN",
  debtRuleApplicable: boolean | null = null,
): DerivedDeadline {
  // 1. Statute rule pack for this (jurisdiction × type) — firewall enforced.
  const pack = (DEADLINE_RULES[noticeType] ?? []).filter((r) => r.jurisdiction === jurisdiction);
  const fdcpaGate = (r: (typeof pack)[number]) => !(r.source_id === "fdcpa_1692g" && debtRuleApplicable !== true);
  const rule = pack.find(fdcpaGate);

  if (rule) {
    let anchorISO: string | null = null;
    if (rule.anchor_field === "receipt_date") anchorISO = receiptDateISO;
    else if (rule.anchor_field === "explicit") {
      const stated = base?.stated_deadlines?.find((d) => isValidISO(d.explicit_date));
      anchorISO = stated?.explicit_date ?? null;
    } else anchorISO = base ? factISO(base, rule.anchor_field) : null;

    const res = calculateStatutoryDeadline({
      ruleId: rule.event_key,
      triggerDate: anchorISO,
      jurisdiction,
      statutoryPeriod: rule.period_days ?? base?.stated_deadlines?.[0]?.period_days ?? null,
      businessDays: rule.business_days,
      sourceId: rule.source_id,
      corpusVerified: !!rule.source_id,
    });

    return {
      deadlineDate: res.deadline,
      ruleLabel: rule.label.en,
      sourceId: res.sourceId,
      anchorDate: res.triggerDate,
      periodDays: res.period,
      status: res.status,
    };
  }

  // 2. Generic notices — fall back to what the notice itself states.
  const stated = base?.stated_deadlines?.[0];
  if (stated && jurisdiction !== "UNKNOWN") {
    if (stated.anchor === "explicit" && isValidISO(stated.explicit_date)) {
      return { deadlineDate: stated.explicit_date, ruleLabel: "Date stated in the notice", sourceId: null, anchorDate: stated.explicit_date, periodDays: null, status: "CALCULATED" };
    }
    const period = stated.period_days;
    if (period && period > 0) {
      if (stated.anchor === "notice") {
        const noticeISO = base ? factISO(base, "notice_date") : null;
        if (noticeISO) return { deadlineDate: addDaysISO(noticeISO, period), ruleLabel: "Period stated in the notice", sourceId: null, anchorDate: noticeISO, periodDays: period, status: "CALCULATED" };
      } else if (receiptDateISO) {
        return { deadlineDate: addDaysISO(receiptDateISO, period), ruleLabel: "Period stated in the notice", sourceId: null, anchorDate: receiptDateISO, periodDays: period, status: "CALCULATED" };
      }
      return { deadlineDate: null, ruleLabel: "Period stated in the notice", sourceId: null, anchorDate: null, periodDays: period, status: "MISSING_REQUIRED_FACT" };
    }
  }

  return { deadlineDate: null, ruleLabel: null, sourceId: null, anchorDate: null, periodDays: null, status: "NO_RULE" };
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
