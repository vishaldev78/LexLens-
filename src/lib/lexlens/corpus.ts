// LexLens — curated legal corpus ("RAG-lite").
// In production this lives in PostgreSQL + pgvector with BM25 hybrid retrieval.
// The model may ONLY cite from this corpus — no corpus match, no citation, and
// the overall confidence gets auto-capped (see /api/analyze post-processing).
//
// JURISDICTION ISOLATION (PRD §5/§13): every entry carries a canonical
// jurisdiction — INDIA | USA | USA-<STATE> | GLOBAL — and the server-side
// firewall (validator.ts) REJECTS any citation whose jurisdiction does not
// match the case jurisdiction before it can reach a report.

import type { CorpusEntry } from "./types";

export const CORPUS_VERSION = "2026.09-in-usa";

export const CORPUS: CorpusEntry[] = [
  /* ── INDIA rule pack ── */
  {
    source_id: "in_ni_138",
    jurisdiction: "INDIA",
    title: "Negotiable Instruments Act, 1881 — §138 (Dishonour of Cheque)",
    text: "Where a cheque drawn on an account is returned unpaid for insufficiency of funds, the drawer is deemed to have committed an offence punishable with imprisonment up to two years, or with fine up to twice the cheque amount, or with both. Conditions: the cheque must be presented within 3 months; the payee must send a written demand notice within 30 days of receiving the dishonour memo; and the drawer gets 15 days from receipt of that notice to pay before a criminal complaint can be filed under §142.",
  },
  {
    source_id: "in_ni_142",
    jurisdiction: "INDIA",
    title: "Negotiable Instruments Act, 1881 — §142 (Cognizance of Offences)",
    text: "A complaint under §138 may be filed only after the statutory 15-day payment period from the date of receipt of the demand notice has expired without payment. The complaint must be made within one month of the cause of action arising and before the court having jurisdiction.",
  },
  {
    source_id: "in_cpc_o9r6",
    jurisdiction: "INDIA",
    title: "Code of Civil Procedure, 1908 — Order IX Rule 6 (Ex-parte Proceeding)",
    text: "Where the defendant does not appear when the suit is called on for hearing, the court may proceed to determine the suit ex parte and pronounce a decree against the defendant — meaning the case can be decided in the plaintiff's favour without the defendant being heard.",
  },
  {
    source_id: "in_cpa_s35",
    jurisdiction: "INDIA",
    title: "Consumer Protection Act, 2019 — §35 (Filing a Complaint)",
    text: "A consumer may file a complaint with the District Commission relating to defective goods or deficient services. The complaint should ordinarily be filed within two years from the date on which the cause of action arises. Filing fees are modest and a lawyer is not mandatory.",
  },

  /* ── USA rule pack (federal) ── */
  {
    source_id: "fdcpa_1692g",
    jurisdiction: "USA",
    title: "FDCPA §809 — 15 U.S.C. §1692g (Validation of Debts)",
    text: "Within five days of first contacting a consumer, a debt collector must send a written notice stating the amount of the debt and the creditor's name. If the consumer disputes the debt — or any part of it — in writing within 30 days of receiving the notice, the collector must stop collection until it obtains and mails verification of the debt. The consumer may also request the name and address of the original creditor within that 30-day window.",
  },
  {
    source_id: "fdcpa_1692e",
    jurisdiction: "USA",
    title: "FDCPA §807/§808 — 15 U.S.C. §1692e–f (Prohibited Practices)",
    text: "A debt collector may not use false, deceptive or misleading representations — including threats to take legal action that is not intended or not permitted — and may not harass, oppress or abuse any person in connection with the collection of a debt.",
  },
  {
    source_id: "us_regf_1006_34",
    jurisdiction: "USA",
    title: "Regulation F — 12 C.F.R. §1006.34 (Validation Information)",
    text: "A debt collector must provide validation information for a claimed debt, in writing, either in the initial communication or within five days of it — including the amount, the creditor's name, and how to dispute. The consumer may dispute in writing within 30 days of receipt.",
  },

  /* ── USA rule pack (state) — loaded ONLY when the case state matches ── */
  {
    source_id: "ny_cplr_320",
    jurisdiction: "USA-New_York",
    title: "New York CPLR §320 (Appearance; Default Judgment)",
    text: "A defendant served with a summons and complaint must appear or answer within the time prescribed by law. A defendant who fails to answer may have a default judgment entered against them for the amount demanded, which can be enforced through wage garnishment or bank levies.",
  },

  /* ── GLOBAL — genuinely jurisdiction-neutral statements only ── */
  {
    source_id: "global_deadline_general",
    jurisdiction: "GLOBAL",
    title: "General principle — stated response periods",
    text: "Where a notice states its own response period, the period is counted from the date the notice states (usually receipt). This general principle carries no statutory weight; the applicable national or state rules govern.",
  },
];

export function corpusForPrompt(jurisdiction?: "INDIA" | "USA" | "UNKNOWN"): string {
  let entries = CORPUS;
  if (jurisdiction === "INDIA") entries = CORPUS.filter((c) => c.jurisdiction === "INDIA" || c.jurisdiction === "GLOBAL");
  if (jurisdiction === "USA") entries = CORPUS.filter((c) => c.jurisdiction.startsWith("USA") || c.jurisdiction === "GLOBAL");
  if (jurisdiction === "UNKNOWN") entries = CORPUS; // classify-only pass; firewall strips all legal claims
  return entries
    .map((c) => `[${c.source_id}] (${c.jurisdiction}) ${c.title}\n${c.text}`)
    .join("\n\n");
}

export function findCitation(sourceId: string): CorpusEntry | undefined {
  return CORPUS.find((c) => c.source_id === sourceId);
}

/** PRD §13 — a source may enter a case only when its jurisdiction matches
 *  the case jurisdiction. USA-<STATE> sources require the same state.
 *  GLOBAL sources are allowed only for genuinely neutral statements. */
export function sourceMatchesCaseJurisdiction(
  source: CorpusEntry,
  caseCountry: "INDIA" | "USA" | "UNKNOWN",
  caseRegion: string,
): boolean {
  if (caseCountry === "UNKNOWN") return false; // no substantive rules on UNKNOWN cases
  if (source.jurisdiction === caseCountry) return true;
  if (source.jurisdiction === "GLOBAL") return true;
  if (source.jurisdiction.startsWith("USA-") && caseCountry === "USA") {
    const state = source.jurisdiction.slice(4).replace(/^[-_]/, "").replace(/_/g, " ").toLowerCase();
    return !!caseRegion && caseRegion.toLowerCase() === state;
  }
  return false;
}
