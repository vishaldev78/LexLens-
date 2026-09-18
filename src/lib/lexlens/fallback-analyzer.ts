// LexLens — Offline Demo Engine v2 (fallback analyzer).
// Rule-based extractor used when the LLM backend is unreachable (local VS Code
// run without SDK credentials, transient network failure). Produces the exact
// same CaseBase schema as the LLM path so the deterministic case engine, UI
// and tests behave identically. Never invents dates or amounts it cannot find.
// EN/HI only (PRD §2); jurisdiction is canonical via detectJurisdiction (§3).

import type { CaseBase, ExtractedClaim, ExtractedFact, LocalizedBlock, NoticeType, StatedDeadline } from "./types";

/* ───────────────────────── small utils ───────────────────────── */

const num = (s: string) => Number(s.replace(/[, ]/g, ""));

function detectLanguage(t: string): string {
  const devanagari = (t.match(/[\u0900-\u097F]/g) ?? []).length;
  if (devanagari > t.length * 0.05) return "hi";
  return "en";
}

function findAmount(t: string): { amount: number; currency: string } | null {
  const inr = t.match(/(?:rs\.?|₹|inr|रु\.?|रुपये?)\s*([0-9][0-9,]*(?:\.[0-9]+)?)/i);
  if (inr) return { amount: num(inr[1].replace(/,/g, "")), currency: "INR" };
  const usd = t.match(/\$\s*([0-9][0-9,]*(?:\.[0-9]{2})?)/);
  if (usd) return { amount: num(usd[1].replace(/,/g, "")), currency: "USD" };
  return null;
}

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7,
  august: 8, september: 9, sept: 9, october: 10, november: 11, december: 12,
  janvari: 1, farvari: 2, march_chaitra: 3, aprail: 4, mee: 5, joon: 6, joorai: 7,
  agast: 8, sitambar: 9, aktubar: 10, navambar: 11, disambar: 12,
};

