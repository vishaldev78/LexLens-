// LexLens — deterministic legal rule packs ("keep legal rules separate from
// LLM prompts", FEATURE 20). Each supported notice family defines:
//   • deadline rules (anchor field + statutory period + corpus source)
//   • required facts and why they matter (missing-information detector)
//   • evidence checklist templates mapped to claims
//   • corpus-verified rights (no fabricated rights — FEATURE 8/9)
//   • conditional action templates, procedural consequences, lawyer questions
//   • a fallback response-draft template with placeholders (FEATURE 14)
// All consumer-facing strings are localized EN/HI — the two supported
// languages (PRD §2). Legal facts stay language-neutral.

import type { DeadlineRule } from "./deadline-engine";
import type { Importance, L4, NoticeType, UserPosition } from "./types";

export const l4 = (en: string, hi: string): L4 => ({ en, hi });

/* ───────────────────────── canonical fact labels ───────────────────────── */

export const FACT_LABELS: Record<string, L4> = {
  amount: l4("Claimed amount", "मांगी गई राशि"),
  notice_date: l4("Notice date", "नोटिस की तारीख"),
  receipt_date: l4("Notice receipt date", "नोटिस प्राप्ति की तारीख"),
  cheque_number: l4("Cheque number", "चेक संख्या"),
  cheque_date: l4("Cheque date", "चेक की तारीख"),
  bank_name: l4("Drawee bank", "बैंक"),
  presentation_date: l4("Cheque presented on", "चेक प्रस्तुति तिथि"),
  dishonour_date: l4("Dishonour date", "अनादरण तिथि"),
  invoice_number: l4("Invoice reference", "इनवॉइस संदर्भ"),
  original_creditor: l4("Original creditor", "मूल लेनदार"),
  account_number: l4("Account reference", "खाता संदर्भ"),
  monthly_rent: l4("Monthly rent", "मासिक किराया"),
  rent_months: l4("Unpaid months", "बकाया महीने"),
  contract_date: l4("Contract date", "अनुबंध तिथि"),
  court_notification_date: l4("Lawsuit notification date", "मुकदमा अधिसूचना तिथि"),
  hearing_date: l4("Hearing / appearance date", "सुनवाई / उपस्थिति तिथि"),
  court_name: l4("Court / forum", "न्यायालय / मंच"),
  cause_of_action_date: l4("Date of the problem", "विवाद की तारीख"),
  purchase_date: l4("Purchase date", "खरीद तिथि"),
  interest_rate: l4("Interest claimed", "ब्याज दर"),
  case_number: l4("Case / reference number", "मामला / संदर्भ संख्या"),
};

/* ───────────────────────── required fields + why they matter ───────────────────────── */

export interface RequiredField {
  field: string;
  importance: Importance;
  input: "date" | "text" | "number";
  feeds_deadline: boolean;
  why: L4;
  source_id: string | null;
}

const WHY_RECEIPT_138 = l4("The 15-day statutory payment window under NI Act §138 runs from RECEIPT of the notice — not from its date — so the exact deadline cannot be calculated until the receipt date is known.", "धारा 138 के तहत 15 दिन की वैधानिक भुगतान अवधि नोटिस की तारीख से नहीं, बल्कि नोटिस प्राप्त होने की तारीख से चलती है — इसलिए प्राप्ति तिथि ज्ञात होने तक सटीक समा-सीमा की गणना नहीं की जा सकती।");

export const REQUIRED_FIELDS: Record<string, RequiredField[]> = {
  cheque_bounce: [
    { field: "receipt_date", importance: "critical", input: "date", feeds_deadline: true, why: WHY_RECEIPT_138, source_id: "in_ni_138" },
    { field: "dishonour_date", importance: "high", input: "date", feeds_deadline: false, why: l4("Needed to verify the statutory timeline (the demand notice must follow the dishonour memo within 30 days).", "वैधानिक समय-रेखा जांचने के लिए आवश्यक (अनादरण मेमो के 30 दिनों के भीतर मांग-नोटिस भेजा जाना अनिवार्य है)।"), source_id: "in_ni_138" },
    { field: "cheque_number", importance: "high", input: "text", feeds_deadline: false, why: l4("Needed to verify the claim against the underlying cheque.", "दावे को मूल चेक से मिलान करने के लिए आवश्यक।"), source_id: null },
    { field: "bank_name", importance: "medium", input: "text", feeds_deadline: false, why: l4("Identifies the drawee bank for verification of the dishonour.", "अनादरण सत्यापन के लिए बैंक पहचानने हेतु।"), source_id: null },
  ],
  debt_collection: [
    { field: "receipt_date", importance: "critical", input: "date", feeds_deadline: true, why: l4("The applicable response period runs from RECEIPT of the notice — the exact deadline cannot be calculated until the receipt date is known.", "जवाबी अवधि नोटिस प्राप्ति की तारीख से चलती है — प्राप्ति तिथि ज्ञात होने तक सटीक समा-सीमा की गणना नहीं की जा सकती।"), source_id: null },
    { field: "original_creditor", importance: "medium", input: "text", feeds_deadline: false, why: l4("Confirms whose debt is being collected — you may request it in writing within the 30-day window.", "पुष्टि करता है कि किसका कर्ज है — 30 दिन की अवधि में लिखित अनुरोध किया जा सकता है।"), source_id: "fdcpa_1692g" },
    { field: "account_number", importance: "medium", input: "text", feeds_deadline: false, why: l4("Needed to match the claimed debt to your own records.", "दावे को अपने रिकॉर्ड से मिलाने हेतु।"), source_id: null },
  ],

  consumer: [
    { field: "cause_of_action_date", importance: "high", input: "date", feeds_deadline: true, why: l4("A complaint to the District Commission should ordinarily be filed within two years of the cause of action.", "जिला आयोग में शिकायत सामान्यतः विवाद उत्पन्न होने के दो वर्ष के भीतर दर्ज की जानी चाहिए।"), source_id: "in_cpa_s35" },
  ],
  court_summons: [
    { field: "hearing_date", importance: "critical", input: "date", feeds_deadline: true, why: l4("The date by which you must appear or answer — missing it can lead to a default decision.", "उपस्थित होने या जवाब देने की तिथि — चूकने पर एकपक्षीय निर्णय हो सकता है।"), source_id: "in_cpc_o9r6" },
    { field: "court_name", importance: "medium", input: "text", feeds_deadline: false, why: l4("Identifies the court handling the matter.", "मामला संभालने वाले न्यायालय की पहचान।"), source_id: null },
  ],
};

