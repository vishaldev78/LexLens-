// LexLens — safety validator (FEATURE 8 / 10 / 23).
// Runs between the LLM and the UI. Never silently displays unvalidated output:
// it corrects what is safe to correct, removes what is unsupported, and reports
// every edit so the UI can disclose it.

import { findCitation } from "./corpus";
import { ABSOLUTE_PATTERNS, CONDITIONAL_REPLACEMENT, FORBIDDEN_CLAIM_PATTERNS } from "./rules";
import { isValidISO, todayISO } from "./deadline-engine";
import type { CaseBase, Proposition } from "./types";

export interface ValidationResult {
  base: CaseBase;
  edits: string[];
  warnings: string[];
}

const MIN_YEAR = 1950;

/** Impossible-date check: statutes live in the modern era; nothing >15y ahead. */
function impossibleISO(iso: string | null): boolean {
  if (!isValidISO(iso)) return false;
  const y = Number(iso.slice(0, 4));
  const todayY = Number(todayISO().slice(0, 4));
  return y < MIN_YEAR || y > todayY + 15;
}

function textOf(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function validateAnalysis(base: CaseBase): ValidationResult {
  const edits: string[] = [];
  const warnings: string[] = [];
  const b = structuredClone(base);

  /* 1. Citation whitelist — invented statutes are dropped before display. */
  const before = b.citations.length;
  b.citations = b.citations.filter((c) => typeof c?.source_id === "string" && !!findCitation(c.source_id));
  if (b.citations.length < before) {
    edits.push(`Dropped ${before - b.citations.length} non-corpus citation(s)`);
  }

  /* 2. Propositions must carry a corpus source to be called verified (FEATURE 21). */
  b.propositions = (b.propositions ?? []).map((p: Proposition) => {
    if (p.source_id && findCitation(p.source_id)) return { ...p, verified: true };
    if (p.source_id) {
      edits.push(`Proposition lost its unverifiable source (${p.source_id}) — marked unverified`);
      return { ...p, source_id: null, verified: false };
    }
    return { ...p, verified: false };
  });

  /* 3. Rights: corpus-backed only; fabricated rights removed (FEATURE 8/9). */
  const forbidden = FORBIDDEN_CLAIM_PATTERNS[b.notice_type] ?? [];
  if (forbidden.length) {
    for (const key of ["en", "hi", "zh", "fr"] as const) {
      const block = b.localized[key];
      const kept = block.rights.filter((r) => {
        const hay = `${textOf(r.title)} ${textOf(r.detail)}`;
        const bad = forbidden.some((re) => re.test(hay));
        if (bad) edits.push(`Removed fabricated right from ${key.toUpperCase()} block (statutory misstatement)`);
        return !bad;
      });
      block.rights = kept;
    }
    // also scrub propositions
    b.propositions = b.propositions.filter((p) => {
      const bad = forbidden.some((re) => re.test(p.text));
      if (bad) edits.push("Removed fabricated statutory proposition");
      return !bad;
    });
  }

  // rights without any corpus source become inferred (never shown as verified law)
  for (const key of ["en", "hi", "zh", "fr"] as const) {
    for (const r of b.localized[key].rights) {
      if (!r.source_id || !findCitation(r.source_id)) {
        if (r.source_id) edits.push(`Right source "${r.source_id}" not in corpus — cleared (needs verification)`);
        r.source_id = null;
      }
    }
  }

  /* 4. Absolute outcome language → conditional (FEATURE 8/10). */
  for (const key of ["en", "hi", "zh", "fr"] as const) {
    const block = b.localized[key];
    const scan = (s: string): string => {
      if (!s) return s;
      if (ABSOLUTE_PATTERNS.some((re) => re.test(s))) {
        edits.push(`Softened absolute outcome statement in ${key.toUpperCase()} block`);
        return s.replace(/[^.!?]*\b(will be arrested|will definitely|will certainly|you will lose|you will win|निश्चित रूप से|必然|vous serez certainement)[^.!?]*[.!?]?/gi, "").trim();
      }
      return s;
    };
    block.summary = scan(block.summary);
    block.key_risk = scan(block.key_risk);
    block.next_steps = block.next_steps.map(scan).filter(Boolean);
    for (const r of block.rights) {
      r.detail = scan(r.detail);
      r.title = scan(r.title);
    }
  }

  // If the notice is a §138 cheque notice and no conditional phrasing exists in EN,
  // make sure prosecution language is conditional (accepted demo criterion).
  if (b.notice_type === "cheque_bounce") {
    const en = b.localized.en;
    const absoluteRisk = ABSOLUTE_PATTERNS.some((re) => re.test(en.key_risk)) || /will be arrested|will definitely/i.test(en.summary);
    if (absoluteRisk) {
      b.localized.en.key_risk = CONDITIONAL_REPLACEMENT.en;
      edits.push("Replaced absolute prosecution language with conditional language (§138)");
    }
  }

  /* 5. Facts: impossible dates are nulled, per-fact confidence clamped. */
  for (const f of b.facts) {
    if (f.kind === "date") {
      if (impossibleISO(f.iso)) {
        f.iso = null;
        f.value = "";
        f.confidence = 0;
        edits.push(`Removed impossible date in fact "${f.key}"`);
      }
    }
    if (typeof f.confidence !== "number" || !Number.isFinite(f.confidence)) f.confidence = 0.5;
    f.confidence = Math.min(0.99, Math.max(0, f.confidence));
  }

  /* 6. Stated deadlines: keep only sane ones (they are inputs to the engine,
        never final deadlines — the engine recalculates everything). */
  b.stated_deadlines = (b.stated_deadlines ?? []).filter((d) => {
    if (d.explicit_date && impossibleISO(d.explicit_date)) {
      edits.push("Removed impossible explicit date from stated deadline");
      return false;
    }
    if (d.period_days !== null && (!Number.isFinite(d.period_days) || (d.period_days as number) <= 0 || (d.period_days as number) > 3650)) {
      edits.push("Dropped implausible stated period");
      return false;
    }
    return true;
  });

  /* 7. Claims sanity: no fabricated huge/negative numbers. */
  b.claims = (b.claims ?? []).filter((c) => {
    if (c.amount !== null && (c.amount < 0 || c.amount > 1e12)) {
      edits.push("Dropped claim with implausible amount");
      return false;
    }
    return true;
  });

  /* 8. Missing critical warnings: red severity must keep a lawyer step. */
  if (b.severity.level === "red") {
    const re = /lawyer|advocate|attorney|वकील|律师|avocat|juriste/i;
    for (const key of ["en", "hi", "zh", "fr"] as const) {
      if (!b.localized[key].next_steps.some((s) => re.test(s))) {
        warnings.push(`Red severity without explicit lawyer step in ${key.toUpperCase()}`);
      }
    }
  }

  /* 9. Confidence honesty (FEATURE 22): critical missing facts cap the headline. */
  const hasReceiptishCritical = b.facts.some((f) => f.key === "receipt_date");
  if (!hasReceiptishCritical && b.overall_confidence > 0.9) {
    b.overall_confidence = Math.min(b.overall_confidence, 0.85);
    edits.push("Headline confidence capped (critical date missing from document)");
  }
  if (b.overall_confidence > 0.95) {
    b.overall_confidence = 0.95;
    edits.push("Overall confidence capped to 0.95");
  }

  return { base: b, edits, warnings };
}
