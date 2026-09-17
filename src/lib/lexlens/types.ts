// LexLens — core analysis types (mirrors the PRD/TRD structured-output schema)

export type SeverityLevel = "red" | "yellow" | "green";

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
  region: string; // state / city / "Federal"
  confidence: number;
}

export interface Demand {
  demand: string;
  amount: number | null;
  currency: string | null; // USD | INR | EUR | GBP | ...
}

export interface Deadline {
  action: string;
  date: string | null; // YYYY-MM-DD when stated or derivable
  days_from_today: number | null;
  consequence_if_missed: string;
  legal_basis_source_id: string | null;
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

export type Locale = "en" | "hi" | "es";

export interface LocalizedTexts {
  en: LocalizedBlock;
  hi: LocalizedBlock;
  es: LocalizedBlock;
}

export interface Analysis {
  notice_type: NoticeType;
  jurisdiction: Jurisdiction;
  language_detected: string; // ISO 639-1
  sender: { name: string; type: string };
  demands: Demand[];
  deadlines: Deadline[];
  severity: { level: SeverityLevel; confidence: number };
  citations: Citation[];
  localized: LocalizedTexts;
  overall_confidence: number;
}

export interface AnalyzeResponse {
  analysis: Analysis | null;
  processing_ms: number;
  pipeline_meta: {
    notice_chars: number;
    corpus_size: number;
    confidence_capped: boolean;
    safety_edits: string[];
    model: string;
  };
  error?: string;
}

export interface CorpusEntry {
  source_id: string;
  jurisdiction: string;
  title: string;
  text: string;
}

export const LOCALE_LABELS: Record<Locale, { label: string; short: string }> = {
  en: { label: "English", short: "EN" },
  hi: { label: "हिन्दी", short: "हिं" },
  es: { label: "Español", short: "ES" },
};

export const SEVERITY_META: Record<
  SeverityLevel,
  { label: string; blurb: string; ring: string; bg: string; text: string; dot: string }
> = {
  red: {
    label: "Critical",
    blurb: "Court / criminal exposure or an imminent deadline. Act now.",
    ring: "ring-red-500/40",
    bg: "bg-red-500/10",
    text: "text-red-300",
    dot: "bg-red-400",
  },
  yellow: {
    label: "Action needed",
    blurb: "A formal demand with a real deadline. Do not ignore it.",
    ring: "ring-amber-500/40",
    bg: "bg-amber-500/10",
    text: "text-amber-300",
    dot: "bg-amber-400",
  },
  green: {
    label: "Informational",
    blurb: "No immediate legal exposure detected.",
    ring: "ring-emerald-500/40",
    bg: "bg-emerald-500/10",
    text: "text-emerald-300",
    dot: "bg-emerald-400",
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
  en: "English",
  hi: "Hindi",
  es: "Spanish",
  fr: "French",
  pt: "Portuguese",
  de: "German",
  ar: "Arabic",
  ur: "Urdu",
  ta: "Tamil",
  bn: "Bengali",
  it: "Italian",
  nl: "Dutch",
};