/** Parse the date formats our demos + most notices use. Returns YYYY-MM-DD. */
export function parseHumanDate(s: string): string | null {
  const t = s.trim();
  let m: RegExpMatchArray | null;
  // ISO
  if ((m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/))) return t;
  // 13 September 2026
  if ((m = t.match(/(\d{1,2})\s*([A-Za-z]+)\s*(\d{4})/))) {
    const mo = MONTHS[m[2].toLowerCase()];
    if (mo) return `${m[3]}-${String(mo).padStart(2, "0")}-${String(Number(m[1])).padStart(2, "0")}`;
  }
  // September 13, 2026
  if ((m = t.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/))) {
    const mo = MONTHS[m[1].toLowerCase()];
    if (mo) return `${m[3]}-${String(mo).padStart(2, "0")}-${String(Number(m[2])).padStart(2, "0")}`;
  }
  // 17/09/2026 or 17.09.2026 (assume DD/MM)
  if ((m = t.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/))) {
    const dd = Number(m[1]);
    const mo = Number(m[2]);
    if (mo >= 1 && mo <= 12 && dd >= 1 && dd <= 31) return `${m[3]}-${String(mo).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }
  return null;
}

/** Locate a match's position for a human source_ref ("header", "paragraph 3"). */
function refFor(text: string, index: number): string {
  const before = text.slice(0, index);
  const paras = before.split(/\n\s*\n/).length;
  if (index < 400 && /^date\s*:/im.test(before.slice(-120) + text.slice(index, index + 60))) return "header";
  return `paragraph ${paras}`;
}

const WORDNUM: Record<string, number> = { one: 1, two: 2, three: 3, five: 5, seven: 7, ten: 10, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fortyfive: 45, sixty: 60, ninety: 90, pandrah: 15, bees: 20, tees: 30 };

function parsePeriod(text: string): { days: number; anchor: "receipt" | "notice" | "explicit" } | null {
  const re = /within\s+([a-z]+|\d+)\s*(?:\((\d+)\))?\s*(?:calendar|business)?\s*days?\s*(.*?)(?:[.;]|\n|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const w = m[1].toLowerCase().replace(/[^a-z0-9]/g, "");
    let days = /^\d+$/.test(w) ? Number(w) : (WORDNUM[w] ?? null);
    if (days === null && m[2]) days = Number(m[2]);
    if (!days) continue;
    const tail = (m[3] ?? "").toLowerCase();
    if (/receip|receiv|प्राप्त/i.test(tail)) return { days, anchor: "receipt" };
    if (/this notice|of this notice|नोटिस की तारीख/i.test(tail) && !/receip|receiv/i.test(tail)) return { days, anchor: "notice" };
    return { days, anchor: "receipt" };
  }
  return null;
}

/* ───────────────────────── classification ───────────────────────── */

function classify(t: string): NoticeType {
  if (/section\s*138|धारा\s*138|negotiable\s*instruments|परिवहनीय\s*उपकरण|cheque|चेक|check\s*no/i.test(t)) return "cheque_bounce";
  if (/debt\s*collect|collection\s*(letter|agency|notice)|fdcpa|creditor|recover.*debt|settle.*balance/i.test(t)) return "debt_collection";
  if (/consumer\s*(protection|complaint|commission)|defective\s*goods|deficient\s*service/i.test(t)) return "consumer";
  if (/summons|appear.*court|plaint|writ|समन/i.test(t)) return "court_summons";
  if (/evict|tenancy|landlord|rent.*due|unpaid\s*rent/i.test(t)) return "eviction";
  return "other";
}

function findSender(text: string, type: NoticeType): { name: string; type: string } {
  const advocate = text.match(/\n\s*\(?([A-Z][A-Za-z. '&]+?)\)?\s*\n\s*Advocate/i);
  if (advocate) return { name: advocate[1].trim(), type: "law_firm" };
  const adv2 = text.match(/([A-Z][A-Za-z. '&]+),?\s*Advocate/i);
  if (adv2) return { name: adv2[1].replace(/^(Advocate)\s*/i, "").trim(), type: "law_firm" };
  const collector = text.match(/^([A-Z][A-Z& .]+ (?:LLC|INC|LTD))\s*$/m);
  if (collector) return { name: collector[1].trim(), type: "debt_collector" };
  const firm = text.match(/^([A-Z][A-Za-z&.,' ]+(?:LLC|Pvt\.? Ltd\.?|Ltd\.?|Traders|Associates))\b/m);
  if (firm) return { name: firm[1].trim(), type: "company" };
  return { name: "Unknown", type: "unknown" };
}

function findRecipient(text: string): string | null {
  const to = text.match(/To,?\s*\n?\s*(?:Mr\.?|Ms\.?|Mrs\.?|श्री|श्रीमती)\s*([A-Z\u0900-\u097F][A-Za-z\u0900-\u097F ]+)\n/i);
  if (to) return `${to[0].replace(/^To,?\s*\n?\s*/i, "").split(",")[0].trim()}`;
  const dear = text.match(/Dear\s+(?:Mr\.?|Ms\.?)\s+([A-Za-z ]+)[,:]/);
  if (dear) return `Mr. ${dear[1].trim()}`;
  return null;
}

/* ───────────────────────── per-kit localized explanation blocks (EN/HI) ───────────────────────── */

function block(sum: Record<Locale2, string>, risk: Record<Locale2, string>, steps: Record<Locale2, string[]>): Record<Locale2, LocalizedBlock> {
  return {
    en: { summary: sum.en, key_risk: risk.en, rights: [], next_steps: steps.en },
    hi: { summary: sum.hi, key_risk: risk.hi, rights: [], next_steps: steps.hi },
  };
}
type Locale2 = "en" | "hi";

function localizedFor(type: NoticeType, sender: string, amountStr: string | null, jurisdiction: string): Record<Locale2, LocalizedBlock> {
  const who = sender && sender !== "Unknown" ? sender : "";
  const blocks: Partial<Record<NoticeType, Record<Locale2, LocalizedBlock>>> = {
    cheque_bounce: block(
      {
        en: `A legal notice under Section 138 of the Negotiable Instruments Act has been sent on behalf of ${who || "a claimant"}. It demands payment of ${amountStr ?? "a stated amount"} for a dishonoured cheque within 15 days of receiving the notice. If the statutory conditions are satisfied and payment is not made in that window, the payee may file a criminal complaint under Sections 138 and 142.`,
        hi: `${who || "एक दावेदार"} की ओर से धारा 138 (परिवहनीय उपकरण अधिनियम) के अंतर्गत कानूनी नोटिस भेजा गया है। यह ${amountStr ?? "बताई गई राशि"} का भुगतान, नोटिस प्राप्ति से 15 दिनों के भीतर, अनादरित चेक के लिए मांगता है। यदि वैधानिक शर्तें पूरी हों और इस अवधि में भुगतान न हो, तो लाभार्थी धारा 138 व 142 के तहत आपराधिक शिकायत कर सकता है।`,
      },
      {
        en: "While the cheque amount remains unpaid, the notice carries criminal exposure under Section 138 NI Act.",
        hi: "चेक राशि बकाया रहने तक इस नोटिस में धारा 138 के अंतर्गत आपराधिक जोखिम बना रहता है।",
      },
      {
        en: ["Confirm the date you actually received the notice — the 15-day window runs from receipt.", "Verify the cheque number, bank and amount against your own records.", "Gather the cheque copy, bank return memo and underlying invoice.", "Consult a qualified lawyer before the payment window closes."],
        hi: ["पुष्टि करें कि नोटिस वास्तव में कब प्राप्त हुआ — 15-दिन की अवधि प्राप्ति से चलती है।", "चेक संख्या, बैंक और राशि अपने रिकॉर्ड से जांचें।", "चेक प्रति, बैंक रिटर्न मेमो और मूल इनवॉइस इकट्ठा करें।", "भुगतान अवधि समाप्त होने से पहले योग्य वकील से सलाह लें।"],
      },
    ),
    debt_collection: block(
      {
        en: `${who || "The sender"} claims you owe ${amountStr ?? "a balance"} on a referenced account. If the federal debt-collection rule applies, you may dispute the debt — or any part — in writing within 30 days of receiving this notice, which suspends collection until the debt is verified. If the debt is not resolved, the letter threatens referral to court.`,
        hi: `${who || "प्रेषक"} का कहना है कि आप पर ${amountStr ?? "एक राशि"} बकाया है। यदि संघीय कर्ज-वसूली नियम लागू होता है, तो आप नोटिस प्राप्ति से 30 दिनों के भीतर लिखित रूप में विवाद कर सकते हैं — तब तक वसूली रुक जाती है जब तक कर्ज सत्यापित न हो। समाधान न होने पर पत्र अदालत जाने की बात करता है।`,
      },
      {
        en: "If a court action is filed and goes unanswered, a money judgment may be entered for the demanded amount.",
        hi: "यदि अदालती कार्रवाई हो और जवाब न दिया जाए, तो मांगी गई राशि पर धन-आदेश हो सकता है।",
      },
      {
        en: ["Confirm when you received the letter — the response window runs from receipt.", "Dispute in writing within the window if any part is wrong; request verification and the original creditor's details.", "Match the claimed balance to your own statements.", "Contact a lawyer or legal-aid clinic if a court action actually arrives."],
        hi: ["पुष्टि करें कि पत्र कब मिला — जवाबी अवधि प्राप्ति से चलती है।", "यदि कोई भाग गलत है तो अवधि में लिखित विवाद करें; सत्यापन व मूल लेनदार विवरण मांगें।", "दावे वाली राशि अपने विवरण से मिलाएँ।", "अदालती कार्रवाई होने पर वकील या लीगल-एड से संपर्क करें।"],
      },
    ),
  };
  const generic = block(
    {
      en: `This appears to be a formal legal notice from ${who || "a sender"} in ${jurisdiction}. It makes demands that may carry deadlines, so treat the dates in the text as important and respond through an appropriate written channel.`,
      hi: `यह ${who || "एक प्रेषक"} की ओर से ${jurisdiction} का औपचारिक कानूनी नोटिस प्रतीत होता है। इसमें ऐसी मांगें हो सकती हैं जिनकी समा-सीमाएँ हों — अतः पाठ में दी तिथियों को महत्व दें और उचित लिखित माध्यम से जवाब दें।`,
    },
    {
      en: "Formal legal notices can carry deadlines whose breach has legal consequences.",
      hi: "औपचारिक कानूनी नोटिस में ऐसी समा-सीमाएँ हो सकती हैं जिनकी अवहेलना के कानूनी परिणाम हो सकते हैं।",
    },
    {
      en: ["Note every date and deadline stated in the notice.", "Gather documents related to the matter.", "Respond in writing within the stated period.", "Seek legal advice on your specific situation."],
      hi: ["नोटिस में दी हर तिथि व समा-सीमा नोट करें।", "मामले से जुड़े दस्तावेज़ इकट्ठा करें।", "बताई गई अवधि में लिखित जवाब दें।", "अपनी स्थिति पर कानूनी सलाह लें।"],
    },
  );
  const chosen = blocks[type] ?? generic;
  return chosen;
}

/* ───────────────── deterministic fact extraction (shared) ─────────────────
 * Pure regex extraction of canonical facts from the notice text. Used by the
 * offline engine AND as a safety net over the LLM extraction (the model can
 * miss facts; regex never does). Only extracts what is actually present. */
export function extractDeterministicFacts(t: string): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  const amount = findAmount(t);
  const amountStr = amount
    ? amount.currency === "INR"
      ? `₹${new Intl.NumberFormat("en-IN").format(amount.amount)}`
      : `$${new Intl.NumberFormat("en-US").format(amount.amount)}`
    : null;
  const headerDate = t.match(/^date\s*:\s*(.+)$/im);
  if (headerDate) {
    const iso = parseHumanDate(headerDate[1]);
    if (iso) facts.push({ key: "notice_date", value: iso, kind: "date", iso, num: null, currency: null, confidence: 0.85, source_ref: "header" });
  }
  if (amount) {
    facts.push({ key: "amount", value: amountStr ?? String(amount.amount), kind: "money", iso: null, num: amount.amount, currency: amount.currency, confidence: 0.88, source_ref: "subject line" });
  }
  const cheque = t.match(/cheque(?:\s+bearing)?\s+no\.?\s*[:#]?\s*(\d{4,})|चेक\s+संख्या\s*[:#]?\s*(\d{4,})/i);
  const chequeNo = cheque?.[1] ?? cheque?.[2] ?? null;
  if (chequeNo && cheque) facts.push({ key: "cheque_number", value: chequeNo, kind: "text", iso: null, num: null, currency: null, confidence: 0.85, source_ref: refFor(t, cheque.index ?? 0) });
  const chequeDate = t.match(/(?:cheque|चेक)[^.\n]{0,40}?(?:dated|दिनांक)\s+([0-9]{1,2}\s+\w+\s+\d{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i);
  if (chequeDate) {
    const iso = parseHumanDate(chequeDate[1]);
    if (iso) facts.push({ key: "cheque_date", value: iso, kind: "date", iso, num: null, currency: null, confidence: 0.8, source_ref: refFor(t, chequeDate.index ?? 0) });
  }
  const bank = t.match(/drawn on\s+([A-Z][A-Za-z .&]+?Bank[A-Za-z .]*)/i) ?? t.match(/\b(sbi|state bank of india|hdfc|icici|axis|punjab national|bank of baroda)\b/i);
  if (bank) facts.push({ key: "bank_name", value: (bank[1] ?? bank[0]).trim(), kind: "text", iso: null, num: null, currency: null, confidence: 0.8, source_ref: refFor(t, bank.index ?? 0) });
  const present = t.match(/present(?:ment|ed)?[^.\n]{0,40}?(?:on|dated)\s+([0-9]{1,2}\s+\w+\s+\d{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i);
  if (present) {
    const iso = parseHumanDate(present[1]);
    if (iso) facts.push({ key: "presentation_date", value: iso, kind: "date", iso, num: null, currency: null, confidence: 0.8, source_ref: refFor(t, present.index ?? 0) });
  }
  const dishonour = t.match(/dishonour(?:ed)?[^.\n]{0,80}?(?:dated|दिनांक)\s+([0-9]{1,2}\s+\w+\s+\d{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i);
  if (dishonour) {
    const iso = parseHumanDate(dishonour[1]);
    if (iso) facts.push({ key: "dishonour_date", value: iso, kind: "date", iso, num: null, currency: null, confidence: 0.82, source_ref: refFor(t, dishonour.index ?? 0) });
  }
  const receipt = t.match(/(?:received(?:\s+under\s+acknowledg(?:e)?ment)?|पावती\s+पर[^.\n]{0,20})\s*(?:on|को)?\s+([0-9]{1,2}\s+\w+\s+\d{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i);
  if (receipt) {
    const iso = parseHumanDate(receipt[1]);
    if (iso) facts.push({ key: "receipt_date", value: iso, kind: "date", iso, num: null, currency: null, confidence: 0.9, source_ref: refFor(t, receipt.index ?? 0) });
  }
  const invoice = t.match(/invoice\s*(?:no\.?|number)?\s*[:#]?\s*([A-Z0-9][A-Z0-9/-]{3,})/i);
  if (invoice) facts.push({ key: "invoice_number", value: invoice[1], kind: "text", iso: null, num: null, currency: null, confidence: 0.8, source_ref: refFor(t, invoice.index ?? 0) });
  const origCred = t.match(/original creditor\s*:\s*([^\n]+)/i);
  if (origCred) facts.push({ key: "original_creditor", value: origCred[1].split(/—|--/)[0].trim(), kind: "text", iso: null, num: null, currency: null, confidence: 0.85, source_ref: refFor(t, origCred.index ?? 0) });
  const account = t.match(/account\s*(?:no\.?|number|ending)\s*[:#]?\s*(\d{4,}[0-9xX*]*)/i);
  if (account) facts.push({ key: "account_number", value: account[1], kind: "text", iso: null, num: null, currency: null, confidence: 0.8, source_ref: refFor(t, account.index ?? 0) });
  return facts;
}

/* ───────────────────────── main entry ───────────────────────── */

export function offlineAnalyze(text: string): CaseBase {
  const t = text;
  const type = classify(t);
  const lang = detectLanguage(t);
  const amount = findAmount(t);
  const amountStr = amount
    ? amount.currency === "INR"
      ? `₹${new Intl.NumberFormat("en-IN").format(amount.amount)}`
      : `$${new Intl.NumberFormat("en-US").format(amount.amount)}`
    : null;

  const facts = extractDeterministicFacts(t);

  // stated deadline
  const period = parsePeriod(t);
  const stated: StatedDeadline[] = period
    ? [{ description: "Response period as stated in the notice text", period_days: period.days, anchor: period.anchor, explicit_date: null, source_ref: null }]
    : [];

  const sender = findSender(t, type);
  const citations: { source_id: string; relevance: string }[] = [];
  if (type === "cheque_bounce" || /§?\s*138|negotiable/i.test(t)) citations.push({ source_id: "in_ni_138", relevance: "Dishonour of a cheque triggers the 15-day payment window before a §138/§142 complaint." });
  if (type === "debt_collection" || /debt collector|fdcpa/i.test(t)) citations.push({ source_id: "fdcpa_1692g", relevance: "Validation notice: 30-day written dispute and verification rights." });
  if (type === "consumer") citations.push({ source_id: "in_cpa_s35", relevance: "District Commission complaint route and two-year limitation." });
  if (type === "court_summons") citations.push({ source_id: "in_cpc_o9r6", relevance: "Non-appearance can lead to ex-parte proceedings." });
  if (/default judgment|wage garnishment/i.test(t)) citations.push({ source_id: "ny_cplr_320", relevance: "Default judgment for the demanded amount can be enforced by garnishment." });

  const jurisdiction_label = "the applicable jurisdiction";
  const localized = localizedFor(type, sender.name, amountStr, jurisdiction_label);

  // per-type severity (deterministic rubric mirrors the LLM one)
  const severity = type === "cheque_bounce" ? "red" : "yellow";

  return {
    notice_type: type,
    jurisdiction: { country: "UNKNOWN", region: "", confidence: 0, userSelected: false, signals: [] }, // canonical detection runs in runAnalysis
    debt_rule_applicable: null,
    language_detected: lang,
    language_unsupported: false,
    classification: { primary: "Other notice", subcategory: null, secondary: null },
    sender,
    recipient: { name: findRecipient(t) },
    facts,
    claims: amount
      ? ([{ text: `Pay ${amountStr} (as stated in the notice)`, amount: amount.amount, currency: amount.currency, source_ref: "subject line" }] as ExtractedClaim[])
      : [],
    stated_deadlines: stated,
    citations,
    propositions: [],
    localized,
    severity: { level: severity as CaseBase["severity"]["level"], confidence: 0.7 },
    overall_confidence: type === "other" ? 0.55 : 0.68,
  };
}
