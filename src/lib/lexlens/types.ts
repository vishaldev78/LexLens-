// LexLens — v2 core types ("evidence-backed legal notice action engine").
//
// Architecture (FEATURE 20): the LLM only EXTRACTS (facts, classification,
// plain-language explanation, drafts). Everything legal-procedural — deadline
// math, missing-data detection, verification states, action prioritisation,
// timeline assembly, safety validation — is deterministic code (rules.ts,
// deadline-engine.ts, case-engine.ts, validator.ts).

export type SeverityLevel = "red" | "yellow" | "green";
export type Locale = "en" | "hi" | "zh" | "fr";
export const OUTPUT_LOCALES: Locale[] = ["en", "hi", "zh", "fr"];

/** Localized string quad used by every deterministic template. */
export type L4 = Record<Locale, string>;

export type NoticeType =
  | "debt_collection"
  | "cheque_bounce"
  | "eviction"
  | "consumer"
  | "tax"
  | "employment"
  | "court_summons"
  | "other";

export interface Jurisdiction {
  country: string; // ISO-ish: US, IN, ES, UK, ...
  region: string;
  confidence: number;
}

/* ───────────────────────── verification model (FEATURE 7) ───────────────────────── */

export type FactStatus =
  | "document_verified" // extracted from the notice text itself
  | "source_verified"   // backed by a corpus statute
  | "user_confirmed"    // provided by the user
  | "inferred"          // AI inference — needs confirmation
  | "unknown";          // absent / unknowable

export type SourceKind = "document" | "legal_corpus" | "user_input" | "derived" | "none";

export interface SourceRef {
  kind: SourceKind;
  ref: string | null;        // e.g. "Notice · subject line" | corpus title | "User input"
  source_id?: string | null; // corpus source_id when kind === "legal_corpus"
}

export type FactKind = "date" | "money" | "number" | "text";
export type Importance = "critical" | "high" | "medium";

/* ───────────────────────── LLM extraction contract (FEATURE 21) ───────────────────────── */

/** A fact the model found IN the document. Only present facts — never invented. */
export interface ExtractedFact {
  key: string;              // canonical key (notice_date, amount, receipt_date, cheque_number...)
  value: string;            // human display value
  kind: FactKind;
  iso: string | null;       // dates only: YYYY-MM-DD
  num: number | null;       // money/number only
  currency: string | null;  // money only
  confidence: number;       // per-fact confidence (FEATURE 22)
  source_ref: string;       // where in the document, e.g. "paragraph 2"
}

export interface ExtractedClaim {
  text: string;
  amount: number | null;
  currency: string | null;
  source_ref: string | null;
}

/** What the notice SAYS about a response period — NOT a calculated deadline. */
export interface StatedDeadline {
  description: string;
  period_days: number | null;
  anchor: "receipt" | "notice" | "filing" | "explicit" | null;
  explicit_date: string | null; // YYYY-MM-DD when the notice states a fixed date
  source_ref: string | null;
}

/** Corpus-verified proposition (FEATURE 21: no source_id ⇒ not verified). */
export interface Proposition {
  text: string;
  source_id: string | null;
  verified: boolean;
}

export interface Citation {
  source_id: string;
  relevance: string;
}

export interface LocalizedRight {
  title: string;
  detail: string;
  source_id: string | null;
}

export interface LocalizedBlock {
  summary: string;
  key_risk: string;
  rights: LocalizedRight[];
  next_steps: string[];
}

export interface LocalizedTexts {
  en: LocalizedBlock;
  hi: LocalizedBlock;
  zh: LocalizedBlock;
  fr: LocalizedBlock;
}

/** Base analysis produced by the LLM engine OR the offline engine. */
export interface CaseBase {
  notice_type: NoticeType;
  jurisdiction: Jurisdiction;
  language_detected: string;
  sender: { name: string; type: string };
  recipient: { name: string | null };
  facts: ExtractedFact[];
  claims: ExtractedClaim[];
  stated_deadlines: StatedDeadline[];
  citations: Citation[];
  propositions: Proposition[];
  localized: LocalizedTexts;
  severity: { level: SeverityLevel; confidence: number };
  overall_confidence: number;
}

export interface AnalyzeResponse {
  base: CaseBase | null;
  processing_ms: number;
  pipeline_meta: {
    notice_chars: number;
    corpus_size: number;
    confidence_capped: boolean;
    safety_edits: string[];
    model: string;
    fallback: boolean;
  };
  error?: string;
}

/* ───────────────────────── deterministic case view (client) ───────────────────────── */

export interface UserInputValue {
  value: string;
  iso: string | null; // dates
  num: number | null; // numbers
  at: number;
}

export type UserPosition =
  | "agree"
  | "partial_dispute"
  | "full_dispute"
  | "already_paid"
  | "dont_recognize"
  | "unknown";