/* ───────────────────────── deadline rules ───────────────────────── */

export const DEADLINE_RULES: Record<string, DeadlineRule[]> = {
  cheque_bounce: [
    {
      event_key: "statutory_payment_window",
      period_days: 15,
      anchor_field: "receipt_date",
      business_days: false,
      source_id: "in_ni_138",
      jurisdiction: "INDIA",
      origin: "statute_rule",
      label: l4("Statutory payment window (NI Act §138)", "वैधानिक भुगतान अवधि (धारा 138)"),
      description: l4("15 days from receipt of the notice (NI Act §138). The 30-day period mentioned in §138 concerns when the PAYEE must send the demand notice after the dishonour — it is not a dispute right for the recipient.", "नोटिस प्राप्ति से 15 दिन (धारा 138)। §138 में उल्लिखित 30-दिन की अवधि प्राप्तकर्ता को नहीं, बल्कि लाभार्थी को अनादरण के बाद नोटिस भेजने से संबंधित है — यह प्राप्तकर्ता का विवाद-अधिकार नहीं है।"),
    },
  ],
  debt_collection: [
    {
      event_key: "dispute_window",
      period_days: 30,
      anchor_field: "receipt_date",
      business_days: false,
      source_id: "fdcpa_1692g",
      jurisdiction: "USA",
      origin: "statute_rule",
      label: l4("Written dispute window (FDCPA §1692g)", "लिखित विवाद अवधि (FDCPA §1692g)"),
      description: l4("30 days from receipt of the notice: dispute in writing to suspend collection until the debt is verified.", "नोटिस प्राप्ति से 30 दिन: लिखित विवाद करने पर कर्ज सत्यापित होने तक वसूली रुक जाती है।"),
    },
  ],
  consumer: [
    {
      event_key: "complaint_limitation",
      period_days: 730,
      anchor_field: "cause_of_action_date",
      business_days: false,
      source_id: "in_cpa_s35",
      jurisdiction: "INDIA",
      origin: "statute_rule",
      label: l4("Complaint limitation (CPA 2019 §35)", "शिकायत समय-सीमा (CPA 2019 §35)"),
      description: l4("A complaint to the District Commission should ordinarily be filed within two years from the cause of action.", "जिला आयोग में शिकायत सामान्यतः विवाद उत्पन्न होने से दो वर्ष के भीतर दर्ज की जानी चाहिए।"),
    },
  ],
  court_summons: [
    {
      event_key: "appearance_deadline",
      period_days: null,
      anchor_field: "explicit",
      business_days: false,
      source_id: "in_cpc_o9r6",
      jurisdiction: "INDIA",
      origin: "statute_rule",
      label: l4("Appearance / answer deadline", "उपस्थिति / जवाब समा-सीमा"),
      description: l4("Appear or answer by the date stated in the summons; failing to appear can lead to an ex-parte decision.", "सम्मन में दी गई तिथि तक उपस्थित हों या जवाब दें; अनुपस्थिति पर एकपक्षीय निर्णय हो सकता है।"),
    },
  ],
};

/** Generic fallback rule built from what the notice itself states. */
export function genericStatedRule(): DeadlineRule {
  return {
    event_key: "stated_deadline",
    period_days: null,
    anchor_field: "receipt_date",
    business_days: false,
    source_id: null,
    jurisdiction: "INDIA",
    origin: "notice_stated",
    label: l4("Deadline stated in the notice", "नोटिस में दी गई समा-सीमा"),
    description: l4("The notice states its own response period. LexLens only turns it into a calendar date once the anchor date is confirmed.", "नोटिस अपनी जवाबी अवधि बताता है। LexLens उसे कैलेंडर तिथि में तभी बदलता है जब आधार तिथि पुष्ट हो।"),
  };
}

/* ───────────────────────── evidence checklist (FEATURE 6) ───────────────────────── */

export interface EvidenceTemplate {
  key: string;
  label: L4;
  claim_link: L4 | null;
  have: boolean;
}

export const EVIDENCE_TEMPLATES: Record<string, EvidenceTemplate[]> = {
  cheque_bounce: [
    { key: "legal_notice", label: l4("Legal notice (this document)", "कानूनी नोटिस (यह दस्तावेज़)"), claim_link: null, have: true },
    { key: "cheque_copy", label: l4("Cheque image / copy", "चेक की प्रति"), claim_link: l4("Supports verifying the claimed cheque", "दावे वाले चेक को सत्यापित करने में सहायक"), have: false },
    { key: "bank_return_memo", label: l4("Bank return / dishonour memo", "बैंक रिटर्न मेमो"), claim_link: l4("Required to prove the dishonour", "अनादरण सिद्ध करने के लिए आवश्यक"), have: false },
    { key: "invoice_agreement", label: l4("Invoice / underlying agreement", "इनवॉइस / मूल अनुबंध"), claim_link: l4("Supports the debt the cheque was issued for", "चेक जिस देनदारी के लिए था, उसे सिद्ध करता है"), have: false },
    { key: "payment_receipt", label: l4("Payment receipts (if already paid)", "भुगतान रसीदें (यदि भुगतान हो चुका है)"), claim_link: null, have: false },
  ],
  debt_collection: [
    { key: "collection_letter", label: l4("Collection letter (this document)", "वसूली पत्र (यह दस्तावेज़)"), claim_link: null, have: true },
    { key: "account_statements", label: l4("Account / card statements", "खाता / कार्ड विवरण"), claim_link: l4("Supports verifying the claimed balance", "दावे वाली राशि सत्यापित करने में सहायक"), have: false },
    { key: "prior_correspondence", label: l4("Prior correspondence with creditor", "लेनदार से पिछला पत्राचार"), claim_link: null, have: false },
    { key: "payment_records", label: l4("Payment records (if any)", "भुगतान रिकॉर्ड (यदि कोई हो)"), claim_link: null, have: false },
  ],

  consumer: [
    { key: "notice_document", label: l4("Notice (this document)", "नोटिस (यह दस्तावेज़)"), claim_link: null, have: true },
    { key: "invoice_warranty", label: l4("Invoice / warranty documents", "इनवॉइस / वारंटी दस्तावेज़"), claim_link: null, have: false },
    { key: "complaint_correspondence", label: l4("Complaint correspondence", "शिकायत पत्राचार"), claim_link: null, have: false },
  ],
  court_summons: [
    { key: "summons_document", label: l4("Summons (this document)", "सम्मन (यह दस्तावेज़)"), claim_link: null, have: true },
    { key: "case_documents", label: l4("Case / plaint documents", "मामला / वाद दस्तावेज़"), claim_link: null, have: false },
  ],
};

