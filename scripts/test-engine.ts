// LexLens — engine unit tests (PRD §37 items 6–9).
// Run: bun run scripts/test-engine.ts
import { calculateStatutoryDeadline, isValidISO, addDaysISO, daysBetween } from "../src/lib/lexlens/deadline-engine";
import { detectJurisdiction } from "../src/lib/lexlens/jurisdiction";
import { CORPUS, findCitation, sourceMatchesCaseJurisdiction } from "../src/lib/lexlens/corpus";
import { classifyNotice, NOTICE_TYPE_LABELS, type CaseBase } from "../src/lib/lexlens/types";
import { validateAnalysis } from "../src/lib/lexlens/validator";
import { validateCaseFactConsistency, canonicalCaseFacts } from "../src/lib/lexlens/server/notices";
import { DEADLINE_RULES } from "../src/lib/lexlens/rules";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.error(`  ✗ ${name}`);
  }
}

/* ── §10 deadline engine ── */
console.log("Deadline engine (PRD §10)");
const india138 = DEADLINE_RULES.cheque_bounce[0];
check("India §138 rule exists with 15-day period", india138.period_days === 15 && india138.jurisdiction === "INDIA");
check("India §138 anchor is receipt_date (never notice_date)", india138.anchor_field === "receipt_date");
const dl1 = calculateStatutoryDeadline({ ruleId: india138.event_key, triggerDate: "2026-09-19", jurisdiction: "INDIA", statutoryPeriod: 15, sourceId: "in_ni_138" });
check("Receipt 2026-09-19 + 15 days → 2026-10-04", dl1.deadline === "2026-10-04" && dl1.status === "CALCULATED" && dl1.confidence === 1);
const dlMissing = calculateStatutoryDeadline({ ruleId: india138.event_key, triggerDate: null, jurisdiction: "INDIA", statutoryPeriod: 15 });
check("Missing trigger → deadline null + MISSING_REQUIRED_FACT", dlMissing.deadline === null && dlMissing.status === "MISSING_REQUIRED_FACT");
const dlUnknown = calculateStatutoryDeadline({ ruleId: india138.event_key, triggerDate: "2026-09-19", jurisdiction: "UNKNOWN", statutoryPeriod: 15 });
check("UNKNOWN jurisdiction → NO_RULE (no substantive deadline)", dlUnknown.status === "NO_RULE" && dlUnknown.deadline === null);
const usa = DEADLINE_RULES.debt_collection[0];
check("US FDCPA rule exists with 30-day period, USA only", usa.period_days === 30 && usa.jurisdiction === "USA");
check("India pack and US pack are disjoint", DEADLINE_RULES.cheque_bounce.every((r) => r.jurisdiction === "INDIA") && DEADLINE_RULES.debt_collection.every((r) => r.jurisdiction === "USA"));
check("No '30-day dispute window' phrasing for cheque_bounce (PRD §6)", !JSON.stringify(DEADLINE_RULES.cheque_bounce).match(/30[\s-]*(day|दिन)[\s-]*(dispute|recipient response|विवाद)/i));

/* ── §3 jurisdiction detection ── */
console.log("Jurisdiction detection (PRD §3)");
const inText = "LEGAL NOTICE UNDER SECTION 138 OF THE NEGOTIABLE INSTRUMENTS ACT, 1881. Rs. 85,000 drawn on State Bank of India, Mumbai. Advocate Amit Shenoy, Maharashtra.";
const inRes = detectJurisdiction(inText);
check("India notice → INDIA", inRes.country === "INDIA");
const usText = "ALLIED RECOVERY SYSTEMS LLC is a debt collector. FDCPA 15 U.S.C. §1692g validation. $2,340.55, Brooklyn NY 11221, Civil Court Kings County, New York.";
const usRes = detectJurisdiction(usText);
check("US notice → USA with New York region", usRes.country === "USA" && usRes.region === "New York");
const mixed = "SECTION 138 NEGOTIABLE INSTRUMENTS ACT Rs. 85,000 ... FDCPA 15 U.S.C. §1692g CPLR $2,340 New York Mumbai Maharashtra";
check("Conflicting signals → UNKNOWN (never guessed)", detectJurisdiction(mixed).country === "UNKNOWN");
check("Empty text → UNKNOWN", detectJurisdiction("").country === "UNKNOWN");
check("User selection overrides detection", detectJurisdiction(inText, "USA").country === "USA" && detectJurisdiction(inText, "USA").userSelected === true);