export interface UploadedEvidence {
  id: string;
  name: string;
  size: number;
  type: string;
  addedAt: number;
}

/** Everything the user changed on top of the base analysis. */
export interface UserCaseState {
  inputs: Record<string, UserInputValue>; // keyed by canonical field
  position: UserPosition | null;
  evidence: UploadedEvidence[];
  draft: { text: string; source: "ai" | "template"; at: number } | null;
}

export function emptyUserState(): UserCaseState {
  return { inputs: {}, position: null, evidence: [], draft: null };
}

/** One row of the unified fact table (document facts + user inputs + gaps). */
export interface CaseFact {
  key: string;
  label: string; // resolved in the active locale
  value: string | null;
  kind: FactKind;
  currency: string | null;
  status: FactStatus;
  confidence: number | null;
  source: SourceRef;
  importance: Importance;
  feeds_deadline: boolean;
}

export interface MissingField {
  field: string;
  label: string;
  importance: Importance;
  why: string; // resolved in the active locale
  input: "date" | "text" | "number";
  feeds_deadline: boolean;
  source_id: string | null;
}

export interface DeadlineCalc {
  event_key: string;
  label: string;
  description: string; // localized "15 days from receipt of the notice" style line
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
  missing_reason: string | null; // localized, when status === missing_input
  source_ref: SourceRef | null;
}

export interface TimelineEvent {
  key: string;
  label: string;
  date: string | null;
  status: "confirmed" | "estimated" | "requires_input";
  source: SourceRef;
  confidence: number | null;
  order: number;
}

export interface EvidenceRow {
  key: string;
  label: string;
  have: boolean;
  from_upload: boolean;
  claim_link: string | null; // localized "supports: the ₹85,000 claim"
  uploads: UploadedEvidence[];
}

export interface ActionItem {
  key: string;
  title: string;
  reason: string;
  priority: number; // 1 = do first
  source: SourceRef;
  done?: boolean;
}

export interface ConsequenceStep {
  key: string;
  text: string;
  tone: "neutral" | "warning" | "danger";
}

export interface LawyerQuestion {
  key: string;
  text: string;
}

/* ───────────────────────── assembled case view ───────────────────────── */

export interface CaseView {
  base: CaseBase;
  user: UserCaseState;
  type_label: string;
  jurisdiction_label: string;
  facts: CaseFact[];
  missing: MissingField[];
  deadlines: DeadlineCalc[];
  timeline: TimelineEvent[];
  evidence: EvidenceRow[];
  actions: ActionItem[];
  consequences: ConsequenceStep[];
  questions: LawyerQuestion[];
  position: UserPosition | null;
}

/* ───────────────────────── case archive (localStorage) ───────────────────────── */

export interface CaseRecord {
  id: string;
  label: string;
  createdAt: number;
  updatedAt: number;
  base: CaseBase;
  user: UserCaseState;
}

/* ───────────────────────── labels & meta ───────────────────────── */

export interface CorpusEntry {
  source_id: string;
  jurisdiction: string;
  title: string;
  text: string;
}

export const LOCALE_LABELS: Record<Locale, { label: string; short: string; native: string }> = {
  en: { label: "English", short: "EN", native: "English" },
  hi: { label: "Hindi", short: "हिं", native: "हिन्दी" },
  zh: { label: "Chinese", short: "中文", native: "中文" },
  fr: { label: "French", short: "FR", native: "Français" },
};

export const SEVERITY_META: Record<
  SeverityLevel,
  { label: string; blurb: string; ring: string; bg: string; border: string; text: string; dot: string }
> = {
  red: {
    label: "Critical",
    blurb: "Court / criminal exposure or an imminent deadline. Act now.",
    ring: "ring-red-200",
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    dot: "bg-red-500",
  },
  yellow: {
    label: "Action needed",
    blurb: "A formal demand with a real deadline. Do not ignore it.",
    ring: "ring-amber-200",
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    dot: "bg-amber-500",
  },
  green: {
    label: "Informational",
    blurb: "No immediate legal exposure detected.",
    ring: "ring-emerald-200",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
  },
};

export const NOTICE_TYPE_LABELS: Record<string, string> = {
  debt_collection: "Debt collection",
  cheque_bounce: "Cheque bounce (NI Act)",
  eviction: "Eviction / tenancy",
  consumer: "Consumer dispute",
  tax: "Tax notice",
  employment: "Employment",
  court_summons: "Court summons",
  other: "Other notice",
};

export const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", hi: "Hindi", zh: "Chinese", fr: "French", es: "Spanish",
  pt: "Portuguese", de: "German", ar: "Arabic", ur: "Urdu", ta: "Tamil",
  bn: "Bengali", it: "Italian", nl: "Dutch",
};

/** Deadline urgency for chips — never colour alone, always a text label (FEATURE 3). */
export type UrgencyLevel = "critical" | "urgent" | "upcoming" | "none";