const GENERIC_EVIDENCE: EvidenceTemplate[] = [
  { key: "notice_document", label: l4("Notice (this document)", "नोटिस (यह दस्तावेज़)"), claim_link: null, have: true },
  { key: "supporting_documents", label: l4("Your own supporting documents", "आपके सहायक दस्तावेज़"), claim_link: null, have: false },
  { key: "payment_records", label: l4("Payment / account records", "भुगतान / खाता रिकॉर्ड"), claim_link: null, have: false },
];

export function evidenceFor(type: NoticeType): EvidenceTemplate[] {
  return EVIDENCE_TEMPLATES[type] ?? GENERIC_EVIDENCE;
}

/* ───────────────────────── timeline templates (FEATURE 4) ───────────────────────── */

export interface TimelineTemplate {
  key: string;
  label: L4;
  /** date field it draws from, or "derived" for the deadline event */
  field: string | "derived";
  order: number;
}

export const TIMELINE_TEMPLATES: Record<string, TimelineTemplate[]> = {
  cheque_bounce: [
    { key: "cheque_issued", label: l4("Cheque issued", "चेक जारी"), field: "cheque_date", order: 1 },
    { key: "cheque_presented", label: l4("Cheque presented", "चेक प्रस्तुत"), field: "presentation_date", order: 2 },
    { key: "cheque_dishonoured", label: l4("Cheque dishonoured", "चेक अनादरित"), field: "dishonour_date", order: 3 },
    { key: "notice_issued", label: l4("Legal notice issued", "कानूनी नोटिस जारी"), field: "notice_date", order: 4 },
    { key: "notice_received", label: l4("Notice received", "नोटिस प्राप्त"), field: "receipt_date", order: 5 },
    { key: "payment_window", label: l4("15-day payment window", "15-दिन की भुगतान अवधि"), field: "derived", order: 6 },
  ],
  debt_collection: [
    { key: "notice_sent", label: l4("Collection notice sent", "वसूली नोटिस भेजा"), field: "notice_date", order: 1 },
    { key: "notice_received", label: l4("Notice received", "नोटिस प्राप्त"), field: "receipt_date", order: 2 },
    { key: "dispute_window", label: l4("30-day dispute window", "30-दिन विवाद अवधि"), field: "derived", order: 3 },
  ],

  consumer: [
    { key: "purchase", label: l4("Purchase / service", "खरीद / सेवा"), field: "purchase_date", order: 1 },
    { key: "problem", label: l4("Problem arose", "समस्या उत्पन्न"), field: "cause_of_action_date", order: 2 },
    { key: "notice_issued", label: l4("Notice issued", "नोटिस जारी"), field: "notice_date", order: 3 },
  ],
  court_summons: [
    { key: "summons_issued", label: l4("Summons issued", "सम्मन जारी"), field: "notice_date", order: 1 },
    { key: "summons_received", label: l4("Summons received", "सम्मन प्राप्त"), field: "receipt_date", order: 2 },
    { key: "hearing", label: l4("Hearing / answer due", "सुनवाई / जवाब देय"), field: "hearing_date", order: 3 },
  ],
};

const GENERIC_TIMELINE: TimelineTemplate[] = [
  { key: "notice_issued", label: l4("Notice issued", "नोटिस जारी"), field: "notice_date", order: 1 },
  { key: "notice_received", label: l4("Notice received", "नोटिस प्राप्त"), field: "receipt_date", order: 2 },
  { key: "deadline", label: l4("Response deadline", "जवाबी समा-सीमा"), field: "derived", order: 3 },
];

export function timelineFor(type: NoticeType): TimelineTemplate[] {
  return TIMELINE_TEMPLATES[type] ?? GENERIC_TIMELINE;
}

/* ───────────────────────── corpus-verified rights (FEATURE 8/9) ───────────────────────── */

export interface RightTemplate {
  title: L4;
  detail: L4;
  source_id: string;
}