/* ── §5/§13 corpus firewall ── */
console.log("Corpus & source firewall (PRD §5/§13)");
check("Corpus has only INDIA/USA/GLOBAL sources", CORPUS.every((c) => ["INDIA", "USA", "USA-New_York", "GLOBAL"].includes(c.jurisdiction)));
const ni = findCitation("in_ni_138")!;
const fdc = findCitation("fdcpa_1692g")!;
const ny = findCitation("ny_cplr_320")!;
check("NI Act source rejected for a USA case", !sourceMatchesCaseJurisdiction(ni, "USA", "New York"));
check("FDCPA source rejected for an INDIA case", !sourceMatchesCaseJurisdiction(fdc, "INDIA", "Maharashtra"));
check("FDCPA source allowed for a USA case", sourceMatchesCaseJurisdiction(fdc, "USA", ""));
check("NY CPLR only for NY cases", !sourceMatchesCaseJurisdiction(ny, "USA", "") && sourceMatchesCaseJurisdiction(ny, "USA", "New York"));
check("No source passes on UNKNOWN cases", !sourceMatchesCaseJurisdiction(ni, "UNKNOWN", "") && !sourceMatchesCaseJurisdiction(fdc, "UNKNOWN", ""));

/* ── §14 classification ── */
console.log("Classification (PRD §14)");
const cls1 = classifyNotice("cheque_bounce", "INDIA", null);
check("India cheque notice → Cheque Dishonour / Section 138 Demand Notice", cls1.primary === "Cheque Dishonour" && cls1.subcategory === "Section 138 Demand Notice" && cls1.secondary === "Payment Demand");
check("India cheque notice is NOT labelled debt collection", cls1.primary.toLowerCase() !== "debt collection" && NOTICE_TYPE_LABELS.cheque_bounce === "Cheque Dishonour");
const cls2 = classifyNotice("debt_collection", "USA", true);
check("US debt notice (applicable) → Debt Collection / Debt Validation Notice", cls2.primary === "Debt Collection" && cls2.subcategory === "Debt Validation Notice");
const cls3 = classifyNotice("debt_collection", "USA", false);
check("US debt notice (not applicable) → Payment Demand", cls3.primary === "Payment Demand");
const cls4 = classifyNotice("debt_collection", "INDIA", null);
check("Indian payment demand never gets FDCPA classification", cls4.primary === "Payment Demand" && cls4.subcategory === null);

/* ── §5/§30 validator: jurisdiction firewall on claims ── */
console.log("Validator firewall (PRD §4/§5/§30)");
function makeBase(over: Partial<CaseBase>): CaseBase {
  return {
    notice_type: "cheque_bounce",
    jurisdiction: { country: "INDIA", region: "Maharashtra", confidence: 0.9, userSelected: false, signals: [] },
    debt_rule_applicable: null,
    language_detected: "en",
    language_unsupported: false,
    classification: cls1,
    sender: { name: "A. Shenoy", type: "law_firm" },
    recipient: { name: "R. Mehta" },
    facts: [],
    claims: [],
    stated_deadlines: [],
    citations: [{ source_id: "fdcpa_1692g", relevance: "wrong system" }, { source_id: "in_ni_138", relevance: "correct system" }],
    propositions: [{ text: "FDCPA gives a 30-day dispute window", source_id: "fdcpa_1692g", verified: true }],
    localized: {
      en: { summary: "s", key_risk: "You will definitely be arrested", rights: [], next_steps: ["Consult a lawyer"] },
      hi: { summary: "s", key_risk: "", rights: [], next_steps: ["वकील से सलाह लें"] },
    },
    severity: { level: "red", confidence: 0.8 },
    overall_confidence: 0.8,
    ...over,
  };
}
const v1 = validateAnalysis(makeBase({}));
check("US citation rejected in an India case", !v1.base.citations.some((c) => c.source_id === "fdcpa_1692g"));
check("India citation kept in an India case", v1.base.citations.some((c) => c.source_id === "in_ni_138"));
check("FDCPA proposition rejected in an India case", v1.base.propositions.every((p) => p.source_id !== "fdcpa_1692g"));
check("Absolute language softened", v1.base.localized.en.key_risk !== "You will definitely be arrested");
const v2 = validateAnalysis(makeBase({ jurisdiction: { country: "USA", region: "New York", confidence: 0.9, userSelected: false, signals: [] } }));
check("India citation rejected in a USA case", !v2.base.citations.some((c) => c.source_id === "in_ni_138"));
const v3 = validateAnalysis(makeBase({ jurisdiction: { country: "UNKNOWN", region: "", confidence: 0, userSelected: false, signals: [] } }));
check("UNKNOWN case keeps NO substantive citations", v3.base.citations.length === 0);

