// LexLens — deterministic deadline engine (FEATURE 3).
//
// The LLM is NEVER allowed to compute a legal deadline. It only extracts what
// the notice says (period + anchor). This module combines:
//     document facts + user-provided facts + a verified legal rule
// and produces the final deadline with pure date arithmetic. If the anchor
// date is missing, it returns status "missing_input" — it never invents one.

import type { L4 } from "./types";

export interface FieldValue {
  value: string;
  iso: string | null;
  num: number | null;
  source: "document" | "user_input";
  confidence: number | null;
  source_ref: string | null;
}

export interface DeadlineRule {
  event_key: string;
  /** Statutory period in days. null ⇒ use the period stated in the notice. */
  period_days: number | null;
  /** Canonical field the clock starts from — "receipt_date" for §138, never "notice_date". */
  anchor_field: string;
  business_days: boolean;
  /** Corpus source backing the rule. */
  source_id: string | null;
  /** JURISDICTION FIREWALL (PRD §4): the rule only loads for this case
   *  jurisdiction. An Indian case can never load a US rule and vice versa. */
  jurisdiction: "INDIA" | "USA";
  /** Localized description, e.g. "15 days from receipt of the notice". */
  description: L4;
  /** Localized label for the event. */
  label: L4;
  /** origin: statute rule beats whatever the notice wrote when both exist. */
  origin: "statute_rule" | "notice_stated";
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidISO(iso: string | null | undefined): iso is string {
  if (!iso || !ISO_RE.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && iso === d.toISOString().slice(0, 10);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysISO(iso: string, days: number, business = false): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (business) {
    let added = 0;
    while (added < days) {
      d.setUTCDate(d.getUTCDate() + 1);
      const dow = d.getUTCDay();
      if (dow !== 0 && dow !== 6) added++;
    }
    return d.toISOString().slice(0, 10);
  }
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromISO: string, toISO: string): number {
  const a = new Date(`${fromISO}T00:00:00Z`).getTime();
  const b = new Date(`${toISO}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

export interface DeadlineInput {
  rule: DeadlineRule;
  /** resolved canonical field values (document + user inputs merged) */
  fields: Record<string, FieldValue>;
  /** period stated in the notice, if any (fallback when rule.period_days is null) */
  stated_period_days: number | null;
  /** explicit fixed date stated in the notice, if any */
  stated_explicit_date: string | null;
  /** localized "cannot calculate because ..." reason (resolved by caller) */
  missing_reason: string;
  today: string;
}

export interface DeadlineResult {
  event_key: string;
  rule_source_id: string | null;
  anchor_field: string | null;
  anchor_date: string | null;
  anchor_source: "document" | "user_input" | "missing";
  period_days: number | null;
  business_days: boolean;
  deadline: string | null;
  days_left: number | null;
  status: "calculated" | "missing_input" | "no_rule";
  calculation_method: "deterministic";
  origin: "statute_rule" | "notice_stated";
  anchor_confidence: number | null;
}

/** Never fabricates: no anchor ⇒ missing_input, no rule + no stated period ⇒ no_rule. */
export function calculateDeadline(input: DeadlineInput): DeadlineResult {
  const { rule, fields, today } = input;
  const base: DeadlineResult = {
    event_key: rule.event_key,
    rule_source_id: rule.source_id,
    anchor_field: rule.anchor_field,
    anchor_date: null,
    anchor_source: "missing",
    period_days: null,
    business_days: rule.business_days,
    deadline: null,
    days_left: null,
    status: "missing_input",
    calculation_method: "deterministic",
    origin: rule.origin,
    anchor_confidence: null,
  };

  // Explicit fixed date stated in the notice (e.g. "hearing on 2026-10-01").
  if (rule.anchor_field === "explicit" ) {
    if (isValidISO(input.stated_explicit_date)) {
      return finish(base, input.stated_explicit_date, "document", input, null);
    }
    return base;
  }

  const field = fields[rule.anchor_field];
  if (!field || !isValidISO(field.iso)) return base; // missing — do NOT invent

  return finish(base, field.iso, field.source, input, field.confidence);
}

function finish(
  base: DeadlineResult,
  anchorISO: string,
  anchorSource: "document" | "user_input",
  input: DeadlineInput,
  confidence: number | null,
): DeadlineResult {
  const period =
    input.rule.period_days !== null && input.rule.period_days !== undefined
      ? input.rule.period_days
      : input.stated_period_days;

  if (period === null || period === undefined || !Number.isFinite(period) || period <= 0) {
    return { ...base, anchor_date: anchorISO, anchor_source: anchorSource, anchor_confidence: confidence, status: "no_rule" };
  }

  const deadline = addDaysISO(anchorISO, period, input.rule.business_days);
  return {
    ...base,
    anchor_date: anchorISO,
    anchor_source: anchorSource,
    anchor_confidence: confidence,
    period_days: period,
    deadline,
    days_left: daysBetween(input.today, deadline),
    status: "calculated",
  };
}

/* ───────────── PRD §10 — canonical statutory deadline function ─────────────
 * Deterministic deadline calculation with the exact contract from the spec:
 * no trigger date ⇒ deadline = null + MISSING_REQUIRED_FACT. Confidence is
 * 1.0 only for verified statutory sources, lower for notice-stated periods. */

export interface StatutoryDeadlineInput {
  ruleId: string | null;
  triggerDate: string | null; // ISO YYYY-MM-DD (e.g. noticeReceivedDate)
  jurisdiction: "INDIA" | "USA" | "UNKNOWN";
  statutoryPeriod: number | null; // days
  businessDays?: boolean;
  sourceId?: string | null;
  corpusVerified?: boolean;
}

export interface StatutoryDeadlineResult {
  deadline: string | null;
  triggerDate: string | null;
  period: number | null;
  ruleId: string | null;
  sourceId: string | null;
  confidence: number;
  status: "CALCULATED" | "MISSING_REQUIRED_FACT" | "NO_RULE";
}

export function calculateStatutoryDeadline(input: StatutoryDeadlineInput): StatutoryDeadlineResult {
  const {
    ruleId, triggerDate, jurisdiction, statutoryPeriod, businessDays = false,
    sourceId = null, corpusVerified = true,
  } = input;

  if (jurisdiction === "UNKNOWN" || !ruleId || statutoryPeriod === null || statutoryPeriod <= 0) {
    return { deadline: null, triggerDate: triggerDate ?? null, period: statutoryPeriod ?? null, ruleId, sourceId, confidence: 0, status: "NO_RULE" };
  }
  if (!isValidISO(triggerDate)) {
    return { deadline: null, triggerDate: null, period: statutoryPeriod, ruleId, sourceId, confidence: corpusVerified ? 1 : 0.6, status: "MISSING_REQUIRED_FACT" };
  }
  return {
    deadline: addDaysISO(triggerDate, statutoryPeriod, businessDays),
    triggerDate,
    period: statutoryPeriod,
    ruleId,
    sourceId,
    confidence: corpusVerified ? 1 : 0.6,
    status: "CALCULATED",
  };
}