export const RIGHTS: Record<string, RightTemplate[]> = {
  cheque_bounce: [
    {
      source_id: "in_ni_138",
      title: l4("Pay within 15 days of receipt to close the §138 exposure", "प्राप्ति के 15 दिन के भीतर भुगतान करें"),
      detail: l4("If the statutory requirements are satisfied and the amount is paid within 15 days of receiving the notice, no criminal complaint under §138 can be filed for that cheque.", "यदि वैधानिक शर्तें पूरी हों और नोटिस प्राप्ति के 15 दिन के भीतर राशि चुका दी जाए, तो उस चेक के लिए धारा 138 के अंतर्गत आपराधिक शिकायत दर्ज नहीं की जा सकती।"),
    },
    {
      source_id: "in_ni_138",
      title: l4("§138 applies only when the claimant met their own conditions", "§138 तभी लागू होता है जब दावेदार ने अपनी शर्तें पूरी की हों"),
      detail: l4("The statute requires that the cheque was presented within 3 months and that the demand notice was sent within 30 days of the dishonour memo. Whether those conditions are met can be checked from your documents.", "कानून यह मांगता है कि चेक 3 महीने के भीतर प्रस्तुत हो और अनादरण मेमो के 30 दिन के भीतर मांग-नोटिस भेजा जाए। ये शर्तें पूरी हुईं या नहीं, यह आपके दस्तावेज़ों से जांचा जा सकता है।"),
    },
  ],
  debt_collection: [
    {
      source_id: "fdcpa_1692g",
      title: l4("Dispute in writing within 30 days of receipt", "प्राप्ति के 30 दिन के भीतर लिखित विवाद"),
      detail: l4("If you dispute the debt — or any part of it — in writing within 30 days of receiving the notice, the collector must stop collection until it obtains and mails verification of the debt.", "यदि आप नोटिस प्राप्ति के 30 दिन के भीतर कर्ज — या उसके किसी भाग — को लिखित रूप में विवादित करते हैं, तो कलेक्टर को सत्यापन मिलने और भेजे जाने तक वसूली रोकनी होगी।"),
    },
    {
      source_id: "fdcpa_1692g",
      title: l4("Request the original creditor's details", "मूल लेनदार का विवरण मांगें"),
      detail: l4("Upon written request within the same 30-day window, the collector must provide the name and address of the original creditor.", "उसी 30-दिन की अवधि में लिखित अनुरोध पर, कलेक्टर को मूल लेनदार का नाम और पता देना होगा।"),
    },
    {
      source_id: "fdcpa_1692e",
      title: l4("Protection against false or abusive collection tactics", "झूठी या दुर्व्यवहारपूर्ण वसूली से सुरक्षा"),
      detail: l4("The FDCPA prohibits false, deceptive or misleading representations and harassment — including threats of legal action that is not intended or not permitted.", "FDCPA झूठे, भ्रामक वक्तव्य और उत्पीड़न प्रतिबंधित करता है — जिनमें वे कानूनी कार्रवाइयों की धमकियाँ भी हैं जो की जाने वाली नहीं हैं या अनुमत नहीं हैं।"),
    },
  ],

  consumer: [
    {
      source_id: "in_cpa_s35",
      title: l4("File a complaint with the District Commission", "जिला आयोग में शिकायत दर्ज करें"),
      detail: l4("A consumer may file a complaint with the District Commission relating to defective goods or deficient services, ordinarily within two years from the cause of action; a lawyer is not mandatory.", "उपभोक्ता जिला आयोग में दोषपूर्ण माल या घटिया सेवा संबंधी शिकायत दर्ज कर सकता है — सामान्यतः विवाद के दो वर्ष के भीतर; वकील अनिवार्य नहीं है।"),
    },
  ],
  court_summons: [
    {
      source_id: "in_cpc_o9r6",
      title: l4("The right to be heard before any decision", "किसी भी निर्णय से पहले सुनवाई का अधिकार"),
      detail: l4("If you appear and answer, the court decides the case with your participation. Ex-parte proceedings (decided without you) are only possible when a party does not appear when the suit is called on for hearing.", "यदि आप उपस्थित होकर जवाब देते हैं, तो अदालत आपकी भागीदारी के साथ मामला तय करती है। एकपक्षीय कार्रवाई (आपके बिना निर्णय) तभी संभव है जब पक्षकार सुनवाई पर उपस्थित न हो।"),
    },
  ],
};

/* ───────────────────────── procedural consequences (FEATURE 11) ───────────────────────── */

export interface ConsequenceTemplate {
  key: string;
  tone: "neutral" | "warning" | "danger";
  text: L4;
}

export const CONSEQUENCES: Record<string, ConsequenceTemplate[]> = {
  cheque_bounce: [
    {
      key: "window_passes",
      tone: "warning",
      text: l4("If the amount is not paid within the 15-day window and the statutory requirements are otherwise satisfied, the payee may file a criminal complaint under §138 read with §142 of the NI Act.", "यदि 15-दिन की अवधि में राशि भुगतान नहीं होती और अन्य वैधानिक शर्तें पूरी होती हैं, तो लाभार्थी धारा 138 (धारा 142 सहित) के अंतर्गत आपराधिक शिकायत दर्ज कर सकता है।"),
    },
    {
      key: "prosecution",
      tone: "danger",
      text: l4("If such a complaint is filed and the offence is proved, the court may impose imprisonment up to two years, a fine up to twice the cheque amount, or both.", "यदि ऐसी शिकायत दर्ज हो और अपराध सिद्ध हो, तो अदालत दो वर्ष तक की कैद, चेक राशि के दोगुने तक का जुर्माना, या दोनों का दंड दे सकती है।"),
    },
    {
      key: "civil_recovery",
      tone: "neutral",
      text: l4("Separately, the outstanding amount may still be pursued through civil recovery regardless of the criminal track.", "अलग से, आपराधिक रास्ते के बावजूद बकाया राशि की नागरिक वसूली की जा सकती है।"),
    },
  ],
  debt_collection: [
    {
      key: "collection_continues",
      tone: "warning",
      text: l4("If the debt is not disputed or resolved, collection activity may continue and the matter may be referred to a court.", "यदि कर्ज विवादित या सुलझाया नहीं जाता, तो वसूली जारी रह सकती है और मामला अदालत जा सकता है।"),
    },
    {
      key: "judgment",
      tone: "danger",
      text: l4("If a lawsuit is filed and goes unanswered, a default judgment may be entered for the amount demanded, which can be enforced through wage garnishment or bank levies.", "यदि मुकदमा दर्ज हो और जवाब न दिया जाए, तो मांगी गई राशि पर पूर्वनिर्णय (default judgment) हो सकता है, जिसे वेतन कटौती या बैंक ज़ब्ती से लागू किया जा सकता है।"),
    },
  ],

  court_summons: [
    {
      key: "ex_parte",
      tone: "danger",
      text: l4("If you do not appear when the suit is called on for hearing, the court may proceed ex parte and decide the case without hearing your side.", "यदि सुनवाई पर आप उपस्थित नहीं होते, तो अदालत एकपक्षीय कार्रवाई कर आपकी सुनवाई के बिना निर्णय दे सकती है।"),
    },
  ],
};

