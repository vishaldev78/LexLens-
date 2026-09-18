// LexLens — canonical jurisdiction detection (PRD §3).
//
// caseJurisdiction ∈ { INDIA, USA, UNKNOWN } — determined by multiple
// independent signals from the document text (country names, states, cities,
// statutes, citations, currency, addresses, courts, issuing authorities) and,
// when explicitly provided, the user's own selection. Signals are SCORED:
// strong and weak indicators on both sides; conflicting evidence of
// comparable strength resolves to UNKNOWN. The engine never guesses.

import type { CaseJurisdiction } from "./types";

interface SignalDef {
  pattern: RegExp;
  weight: number;
  label: string;
}

/** India indicators (PRD §3 examples + standard equivalents). */
const INDIA_SIGNALS: SignalDef[] = [
  { pattern: /\b(republic of\s+)?india\b/i, weight: 4, label: "India" },
  { pattern: /\bU\.?P\.?|\buttara\s+pradesh\b|\bbihar\b|\bjharkhand\b/i, weight: 3, label: "Indian state" },
  { pattern: /\bdelhi\b|\bmumbai\b|\bpatna\b|\bkolkata\b|\bchennai\b|\bbengaluru|\bhydrabad\b|\bhyderabad\b|\bnavi mumbai\b|\bthane\b|\bpune\b|\bnoida\b|\bgurgaon\b|\bgurugram\b|\bahmedabad\b|\bjaipur\b|\blucknow\b|\bkanpur\b|\bindore\b|\bnagpur\b|\bsurat\b|\bvadodara\b/i, weight: 2, label: "Indian city" },
  { pattern: /\b ₹\s?\d|\b₹\d|\binr\b|\brupees\b|\brupees?\s+\d|\brs\.?\s*\d/i, weight: 3, label: "Indian rupees (₹)" },
  { pattern: /\bnegotiable\s+instruments?\s+act\b|\bni\s+act\b/i, weight: 5, label: "Negotiable Instruments Act" },
  { pattern: /\bsection\s+138\b|\b§\s*138\b|\bsec\.?\s*138\b|\bधारा\s*138\b/i, weight: 4, label: "Section 138" },
  { pattern: /\bconsumer\s+protection\s+act\b/i, weight: 4, label: "Consumer Protection Act" },
  { pattern: /\b\bns\b\b|\bbharatiya\s+nyaya\s+sanhita\b|\bindian\s+penal\s+code\b|\bipc\b/i, weight: 4, label: "BNS / IPC" },
  { pattern: /\bcivil\s+procedure\s+code\b|\bcpc\b/i, weight: 4, label: "CPC" },
  { pattern: /\bmagistrate\b|\bhon'?ble\b|\bhigh\s+court\b|\bdistrict\s+court\b|\bsessions\s+court\b|\bconsumer\s+(commission|forum)\b/i, weight: 2, label: "Indian court/forum reference" },
  { pattern: /\badvocate\b|\benrolment\s+no\.?\s*[A-Z]{2,4}\//i, weight: 2, label: "Advocate enrolment" },
  { pattern: /[\u0900-\u097F]/, weight: 3, label: "Devanagari script" },
  { pattern: /\bpin\s*code\b|\b-\s?4\d{5}\b|\b-\s?1[01]\d{4}\b|\b-\s?[2-8]\d{5}\b/i, weight: 2, label: "Indian PIN code" },
  { pattern: /\bspeed\s?post\b|\bregistered\s+a\.?d\.?/i, weight: 2, label: "India Post dispatch" },
  { pattern: /\bsbi\b|\bstate\s+bank\s+of\s+india\b|\bhdfc\b|\bicici\b|\bpnb\b|\bpunjab\s+national\b|\baxis\s+bank\b|\bbaroda\b|\bcanara\b/i, weight: 3, label: "Indian bank" },
];

/** USA indicators (PRD §3 examples + standard equivalents). */
const USA_SIGNALS: SignalDef[] = [
  { pattern: /\bunited\s+states\b|\bu\.?\s?s\.?\s?(of\s+america)?\b(?!e\.)/i, weight: 4, label: "United States" },
  { pattern: /\bnew\s+york\b|\bcalifornia\b|\btexas\b|\bflorida\b|\billinois\b|\bpennsylvania\b|\bohio\b|\bgeorgia\b|\bnorth\s+carolina\b|\bnew\s+jersey\b|\bmassachusetts\b|\bwashington\s+state\b|\bcolorado\b|\barizona\b|\bmichigan\b|\bviginia\b|\bvirginia\b|\bnevada\b|\boregon\b/i, weight: 3, label: "US state" },
  { pattern: /\bbrooklyn\b|\bqueens\b|\bmanhattan\b|\bbuffalo\b|\bronkonkoma\b|\blos\s+angeles\b|\bsan\s+francisco\b|\bchicago\b|\bhouston\b|\bdallas\b|\bmiami\b|\batlanta\b|\bboston\b|\bseattle\b|\bdenver\b/i, weight: 2, label: "US city" },
  { pattern: /\busd\b|\b$\s?\d|\$\s?\d|\bu\.?s\.?\s+dollars?\b/i, weight: 2, label: "US dollars ($)" },
  { pattern: /\bfdcpa\b|\bfair\s+debt\s+collection\b/i, weight: 5, label: "FDCPA" },
  { pattern: /\b15\s+u\.?s\.?c\.?|\b1692[a-f]\b|\bu\.?s\.?c\.?\s+§?\s*1692/i, weight: 5, label: "U.S. Code citation" },
  { pattern: /\bregulation\s+f\b|\b12\s+c\.?f\.?r\.?|\b1006\.\d/i, weight: 4, label: "Regulation F / C.F.R." },
  { pattern: /\bcfpb\b|\bconsumer\s+financial\s+protection\b/i, weight: 4, label: "CFPB" },
  { pattern: /\bcplr\b|\bnew\s+york\s+(civil|general)\b|\bgbl\b/i, weight: 4, label: "New York statutes" },
  { pattern: /\bwage\s+garnishment\b|\bbank\s+levy\b/i, weight: 2, label: "US enforcement terms" },
  { pattern: /\bcivil\s+court\b|\bsupreme\s+court\s+of\s+the\s+state\b|\bdistrict\s+court\b|\bcounty\s+court\b|\bjustice\s+court\b/i, weight: 2, label: "US court reference" },
  { pattern: /\bdebt\s+collector\b/i, weight: 2, label: "US debt-collector disclosure" },
  { pattern: /\bzip\s*code\b|\b\d{5}(-\d{4})?\b(?=[^\d]*$)/i, weight: 1, label: "US ZIP code" },
];

export interface JurisdictionResult {
  country: CaseJurisdiction;
  region: string;
  confidence: number;
  userSelected: boolean;
  signals: string[];
  indiaScore: number;
  usaScore: number;
}

function scoreSignals(text: string, defs: SignalDef[]): { score: number; matched: string[] } {
  let score = 0;
  const matched: string[] = [];
  for (const d of defs) {
    if (d.pattern.test(text)) {
      score += d.weight;
      if (matched.length < 8) matched.push(d.label);
    }
  }
  return { score, matched };
}

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida",
  "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine",
  "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska",
  "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas",
  "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
];

function detectRegion(text: string, country: CaseJurisdiction): string {
  if (country === "USA") {
    for (const s of US_STATES) if (new RegExp(`\\b${s.replace(/ /g, "\\s+")}\\b`, "i").test(text)) return s;
    return "";
  }
  if (country === "INDIA") {
    const m = text.match(/\b(maharashtra|delhi|bihar|uttar pradesh|karnataka|tamil nadu|telangana|gujarat|rajasthan|west bengal|kerala|haryana|punjab|madhya pradesh|odisha|assam|jharkhand|chhattisgarh)\b/i);
    if (m) return m[1].replace(/\b\w/g, (c) => c.toUpperCase());
    const city = text.match(/\b(Mumbai|Delhi|Patna|Kolkata|Chennai|Bengaluru|Hyderabad|Pune|Noida|Jaipur|Lucknow|Indore|Ahmedabad)\b/i);
    if (city) return city[1];
    return "";
  }
  return "";
}

/**
 * Determine the canonical case jurisdiction.
 * @param noticeText the extracted notice text (untrusted data)
 * @param userSelected "INDIA" | "USA" | null — explicit user choice wins
 */
export function detectJurisdiction(noticeText: string, userSelected?: string | null): JurisdictionResult {
  const text = (noticeText ?? "").slice(0, 20_000);

  // Explicit user selection is authoritative (PRD §3: user-selected jurisdiction).
  if (userSelected === "INDIA" || userSelected === "USA") {
    return {
      country: userSelected,
      region: detectRegion(text, userSelected),
      confidence: 0.99,
      userSelected: true,
      signals: ["Selected by the user"],
      indiaScore: userSelected === "INDIA" ? 99 : 0,
      usaScore: userSelected === "USA" ? 99 : 0,
    };
  }

  const india = scoreSignals(text, INDIA_SIGNALS);
  const usa = scoreSignals(text, USA_SIGNALS);

  let country: CaseJurisdiction = "UNKNOWN";
  let confidence = 0;

  if (india.score > 0 && usa.score === 0) {
    country = "INDIA";
    confidence = Math.min(0.97, 0.6 + india.score * 0.05);
  } else if (usa.score > 0 && india.score === 0) {
    country = "USA";
    confidence = Math.min(0.97, 0.6 + usa.score * 0.04);
  } else if (india.score >= 3 * Math.max(usa.score, 1)) {
    country = "INDIA";
    confidence = 0.75;
  } else if (usa.score >= 3 * Math.max(india.score, 1)) {
    country = "USA";
    confidence = 0.75;
  }
  // Conflicting or absent evidence ⇒ UNKNOWN (PRD §3: do NOT guess).

  const signals =
    country === "INDIA" ? india.matched.slice(0, 4)
    : country === "USA" ? usa.matched.slice(0, 4)
    : [...india.matched.slice(0, 2), ...usa.matched.slice(0, 2)];

  return {
    country,
    region: country === "UNKNOWN" ? "" : detectRegion(text, country),
    confidence,
    userSelected: false,
    signals,
    indiaScore: india.score,
    usaScore: usa.score,
  };
}