/* ── §8/§9 canonical facts & consistency ── */
console.log("Canonical facts & consistency (PRD §8/§9)");
const noticeStub = { noticeDate: new Date("2026-09-18T00:00:00Z"), receiptDate: new Date("2026-09-19T00:00:00Z"), jurisdiction: "INDIA", legalDomain: "CHEQUE_DISHONOUR" } as const;
const baseFacts = makeBase({});
baseFacts.facts = [
  { key: "notice_date", value: "2026-09-18", kind: "date", iso: "2026-09-18", num: null, currency: null, confidence: 0.9, source_ref: "header" },
  { key: "receipt_date", value: "2026-09-19", kind: "date", iso: "2026-09-19", num: null, currency: null, confidence: 0.9, source_ref: "paragraph 1" },
  { key: "amount", value: "85000", kind: "money", iso: null, num: 85000, currency: "INR", confidence: 0.9, source_ref: "subject" },
  { key: "cheque_number", value: "458721", kind: "text", iso: null, num: null, currency: null, confidence: 0.9, source_ref: "paragraph 1" },
  { key: "bank_name", value: "State Bank of India", kind: "text", iso: null, num: null, currency: null, confidence: 0.9, source_ref: "paragraph 1" },
  { key: "cheque_date", value: "2026-09-05", kind: "date", iso: "2026-09-05", num: null, currency: null, confidence: 0.9, source_ref: "paragraph 1" },
  { key: "dishonour_date", value: "2026-09-10", kind: "date", iso: "2026-09-10", num: null, currency: null, confidence: 0.9, source_ref: "paragraph 2" },
];
const cf = canonicalCaseFacts(noticeStub, baseFacts, null);
check("Canonical noticeReceivedDate = 2026-09-19", cf.noticeReceivedDate === "2026-09-19");
check("Canonical facts carry cheque/bank/amount", cf.chequeNumber === "458721" && cf.bankName === "State Bank of India" && cf.amount === 85000 && cf.currency === "INR");
check("Canonical jurisdiction INDIA + legalDomain CHEQUE_DISHONOUR", cf.jurisdiction === "INDIA" && cf.legalDomain === "CHEQUE_DISHONOUR");
let threw = false;
try {
  validateCaseFactConsistency(
    { receiptDate: new Date("2026-09-19T00:00:00Z") },
    { inputs: { receipt_date: { value: "2026-09-25", iso: "2026-09-25", num: null, at: 0 } }, position: null, evidence: [], draft: null },
    null,
  );
} catch {
  threw = true;
}
check("Contradicting receipt dates FAIL validation (PRD §9)", threw);
let threw2 = false;
try {
  validateCaseFactConsistency(
    { receiptDate: new Date("2026-09-19T00:00:00Z") },
    { inputs: { receipt_date: { value: "2026-09-19", iso: "2026-09-19", num: null, at: 0 } }, position: null, evidence: [], draft: null },
    baseFacts,
  );
} catch {
  threw2 = true;
}
check("Consistent receipt dates pass", !threw2);

/* ── date helpers ── */
console.log("Date helpers");
check("isValidISO rejects garbage", !isValidISO("2026-13-40") && isValidISO("2026-09-19"));
check("addDaysISO crosses months", addDaysISO("2026-09-19", 15) === "2026-10-04");
check("daysBetween sign", daysBetween("2026-09-19", "2026-10-04") === 15 && daysBetween("2026-10-04", "2026-09-19") === -15);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