const GENERIC_CONSEQUENCES: ConsequenceTemplate[] = [
  {
    key: "no_action",
    tone: "warning",
    text: l4("If no response is made within the stated period, the sender may consider further legal steps. What those steps are depends on the notice type and the applicable rules.", "यदि बताई गई अवधि में जवाब नहीं दिया जाता, तो भेजने वाला आगे कानूनी कदम उठा सकता है। वे कदम क्या होंगे, यह नोटिस के प्रकार और लागू नियमों पर निर्भर करता है।"),
  },
];

export function consequencesFor(type: NoticeType): ConsequenceTemplate[] {
  return CONSEQUENCES[type] ?? GENERIC_CONSEQUENCES;
}

/* ───────────────────────── action engine (FEATURE 1) ───────────────────────── */

export interface ActionCtx {
  type: NoticeType;
  severity: "red" | "yellow" | "green";
  missing: string[]; // canonical fields missing
  deadline_calculated: boolean;
  min_days_left: number | null;
  has_amount: boolean;
  position: UserPosition | null;
}

export interface ActionTemplate {
  key: string;
  priority: number;
  when: (ctx: ActionCtx) => boolean;
  title: L4;
  reason: L4;
  source_id: string | null;
}

export const ACTION_TEMPLATES: Record<string, ActionTemplate[]> = {
  cheque_bounce: [
    {
      key: "confirm_receipt", priority: 1, source_id: "in_ni_138",
      when: (c) => c.missing.includes("receipt_date"),
      title: l4("Confirm when the notice was received", "पुष्टि करें कि नोटिस कब प्राप्त हुआ"),
      reason: l4("The statutory response period depends on receipt of the notice, so the exact deadline cannot be calculated until this date is confirmed.", "वैधानिक जवाबी अवधि नोटिस प्राप्ति पर निर्भर है, इसलिए यह तिथि पुष्ट हुए बिना सटीक समा-सीमा नहीं निकल सकती।"),
    },
    {
      key: "verify_cheque", priority: 2, source_id: null,
      when: () => true,
      title: l4("Verify the cheque and bank details", "चेक और बैंक विवरण जांचें"),
      reason: l4("Check the cheque number, date, bank and amount against your own records before responding to the claim.", "दावे का जवाब देने से पहले चेक संख्या, तारीख, बैंक और राशि अपने रिकॉर्ड से मिलाएँ।"),
    },
    {
      key: "preserve_documents", priority: 3, source_id: null,
      when: () => true,
      title: l4("Preserve all relevant documents", "सभी प्रासंगिक दस्तावेज़ सुरक्षित रखें"),
      reason: l4("Keep the cheque, invoices, bank memos and this notice — they are the evidence base for any response or defence.", "चेक, इनवॉइस, बैंक मेमो और यह नोटिस संभालकर रखें — यही जवाब या बचाव का साक्ष्य आधार हैं।"),
    },
    {
      key: "act_before_deadline", priority: 4, source_id: "in_ni_138",
      when: (c) => c.deadline_calculated,
      title: l4("Decide before the deadline: pay or prepare a response", "समा-सीमा से पहले तय करें: भुगतान या जवाब"),
      reason: l4("Paying the claimed amount within the statutory window closes the §138 exposure; otherwise a written response through a lawyer is the usual next step.", "वैधानिक अवधि में राशि चुकाने से §138 का जोखिम समाप्त हो जाता है; अन्यथा अगला सामान्य कदम वकील के जरिए लिखित जवाब है।"),
    },
    {
      key: "consult_lawyer", priority: 5, source_id: "in_ni_138",
      when: (c) => c.severity === "red",
      title: l4("Review the claim with a qualified lawyer", "योग्य वकील से दावा समीक्षा कराएँ"),
      reason: l4("§138 notices carry criminal exposure while unpaid — a lawyer should review the documents before the window closes.", "§138 नोटिस में अवैतनिक अवस्था में आपराधिक जोखिम होता है — अवधि समाप्त होने से पहले वकील से दस्तावेज़ समीक्षा कराएँ।"),
    },
  ],
  debt_collection: [
    {
      key: "confirm_receipt", priority: 1, source_id: "fdcpa_1692g",
      when: (c) => c.missing.includes("receipt_date"),
      title: l4("Confirm when the notice was received", "पुष्टि करें कि नोटिस कब प्राप्त हुआ"),
      reason: l4("The 30-day dispute and verification-request window runs from receipt of the notice.", "30-दिन की विवाद व अनुरोध अवधि नोटिस प्राप्ति से चलती है।"),
    },
    {
      key: "request_validation", priority: 2, source_id: "fdcpa_1692g",
      when: () => true,
      title: l4("Request written verification of the debt", "कर्ज का लिखित सत्यापन मांगें"),
      reason: l4("A written dispute within the window obliges the collector to stop collection until it verifies the debt; you may also request the original creditor's name and address.", "अवधि में लिखित विवाद करने पर सत्यापन तक वसूली रुक जाती है; मूल लेनदार का नाम-पता भी मांगा जा सकता है।"),
    },
    {
      key: "check_statements", priority: 3, source_id: null,
      when: () => true,
      title: l4("Match the claimed amount to your own records", "दावे की राशि अपने रिकॉर्ड से मिलाएँ"),
      reason: l4("Compare the balance and fees claimed against your statements before agreeing to anything.", "कुछ भी स्वीकार करने से पहले दावे वाली राशि व शुल्क अपने विवरण से मिलाएँ।"),
    },
    {
      key: "consult_lawyer", priority: 4, source_id: "ny_cplr_320",
      when: (c) => c.severity === "red",
      title: l4("Consult a lawyer about the threatened court action", "धमकी वाली अदालती कार्रवाई पर वकील से सलाह लें"),
      reason: l4("The letter refers the matter to court where a default judgment can be enforced by wage garnishment — get advice before that stage.", "पत्र मामला अदालत जाने की बात करता है, जहाँ पूर्वनिर्णय से वेतन कटौती हो सकती है — उस स्थिति से पहले सलाह लें।"),
    },
  ],
  eviction: [
    {
      key: "confirm_notification", priority: 1, source_id: "es_lec_22",
      when: (c) => c.missing.includes("court_notification_date"),
      title: l4("Confirm whether an eviction claim has been notified yet", "पुष्टि करें कि बेदखली मुकदमा अधिसूचित हुआ या नहीं"),
      reason: l4("The 10-business-day enervación window only starts once the claim is notified — without that date the deadline cannot be calculated.", "10 कार्य-दिवस की enervación अवधि केवल मुकदमा अधिसूचित होने पर शुरू होती है — तिथि के बिना समा-सीमा नहीं निकल सकती।"),
    },
    {
      key: "check_arrears", priority: 2, source_id: "es_lau_27",
      when: () => true,
      title: l4("Check the arrears against rent receipts", "किराया रसीदों से बकाया जांचें"),
      reason: l4("Match the claimed unpaid months and amounts against your contract and payment receipts.", "दावे वाले महीने व राशि अपने अनुबंध व भुगतान रसीदों से मिलाएँ।"),
    },
    {
      key: "plan_payment", priority: 3, source_id: "es_lec_22",
      when: () => true,
      title: l4("Plan how to settle the arrears", "बकाया चुकाने की योजना बनाएँ"),
      reason: l4("Paying everything owed can stop a first eviction claim (enervación) if done within the statutory window after notification.", "अधिसूचना के बाद वैधानिक अवधि में पूरा बकाया चुकाने से पहली बेदखली कार्रवाई रुक सकती है (enervación)।"),
    },
    {
      key: "consult_lawyer", priority: 4, source_id: "es_lec_22",
      when: (c) => c.severity === "red",
      title: l4("Consult a lawyer about the eviction claim", "बेदखली मुकदमे पर वकील से सलाह लें"),
      reason: l4("Home at risk: a lawyer can check enervation eligibility and represent you in the first-instance court.", "घर का जोखिम: वकील enervation पात्रता जांच सकता है और प्रथम-दृष्ट न्यायालय में आपका प्रतिनिधित्व कर सकता है।"),
    },
  ],
  court_summons: [
    {
      key: "confirm_hearing", priority: 1, source_id: "in_cpc_o9r6",
      when: (c) => c.missing.includes("hearing_date"),
      title: l4("Confirm the hearing / answer date", "सुनवाई / जवाब तिथि पुष्टि करें"),
      reason: l4("The summons must state when to appear or answer — that date drives every next step.", "सम्मन में उपस्थिति/जवाब की तिथि होनी चाहिए — वही तिथि सब आगे के कदम तय करती है।"),
    },
    {
      key: "prepare_appearance", priority: 2, source_id: "in_cpc_o9r6",
      when: () => true,
      title: l4("Prepare to appear or file an answer", "उपस्थिति या जवाब की तैयारी करें"),
      reason: l4("Organise your documents and consider engaging a lawyer before the stated date.", "बताई गई तिथि से पहले दस्तावेज़ सजाएँ और वकील पर विचार करें।"),
    },
  ],
};

const GENERIC_ACTIONS: ActionTemplate[] = [
  {
    key: "confirm_receipt", priority: 1, source_id: null,
    when: (c) => c.missing.includes("receipt_date"),
    title: l4("Confirm when the notice was received", "पुष्टि करें कि नोटिस कब प्राप्त हुआ"),
    reason: l4("Response periods usually run from receipt — the exact deadline depends on this date.", "जवाबी अवधि सामान्यतः प्राप्ति से चलती है — सटीक समा-सीमा इसी तिथि पर निर्भर है।"),
  },
  {
    key: "gather_documents", priority: 2, source_id: null,
    when: () => true,
    title: l4("Gather documents related to the notice", "नोटिस से जुड़े दस्तावेज़ इकट्ठा करें"),
    reason: l4("Contracts, receipts and correspondence are the evidence base for any response.", "अनुबंध, रसीदें और पत्राचार ही किसी जवाब का साक्ष्य आधार हैं।"),
  },
  {
    key: "respond_before_deadline", priority: 3, source_id: null,
    when: (c) => c.deadline_calculated,
    title: l4("Respond in writing before the deadline", "समा-सीमा से पहले लिखित जवाब दें"),
    reason: l4("A dated, written response preserves your position whatever you decide later.", "तय तिथि वाला लिखित जवाब बाद के किसी भी निर्णय में आपकी स्थिति सुरक्षित रखता है।"),
  },
  {
    key: "consult_lawyer", priority: 4, source_id: null,
    when: (c) => c.severity === "red",
    title: l4("Consult a qualified lawyer", "योग्य वकील से सलाह लें"),
    reason: l4("This notice is rated critical — a lawyer should review it before the deadline.", "यह नोटिस गंभीर श्रेणी में है — समा-सीमा से पहले वकील से समीक्षा कराएँ।"),
  },
];

export function actionsFor(type: NoticeType): ActionTemplate[] {
  return ACTION_TEMPLATES[type] ?? GENERIC_ACTIONS;
}

/* position-aware extra actions (FEATURE 13) */
export const POSITION_ACTIONS: Partial<Record<UserPosition, ActionTemplate>> = {
  full_dispute: {
    key: "prepare_defence", priority: 2.5, source_id: null,
    when: () => true,
    title: l4("Prepare your defence file", "अपना बचाव फ़ाइल तैयार करें"),
    reason: l4("Since you dispute the claim, collect every document that contradicts it — statements, receipts, correspondence — before drafting your reply.", "चूंकि आप दावे से असहमत हैं, जवाब लिखने से पहले हर वह दस्तावेज़ इकट्ठा करें जो उसके विपरीत है — विवरण, रसीदें, पत्राचार।"),
  },
  already_paid: {
    key: "collect_payment_proof", priority: 2.5, source_id: null,
    when: () => true,
    title: l4("Collect proof of payment", "भुगतान का प्रमाण इकट्ठा करें"),
    reason: l4("Since you state the amount was already paid, bank confirmations or receipts are the key evidence to attach to your response.", "चूंकि आप कहते हैं कि राशि चुक गई, बैंक पुष्टि या रसीदें ही जवाब के साथ जोड़ने वाले मुख्य साक्ष्य हैं।"),
  },
  partial_dispute: {
    key: "reconcile_amounts", priority: 2.5, source_id: null,
    when: () => true,
    title: l4("Build a line-by-line reconciliation", "राशि का वस्तुनिष्ठ मिलान बनाएँ"),
    reason: l4("Since you dispute only part of the claim, a table matching each claimed item to your records makes the response precise.", "चूंकि आप दावे का केवल भाग अस्वीकार करते हैं, प्रत्येक मद को अपने रिकॉर्ड से मिलाने वाली तालिका जवाब को सटीक बनाती है।"),
  },
};

/* ───────────────────────── lawyer questions (FEATURE 12) ───────────────────────── */

export interface QuestionTemplate {
  key: string;
  when?: (ctx: ActionCtx) => boolean;
  text: L4;
}

export const QUESTION_TEMPLATES: Record<string, QuestionTemplate[]> = {
  cheque_bounce: [
    { key: "enforceable_debt", text: l4("Was the cheque issued towards a legally enforceable debt, in your view?", "आपके अनुसार क्या चेक किसी विधिक रूप से प्रवर्तनीय देनदारी के लिए जारी हुआ था?") },
    { key: "receipt_date", when: (c) => c.missing.includes("receipt_date"), text: l4("When was the notice actually received? (This sets the 15-day window.)", "नोटिस वास्तव में कब प्राप्त हुआ? (इसी से 15-दिन की अवधि तय होती है।)") },
    { key: "conditions_check", text: l4("Do your documents show the cheque was presented within 3 months and the notice sent within 30 days of the dishonour memo?", "क्या आपके दस्तावेज़ दिखाते हैं कि चेक 3 महीने में प्रस्तुत हुआ और अनादरण मेमो के 30 दिन में नोटिस गया?") },
    { key: "partial_payment", when: (c) => c.position === "partial_dispute" || c.position === "full_dispute", text: l4("Has any part of the amount been paid, and what proof exists?", "क्या कोई राशि चुकी है, और उसका प्रमाण है?") },
  ],
  debt_collection: [
    { key: "debt_valid", text: l4("Does the claimed balance match your own account records?", "क्या दावे वाली राशि आपके खाता विवरण से मेल खाती है?") },
    { key: "within_window", when: (c) => c.missing.includes("receipt_date"), text: l4("When did you receive this letter? (The 30-day dispute window depends on it.)", "यह पत्र आपको कब मिला? (30-दिन की विवाद अवधि इसी पर निर्भर है।)") },
    { key: "statute_barred", when: (c) => c.position === "full_dispute" || c.position === "dont_recognize", text: l4("Could the debt be time-barred or already settled? What records support that?", "क्या कर्ज समय-सीमा से बाहर है या चुक चुका है? इसके पक्ष में क्या रिकॉर्ड हैं?") },
  ],

};

const GENERIC_QUESTIONS: QuestionTemplate[] = [
  { key: "facts_correct", text: l4("Are the sender, the amount and the dates in the notice correct according to your records?", "नोटिस में दिया भेजने वाला, राशि और तारीखें आपके रिकॉर्ड के अनुसार सही हैं?") },
  { key: "deadline_feasible", text: l4("Is the stated response period feasible, and what would you need to respond by then?", "क्या बताई गई जवाबी अवधि पर्याप्त है, और तब तक जवाब के लिए क्या चाहिए?") },
];

export function questionsFor(type: NoticeType): QuestionTemplate[] {
  return QUESTION_TEMPLATES[type] ?? GENERIC_QUESTIONS;
}

/* ───────────────────────── fallback response draft (FEATURE 14) ───────────────────────── */

export interface DraftCtx {
  recipient: string | null;
  sender: string | null;
  amount: string | null;
  noticeDate: string | null;
  position: UserPosition | null;
  missing: string[];
  deadlineText: string | null;
}

type DraftFn = (ctx: DraftCtx) => L4;

export const DRAFT_TEMPLATES: Record<string, DraftFn> = {
  cheque_bounce: (c) => ({
    en: `Subject: Reply to legal notice dated ${c.noticeDate ?? "[PLACEHOLDER — USER INPUT REQUIRED: notice date]"}

Dear ${c.sender ?? "[PLACEHOLDER — USER INPUT REQUIRED: sender name]"},

I refer to your notice under Section 138 of the Negotiable Instruments Act demanding ${c.amount ?? "[PLACEHOLDER — USER INPUT REQUIRED: amount]"}.

My position: ${positionLine(c.position, "en")} The notice was received on ${c.deadlineText ?? "[Notice receipt date]"}${c.deadlineText ? ", so the 15-day period is running from that date" : ""}.

[Draft for review — not legal advice. Fill every placeholder and have a qualified lawyer review before sending.]

Yours faithfully,
[PLACEHOLDER — USER INPUT REQUIRED: your name]`,
    hi: `विषय: ${c.noticeDate ?? "[स्थान-भरने योग्य — नोटिस तारीख]"} के कानूनी नोटिस का उत्तर

महोदय ${c.sender ?? "[प्रेषक का नाम — उपयोगकर्ता इनपुट आवश्यक]"},

आपके धारा 138 नोटिस में मांगी गई ${c.amount ?? "[राशि — उपयोगकर्ता इनपुट आवश्यक]"} के संदर्भ में।

मेरी स्थिति: ${positionLine(c.position, "hi")} नोटिस ${c.deadlineText ?? "[नोटिस प्राप्ति की तारीख]"} को प्राप्त हुआ।

[समीक्षा हेतु प्रारूप — कानूनी सलाह नहीं। प्रत्येक रिक्त स्थान भरें और भेजने से पहले योग्य वकील से समीक्षा कराएँ।]

भवदीय,
[आपका नाम — उपयोगकर्ता इनपुट आवश्यक]`,
    }),
};

const GENERIC_DRAFT: DraftFn = (c) => ({
  en: `Subject: Reply to your notice dated ${c.noticeDate ?? "[PLACEHOLDER — USER INPUT REQUIRED: notice date]"}

Dear ${c.sender ?? "[PLACEHOLDER — USER INPUT REQUIRED: sender name]"},

I acknowledge receipt of your notice regarding ${c.amount ? `an amount of ${c.amount}` : "[PLACEHOLDER — USER INPUT REQUIRED: subject matter]"}.

My position: ${positionLine(c.position, "en")}

[Draft for review — not legal advice. Fill every placeholder and have a qualified lawyer review before sending.]

Yours faithfully,
[PLACEHOLDER — USER INPUT REQUIRED: your name]`,
  hi: `विषय: ${c.noticeDate ?? "[नोटिस तारीख — उपयोगकर्ता इनपुट आवश्यक]"} के नोटिस का उत्तर

महोदय ${c.sender ?? "[प्रेषक का नाम — उपयोगकर्ता इनपुट आवश्यक]"},

आपके नोटिस (${c.amount ? `राशि ${c.amount}` : "[विषय — उपयोगकर्ता इनपुट आवश्यक]"}) की प्राप्ति स्वीकार है।

मेरी स्थिति: ${positionLine(c.position, "hi")}

[समीक्षा हेतु प्रारूप — कानूनी सलाह नहीं। प्रत्येक रिक्त स्थान भरें और वकील से समीक्षा कराएँ।]

भवदीय,
[आपका नाम — उपयोगकर्ता इनपुट आवश्यक]`,
});

function positionLine(position: UserPosition | null, locale: "en" | "hi"): string {
  const map: Record<UserPosition, L4> = {
    agree: {
      en: "I acknowledge the claim and intend to settle it.",
      hi: "मैं दावा स्वीकार करता/करती हूँ और उसे सुलझाना चाहता/चाहती हूँ।",
    },
    partial_dispute: {
      en: "I dispute part of the claimed amount; a reconciliation is attached.",
      hi: "मैं दावे के एक भाग से असहमत हूँ; मिलान विवरण संलग्न है।",
    },
    full_dispute: {
      en: "I dispute the claim in full.",
      hi: "मैं पूरे दावे से असहमत हूँ।",
    },
    already_paid: {
      en: "The amount has already been paid; proof of payment is attached.",
      hi: "राशि भुगतान हो चुकी है; भुगतान प्रमाण संलग्न है।",
    },
    dont_recognize: {
      en: "I do not recognize this claim.",
      hi: "मैं इस दावे को नहीं पहचानता/पहचानती।",
    },
    unknown: {
      en: "I am still reviewing the claim.",
      hi: "मैं दावे की समीक्षा कर रहा/रही हूँ।",
    },
  };
  const p = position ?? "unknown";
  return map[p][locale];
}

export function draftFor(type: NoticeType): DraftFn {
  return DRAFT_TEMPLATES[type] ?? GENERIC_DRAFT;
}

/* ───────────────────────── per-type validator patterns (FEATURE 8) ───────────────────────── */

/** Statements that must never appear for this notice type (fabricated rights). */
export const FORBIDDEN_CLAIM_PATTERNS: Partial<Record<NoticeType, RegExp[]>> = {
  cheque_bounce: [
    /\b30\s*(days|day|दिन|天|jours)\b[^.]*(dispute|challenge|contest|विवाद|चुनौती|争议|contester|異议)/i,
    /(dispute|challenge|contest|विवाद|争议|contester)[^.]*\b30\s*(days|day|दिन|天|jours)\b/i,
    /(request|demand|obtain)[^.]*(creditor|drawer)[^.]*details[^.]*§?\s*138/i,
    /(creditor|drawer)[^.]*details[^.]*under[^.]*§?\s*138/i,
    /(धारा|section)\s*138[^.]*(लेनदार| creditor)[^.]*(विवरण|details)/i,
  ],
};

/** Absolute / outcome-predicting language to soften (FEATURE 8/10). */
export const ABSOLUTE_PATTERNS: RegExp[] = [
  /\byou will (be arrested|be jailed|go to jail|definitely|certainly|surely)\b/i,
  /\byou will (lose|win)\b/i,
  /\b(definitely|certainly|guaranteed?)\b[^.]*\b(win|lose|convicted?|arrested?|jailed?)\b/i,
  /\ba case will definitely\b/i,
  /\bwill definitely (be (arrested|jailed|convicted|sued))\b/i,
  /\bआप (निश्चित|ज़रूर)\b[^.]*(गिरफ्तार|जेल|हार|जीत)/i,
  /\b必然\b|\b一定会?被(捕|判)\b|\b你将会?败诉\b/i,
  /\bvous serez (certainement|nécessairement|obligatoirement)\b/i,
  /\bvous (allez|risquez de) (perdre|gagner) (à coup sûr|certainement)\b/i,
];

/** Conditional replacements shown when absolute language is softened. */
export const CONDITIONAL_REPLACEMENT: L4 = l4("If the statutory requirements are satisfied and the matter proceeds, the court may impose the penalties allowed by the applicable provision.", "यदि वैधानिक शर्तें पूरी हों और कार्रवाई आगे बढ़े, तो अदालत लागू प्रावधान द्वारा अनुमत दंड लगा सकती है।");
