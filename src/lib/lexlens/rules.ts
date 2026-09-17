// LexLens — deterministic legal rule packs ("keep legal rules separate from
// LLM prompts", FEATURE 20). Each supported notice family defines:
//   • deadline rules (anchor field + statutory period + corpus source)
//   • required facts and why they matter (missing-information detector)
//   • evidence checklist templates mapped to claims
//   • corpus-verified rights (no fabricated rights — FEATURE 8/9)
//   • conditional action templates, procedural consequences, lawyer questions
//   • a fallback response-draft template with placeholders (FEATURE 14)
// All consumer-facing strings are localized EN/HI/ZH/FR.

import type { DeadlineRule } from "./deadline-engine";
import type { Importance, L4, NoticeType, UserPosition } from "./types";

export const l4 = (en: string, hi: string, zh: string, fr: string): L4 => ({ en, hi, zh, fr });

/* ───────────────────────── canonical fact labels ───────────────────────── */

export const FACT_LABELS: Record<string, L4> = {
  amount: l4("Claimed amount", "मांगी गई राशि", "索赔金额", "Montant réclamé"),
  notice_date: l4("Notice date", "नोटिस की तारीख", "通知日期", "Date du constat"),
  receipt_date: l4("Notice receipt date", "नोटिस प्राप्ति की तारीख", "收到通知的日期", "Date de réception du constat"),
  cheque_number: l4("Cheque number", "चेक संख्या", "支票号码", "Numéro de chèque"),
  cheque_date: l4("Cheque date", "चेक की तारीख", "支票日期", "Date du chèque"),
  bank_name: l4("Drawee bank", "बैंक", "付款银行", "Banque tirée"),
  presentation_date: l4("Cheque presented on", "चेक प्रस्तुति तिथि", "支票提示日期", "Date de présentation du chèque"),
  dishonour_date: l4("Dishonour date", "अनादरण तिथि", "退票日期", "Date du rejet"),
  invoice_number: l4("Invoice reference", "इनवॉइस संदर्भ", "发票编号", "Référence de facture"),
  original_creditor: l4("Original creditor", "मूल लेनदार", "原始债权人", "Créancier initial"),
  account_number: l4("Account reference", "खाता संदर्भ", "账户编号", "Référence de compte"),
  monthly_rent: l4("Monthly rent", "मासिक किराया", "月租金", "Loyer mensuel"),
  rent_months: l4("Unpaid months", "बकाया महीने", "未付月份", "Mois impayés"),
  contract_date: l4("Contract date", "अनुबंध तिथि", "合同日期", "Date du contrat"),
  court_notification_date: l4("Lawsuit notification date", "मुकदमा अधिसूचना तिथि", "诉讼通知日期", "Date de notification de la procédure"),
  hearing_date: l4("Hearing / appearance date", "सुनवाई / उपस्थिति तिथि", "开庭/出庭日期", "Date d'audience / comparution"),
  court_name: l4("Court / forum", "न्यायालय / मंच", "法院/法庭", "Tribunal / juridiction"),
  cause_of_action_date: l4("Date of the problem", "विवाद की तारीख", "争议发生日期", "Date du litige"),
  purchase_date: l4("Purchase date", "खरीद तिथि", "购买日期", "Date d'achat"),
  interest_rate: l4("Interest claimed", "ब्याज दर", "主张的利息", "Intérêts réclamés"),
  case_number: l4("Case / reference number", "मामला / संदर्भ संख्या", "案件/编号", "Numéro de dossier"),
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

const WHY_RECEIPT_138 = l4(
  "The 15-day statutory payment window under NI Act §138 runs from RECEIPT of the notice — not from its date — so the exact deadline cannot be calculated until the receipt date is known.",
  "धारा 138 के तहत 15 दिन की वैधानिक भुगतान अवधि नोटिस की तारीख से नहीं, बल्कि नोटिस प्राप्त होने की तारीख से चलती है — इसलिए प्राप्ति तिथि ज्ञात होने तक सटीक समा-सीमा की गणना नहीं की जा सकती।",
  "《流通票据法》第138条规定的15天法定付款期限自“收到通知”之日起算，而非通知落款日——因此在知道签收日期之前无法计算确切截止日。",
  "Le délai légal de 15 jours (NI Act, art. 138) court à compter de la RÉCEPTION du constat — et non de sa date — le délai exact ne peut donc être calculé sans la date de réception.",
);

export const REQUIRED_FIELDS: Record<string, RequiredField[]> = {
  cheque_bounce: [
    { field: "receipt_date", importance: "critical", input: "date", feeds_deadline: true, why: WHY_RECEIPT_138, source_id: "in_ni_138" },
    { field: "dishonour_date", importance: "high", input: "date", feeds_deadline: false, why: l4("Needed to verify the statutory timeline (the demand notice must follow the dishonour memo within 30 days).", "वैधानिक समय-रेखा जांचने के लिए आवश्यक (अनादरण मेमो के 30 दिनों के भीतर मांग-नोटिस भेजा जाना अनिवार्य है)।", "用于核实法定时间线（催告通知须在银行退票凭证后30天内发出）。", "Nécessaire pour vérifier le calendrier légal (le constat doit suivre le mémoire de rejet sous 30 jours)."), source_id: "in_ni_138" },
    { field: "cheque_number", importance: "high", input: "text", feeds_deadline: false, why: l4("Needed to verify the claim against the underlying cheque.", "दावे को मूल चेक से मिलान करने के लिए आवश्यक।", "需要用于核对索赔所依据的支票。", "Nécessaire pour vérifier la créance par rapport au chèque."), source_id: null },
    { field: "bank_name", importance: "medium", input: "text", feeds_deadline: false, why: l4("Identifies the drawee bank for verification of the dishonour.", "अनादरण सत्यापन के लिए बैंक पहचानने हेतु।", "用于核实退票的付款银行。", "Identifie la banque tirée pour vérifier le rejet."), source_id: null },
  ],
  debt_collection: [
    { field: "receipt_date", importance: "critical", input: "date", feeds_deadline: true, why: l4("The 30-day written-dispute window under FDCPA §1692g runs from receipt of the notice.", "FDCPA §1692g के तहत 30 दिन की लिखित-विवाद अवधि नोटिस प्राप्ति से चलती है।", "《公平债务催收作业法》第1692g条规定的30天书面争议期自收到通知起算。", "Le délai de contestation écrite de 30 jours (FDCPA §1692g) court à compter de la réception."), source_id: "fdcpa_1692g" },
    { field: "original_creditor", importance: "medium", input: "text", feeds_deadline: false, why: l4("Confirms whose debt is being collected — you may request it in writing within the 30-day window.", "पुष्टि करता है कि किसका कर्ज है — 30 दिन की अवधि में लिखित अनुरोध किया जा सकता है।", "确认债务来源——可在30天期限内书面索取。", "Confirme l'origine de la dette — à demander par écrit sous 30 jours."), source_id: "fdcpa_1692g" },
    { field: "account_number", importance: "medium", input: "text", feeds_deadline: false, why: l4("Needed to match the claimed debt to your own records.", "दावे को अपने रिकॉर्ड से मिलाने हेतु।", "用于将索赔债务与您的记录比对。", "Pour rattacher la créance à vos propres documents."), source_id: null },
  ],
  eviction: [
    { field: "court_notification_date", importance: "critical", input: "date", feeds_deadline: true, why: l4("The 10-business-day window to pay the arrears and stop a first eviction claim (enervación) runs from notification of the lawsuit.", "बकाया चुकाकर पहली बेदखली कार्रवाई रोकने की 10 कार्य-दिवसों की अवधि (enervación) मुकदमे की अधिसूचना से चलती है।", "付清欠租以阻止首次驱逐诉讼（enervación）的10个工作日期限自诉讼送达之日起算。", "Le délai de 10 jours ouvrables pour payer les arriérés et arrêter une première demande d'expulsion (enervación) court à compter de la notification."), source_id: "es_lec_22" },
    { field: "monthly_rent", importance: "medium", input: "number", feeds_deadline: false, why: l4("Verifies the arrears calculation against the contract.", "अनुबंध के अनुसार बकाया गणना जांचने हेतु।", "用于按合同核对欠租金额。", "Pour vérifier le calcul des arriérés selon le bail."), source_id: null },
    { field: "rent_months", importance: "medium", input: "text", feeds_deadline: false, why: l4("Identifies exactly which months are claimed as unpaid.", "कौन से महीने बकाया कहे गए हैं, पहचानने हेतु।", "确认具体被主张未付的月份。", "Identifie précisément les mois réclamés comme impayés."), source_id: null },
  ],
  consumer: [
    { field: "cause_of_action_date", importance: "high", input: "date", feeds_deadline: true, why: l4("A complaint to the District Commission should ordinarily be filed within two years of the cause of action.", "जिला आयोग में शिकायत सामान्यतः विवाद उत्पन्न होने के दो वर्ष के भीतर दर्ज की जानी चाहिए।", "向地区委员会投诉一般应在争议发生之日起两年内提出。", "La plainte devant la Commission de district doit généralement être déposée sous deux ans."), source_id: "in_cpa_s35" },
  ],
  court_summons: [
    { field: "hearing_date", importance: "critical", input: "date", feeds_deadline: true, why: l4("The date by which you must appear or answer — missing it can lead to a default decision.", "उपस्थित होने या जवाब देने की तिथि — चूकने पर एकपक्षीय निर्णय हो सकता है।", "必须出庭或答辩的日期——错过可能导致缺席判决。", "Date limite de comparution — un défaut peut mener à un jugement par défaut."), source_id: "in_cpc_o9r6" },
    { field: "court_name", importance: "medium", input: "text", feeds_deadline: false, why: l4("Identifies the court handling the matter.", "मामला संभालने वाले न्यायालय की पहचान।", "受理案件的法院。", "Identifie la juridiction saisie."), source_id: null },
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
      origin: "statute_rule",
      label: l4("Statutory payment window (NI Act §138)", "वैधानिक भुगतान अवधि (धारा 138)", "法定付款期限（第138条）", "Délai légal de paiement (NI Act art. 138)"),
      description: l4(
        "15 days from receipt of the notice (NI Act §138). The 30-day period mentioned in §138 concerns when the PAYEE must send the demand notice after the dishonour — it is not a dispute right for the recipient.",
        "नोटिस प्राप्ति से 15 दिन (धारा 138)। §138 में उल्लिखित 30-दिन की अवधि प्राप्तकर्ता को नहीं, बल्कि लाभार्थी को अनादरण के बाद नोटिस भेजने से संबंधित है — यह प्राप्तकर्ता का विवाद-अधिकार नहीं है।",
        "自收到通知起15天（第138条）。第138条中的30天期限是指收款方须在退票后发出催告通知——并非收件人的争议权利。",
        "15 jours à compter de la réception du constat (NI Act art. 138). Le délai de 30 jours vise l'envoi du constat par le bénéficiaire après le rejet — ce n'est pas un droit de contestation du destinataire.",
      ),
    },
  ],
  debt_collection: [
    {
      event_key: "dispute_window",
      period_days: 30,
      anchor_field: "receipt_date",
      business_days: false,
      source_id: "fdcpa_1692g",
      origin: "statute_rule",
      label: l4("Written dispute window (FDCPA §1692g)", "लिखित विवाद अवधि (FDCPA §1692g)", "书面争议期限（FDCPA §1692g）", "Délai de contestation écrite (FDCPA §1692g)"),
      description: l4(
        "30 days from receipt of the notice: dispute in writing to suspend collection until the debt is verified.",
        "नोटिस प्राप्ति से 30 दिन: लिखित विवाद करने पर कर्ज सत्यापित होने तक वसूली रुक जाती है।",
        "自收到通知起30天：以书面提出争议可暂停催收，直至债务得到核实。",
        "30 jours à compter de la réception : une contestation écrite suspend le recouvrement jusqu'à vérification.",
      ),
    },
  ],
  eviction: [
    {
      event_key: "enervar_window",
      period_days: 10,
      anchor_field: "court_notification_date",
      business_days: true,
      source_id: "es_lec_22",
      origin: "statute_rule",
      label: l4("Enervación window (LEC art. 22.2)", "Enervación अवधि (LEC कलम 22.2)", "Enervación 期限（LEC 第22.2条）", "Délai d'enervación (LEC art. 22.2)"),
      description: l4(
        "10 business days from notification of the eviction claim: paying ALL arrears can stop a first eviction claim (enervación).",
        "बेदखली मुकदमे की अधिसूचना से 10 कार्य-दिवस: पूरा बकाया चुकाने से पहली बेदखली कार्रवाई रुक सकती है (enervación)।",
        "自驱逐诉讼送达起10个工作日：付清全部欠租可阻止首次驱逐诉讼（enervación）。",
        "10 jours ouvrables dès la notification : payer TOUTES les sommes dues peut arrêter une première demande d'expulsion (enervación).",
      ),
    },
  ],
  consumer: [
    {
      event_key: "complaint_limitation",
      period_days: 730,
      anchor_field: "cause_of_action_date",
      business_days: false,
      source_id: "in_cpa_s35",
      origin: "statute_rule",
      label: l4("Complaint limitation (CPA 2019 §35)", "शिकायत समय-सीमा (CPA 2019 §35)", "投诉时效（2019年消费者保护法§35）", "Délai de plainte (CPA 2019 art. 35)"),
      description: l4(
        "A complaint to the District Commission should ordinarily be filed within two years from the cause of action.",
        "जिला आयोग में शिकायत सामान्यतः विवाद उत्पन्न होने से दो वर्ष के भीतर दर्ज की जानी चाहिए।",
        "向地区委员会的投诉一般应在争议发生之日起两年内提出。",
        "La plainte devant la Commission de district doit généralement être déposée sous deux ans.",
      ),
    },
  ],
  court_summons: [
    {
      event_key: "appearance_deadline",
      period_days: null,
      anchor_field: "explicit",
      business_days: false,
      source_id: "in_cpc_o9r6",
      origin: "statute_rule",
      label: l4("Appearance / answer deadline", "उपस्थिति / जवाब समा-सीमा", "出庭/答辩期限", "Délai de comparution / réponse"),
      description: l4(
        "Appear or answer by the date stated in the summons; failing to appear can lead to an ex-parte decision.",
        "सम्मन में दी गई तिथि तक उपस्थित हों या जवाब दें; अनुपस्थिति पर एकपक्षीय निर्णय हो सकता है।",
        "须在传票载明日期前出庭或答辩；缺席可能导致缺席审理。",
        "Comparer ou répondre à la date indiquée ; une absence peut mener à une décision par défaut.",
      ),
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
    origin: "notice_stated",
    label: l4("Deadline stated in the notice", "नोटिस में दी गई समा-सीमा", "通知中载明的期限", "Délai indiqué dans le constat"),
    description: l4(
      "The notice states its own response period. LexLens only turns it into a calendar date once the anchor date is confirmed.",
      "नोटिस अपनी जवाबी अवधि बताता है। LexLens उसे कैलेंडर तिथि में तभी बदलता है जब आधार तिथि पुष्ट हो।",
      "通知自行载明了答复期限。只有在起算日期确认后，LexLens 才会将其换算为日历日期。",
      "Le constat indique son propre délai. LexLens le convertit en date calendaire uniquement une fois la date de départ confirmée.",
    ),
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
    { key: "legal_notice", label: l4("Legal notice (this document)", "कानूनी नोटिस (यह दस्तावेज़)", "法律通知（本文件）", "Constat juridique (ce document)"), claim_link: null, have: true },
    { key: "cheque_copy", label: l4("Cheque image / copy", "चेक की प्रति", "支票复印件", "Copie du chèque"), claim_link: l4("Supports verifying the claimed cheque", "दावे वाले चेक को सत्यापित करने में सहायक", "用于核对索赔所指的支票", "Sert à vérifier le chèque concerné"), have: false },
    { key: "bank_return_memo", label: l4("Bank return / dishonour memo", "बैंक रिटर्न मेमो", "银行退票凭证", "Mémoire de rejet bancaire"), claim_link: l4("Required to prove the dishonour", "अनादरण सिद्ध करने के लिए आवश्यक", "用于证明退票事实", "Nécessaire pour prouver le rejet"), have: false },
    { key: "invoice_agreement", label: l4("Invoice / underlying agreement", "इनवॉइस / मूल अनुबंध", "发票/基础合同", "Facture / contrat sous-jacent"), claim_link: l4("Supports the debt the cheque was issued for", "चेक जिस देनदारी के लिए था, उसे सिद्ध करता है", "证明支票所对应的债务", "Établit la créance couverte par le chèque"), have: false },
    { key: "payment_receipt", label: l4("Payment receipts (if already paid)", "भुगतान रसीदें (यदि भुगतान हो चुका है)", "付款凭证（如已付款）", "Reçus de paiement (si déjà payé)"), claim_link: null, have: false },
  ],
  debt_collection: [
    { key: "collection_letter", label: l4("Collection letter (this document)", "वसूली पत्र (यह दस्तावेज़)", "催收函（本文件）", "Lettre de recouvrement (ce document)"), claim_link: null, have: true },
    { key: "account_statements", label: l4("Account / card statements", "खाता / कार्ड विवरण", "账户/对账单", "Relevés de compte / carte"), claim_link: l4("Supports verifying the claimed balance", "दावे वाली राशि सत्यापित करने में सहायक", "用于核对所主张的余额", "Sert à vérifier le solde réclamé"), have: false },
    { key: "prior_correspondence", label: l4("Prior correspondence with creditor", "लेनदार से पिछला पत्राचार", "与债权人的往来函件", "Correspondance antérieure avec le créancier"), claim_link: null, have: false },
    { key: "payment_records", label: l4("Payment records (if any)", "भुगतान रिकॉर्ड (यदि कोई हो)", "付款记录（如有）", "Justificatifs de paiement (le cas échéant)"), claim_link: null, have: false },
  ],
  eviction: [
    { key: "payment_demand", label: l4("Payment demand (this document)", "भुगतान मांग (यह दस्तावेज़)", "付款催告（本文件）", "Demande de paiement (ce document)"), claim_link: null, have: true },
    { key: "rental_contract", label: l4("Rental contract", "किराया अनुबंध", "租赁合同", "Contrat de bail"), claim_link: l4("Supports verifying rent and obligations", "किराया व दायित्व सत्यापित करने में सहायक", "用于核对租金与义务", "Sert à vérifier loyer et obligations"), have: false },
    { key: "rent_receipts", label: l4("Rent payment receipts", "किराया भुगतान रसीदें", "租金付款凭证", "Quittances de loyer"), claim_link: l4("Shows which months were actually paid", "दिखाता है कि कौन से महीने चुके", "证明实际已付月份", "Prouve les mois effectivement payés"), have: false },
    { key: "lawsuit_documents", label: l4("Lawsuit / court documents (if served)", "मुकदमा / न्यायालय दस्तावेज़ (यदि मिले हों)", "诉讼/法院文件（如已送达）", "Documents de procédure (si notifiés)"), claim_link: null, have: false },
  ],
  consumer: [
    { key: "notice_document", label: l4("Notice (this document)", "नोटिस (यह दस्तावेज़)", "通知（本文件）", "Constat (ce document)"), claim_link: null, have: true },
    { key: "invoice_warranty", label: l4("Invoice / warranty documents", "इनवॉइस / वारंटी दस्तावेज़", "发票/保修文件", "Facture / documents de garantie"), claim_link: null, have: false },
    { key: "complaint_correspondence", label: l4("Complaint correspondence", "शिकायत पत्राचार", "投诉往来函件", "Échanges de réclamation"), claim_link: null, have: false },
  ],
  court_summons: [
    { key: "summons_document", label: l4("Summons (this document)", "सम्मन (यह दस्तावेज़)", "传票（本文件）", "Citation (ce document)"), claim_link: null, have: true },
    { key: "case_documents", label: l4("Case / plaint documents", "मामला / वाद दस्तावेज़", "案件/诉状文件", "Documents de l'affaire"), claim_link: null, have: false },
  ],
};

const GENERIC_EVIDENCE: EvidenceTemplate[] = [
  { key: "notice_document", label: l4("Notice (this document)", "नोटिस (यह दस्तावेज़)", "通知（本文件）", "Constat (ce document)"), claim_link: null, have: true },
  { key: "supporting_documents", label: l4("Your own supporting documents", "आपके सहायक दस्तावेज़", "您的相关证明文件", "Vos propres justificatifs"), claim_link: null, have: false },
  { key: "payment_records", label: l4("Payment / account records", "भुगतान / खाता रिकॉर्ड", "付款/账户记录", "Paiements / relevés"), claim_link: null, have: false },
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
    { key: "cheque_issued", label: l4("Cheque issued", "चेक जारी", "签发支票", "Émission du chèque"), field: "cheque_date", order: 1 },
    { key: "cheque_presented", label: l4("Cheque presented", "चेक प्रस्तुत", "提示支票", "Présentation du chèque"), field: "presentation_date", order: 2 },
    { key: "cheque_dishonoured", label: l4("Cheque dishonoured", "चेक अनादरित", "支票退票", "Rejet du chèque"), field: "dishonour_date", order: 3 },
    { key: "notice_issued", label: l4("Legal notice issued", "कानूनी नोटिस जारी", "发出法律通知", "Envoi du constat juridique"), field: "notice_date", order: 4 },
    { key: "notice_received", label: l4("Notice received", "नोटिस प्राप्त", "收到通知", "Réception du constat"), field: "receipt_date", order: 5 },
    { key: "payment_window", label: l4("15-day payment window", "15-दिन की भुगतान अवधि", "15天付款期限", "Fenêtre de paiement de 15 jours"), field: "derived", order: 6 },
  ],
  debt_collection: [
    { key: "notice_sent", label: l4("Collection notice sent", "वसूली नोटिस भेजा", "发出催收通知", "Envoi de la lettre de recouvrement"), field: "notice_date", order: 1 },
    { key: "notice_received", label: l4("Notice received", "नोटिस प्राप्त", "收到通知", "Réception du constat"), field: "receipt_date", order: 2 },
    { key: "dispute_window", label: l4("30-day dispute window", "30-दिन विवाद अवधि", "30天争议期限", "Fenêtre de contestation de 30 jours"), field: "derived", order: 3 },
  ],
  eviction: [
    { key: "contract_signed", label: l4("Rental contract signed", "किराया अनुबंध हस्ताक्षरित", "签订租赁合同", "Signature du bail"), field: "contract_date", order: 1 },
    { key: "arrears_accrued", label: l4("Rent unpaid (months claimed)", "किराया बकाया (महीने)", "租金未付（月份）", "Loyers impayés (mois réclamés)"), field: "rent_months", order: 2 },
    { key: "demand_sent", label: l4("Payment demand sent", "भुगतान मांग भेजी", "发出付款催告", "Envoi de la demande de paiement"), field: "notice_date", order: 3 },
    { key: "lawsuit_notified", label: l4("Eviction claim notified", "बेदखली मुकदमा अधिसूचित", "驱逐诉讼送达", "Notification de la demande d'expulsion"), field: "court_notification_date", order: 4 },
    { key: "enervar_window", label: l4("10-business-day enervación window", "10 कार्य-दिवस enervación अवधि", "10个工作日 enervación 期限", "Délai d'enervación de 10 jours ouvrables"), field: "derived", order: 5 },
  ],
  consumer: [
    { key: "purchase", label: l4("Purchase / service", "खरीद / सेवा", "购买/服务", "Achat / service"), field: "purchase_date", order: 1 },
    { key: "problem", label: l4("Problem arose", "समस्या उत्पन्न", "问题发生", "Survenance du problème"), field: "cause_of_action_date", order: 2 },
    { key: "notice_issued", label: l4("Notice issued", "नोटिस जारी", "发出通知", "Envoi du constat"), field: "notice_date", order: 3 },
  ],
  court_summons: [
    { key: "summons_issued", label: l4("Summons issued", "सम्मन जारी", "发出传票", "Émission de la citation"), field: "notice_date", order: 1 },
    { key: "summons_received", label: l4("Summons received", "सम्मन प्राप्त", "收到传票", "Réception de la citation"), field: "receipt_date", order: 2 },
    { key: "hearing", label: l4("Hearing / answer due", "सुनवाई / जवाब देय", "开庭/答辩截止", "Audience / réponse due"), field: "hearing_date", order: 3 },
  ],
};

const GENERIC_TIMELINE: TimelineTemplate[] = [
  { key: "notice_issued", label: l4("Notice issued", "नोटिस जारी", "发出通知", "Envoi du constat"), field: "notice_date", order: 1 },
  { key: "notice_received", label: l4("Notice received", "नोटिस प्राप्त", "收到通知", "Réception du constat"), field: "receipt_date", order: 2 },
  { key: "deadline", label: l4("Response deadline", "जवाबी समा-सीमा", "答复截止日", "Délai de réponse"), field: "derived", order: 3 },
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
      title: l4("Pay within 15 days of receipt to close the §138 exposure", "प्राप्ति के 15 दिन के भीतर भुगतान करें", "在收到后15天内付款以消除第138条风险", "Payer sous 15 jours dès réception pour clore le volet art. 138"),
      detail: l4(
        "If the statutory requirements are satisfied and the amount is paid within 15 days of receiving the notice, no criminal complaint under §138 can be filed for that cheque.",
        "यदि वैधानिक शर्तें पूरी हों और नोटिस प्राप्ति के 15 दिन के भीतर राशि चुका दी जाए, तो उस चेक के लिए धारा 138 के अंतर्गत आपराधिक शिकायत दर्ज नहीं की जा सकती।",
        "如法定条件成就且在收到通知后15天内付款，则不能就该支票依第138条提起刑事控告。",
        "Si les conditions légales sont réunies et le montant payé sous 15 jours dès réception, aucune plainte pénale au titre de l'art. 138 ne peut être déposée pour ce chèque.",
      ),
    },
    {
      source_id: "in_ni_138",
      title: l4("§138 applies only when the claimant met their own conditions", "§138 तभी लागू होता है जब दावेदार ने अपनी शर्तें पूरी की हों", "第138条仅在索赔方满足其自身条件时适用", "L'art. 138 ne s'applique que si le réclamant a rempli ses propres conditions"),
      detail: l4(
        "The statute requires that the cheque was presented within 3 months and that the demand notice was sent within 30 days of the dishonour memo. Whether those conditions are met can be checked from your documents.",
        "कानून यह मांगता है कि चेक 3 महीने के भीतर प्रस्तुत हो और अनादरण मेमो के 30 दिन के भीतर मांग-नोटिस भेजा जाए। ये शर्तें पूरी हुईं या नहीं, यह आपके दस्तावेज़ों से जांचा जा सकता है।",
        "法律要求支票在3个月内提示，且催告通知须在退票凭证后30天内发出。这些条件是否满足，可通过您的文件核对。",
        "La loi exige la présentation du chèque sous 3 mois et l'envoi du constat sous 30 jours après le mémoire de rejet. Ces conditions se vérifient avec vos documents.",
      ),
    },
  ],
  debt_collection: [
    {
      source_id: "fdcpa_1692g",
      title: l4("Dispute in writing within 30 days of receipt", "प्राप्ति के 30 दिन के भीतर लिखित विवाद", "收到后30天内书面提出争议", "Contester par écrit sous 30 jours dès réception"),
      detail: l4(
        "If you dispute the debt — or any part of it — in writing within 30 days of receiving the notice, the collector must stop collection until it obtains and mails verification of the debt.",
        "यदि आप नोटिस प्राप्ति के 30 दिन के भीतर कर्ज — या उसके किसी भाग — को लिखित रूप में विवादित करते हैं, तो कलेक्टर को सत्यापन मिलने और भेजे जाने तक वसूली रोकनी होगी।",
        "若在收到通知后30天内以书面争议全部或部分债务，催收方须暂停催收，直至取得并向您寄送债务核实材料。",
        "Si vous contestez la dette — en tout ou partie — par écrit sous 30 jours, le collecteur doit suspendre le recouvrement jusqu'à vérification.",
      ),
    },
    {
      source_id: "fdcpa_1692g",
      title: l4("Request the original creditor's details", "मूल लेनदार का विवरण मांगें", "可要求提供原始债权人信息", "Demander les coordonnées du créancier initial"),
      detail: l4(
        "Upon written request within the same 30-day window, the collector must provide the name and address of the original creditor.",
        "उसी 30-दिन की अवधि में लिखित अनुरोध पर, कलेक्टर को मूल लेनदार का नाम और पता देना होगा।",
        "在同一30天期限内提出书面请求的，催收方必须提供原始债权人的名称和地址。",
        "Sur demande écrite dans le même délai de 30 jours, le collecteur doit fournir le nom et l'adresse du créancier initial.",
      ),
    },
    {
      source_id: "fdcpa_1692e",
      title: l4("Protection against false or abusive collection tactics", "झूठी या दुर्व्यवहारपूर्ण वसूली से सुरक्षा", "免受虚假或骚扰性催收行为的保护", "Protection contre les pratiques fallacieuses ou abusives"),
      detail: l4(
        "The FDCPA prohibits false, deceptive or misleading representations and harassment — including threats of legal action that is not intended or not permitted.",
        "FDCPA झूठे, भ्रामक वक्तव्य और उत्पीड़न प्रतिबंधित करता है — जिनमें वे कानूनी कार्रवाइयों की धमकियाँ भी हैं जो की जाने वाली नहीं हैं या अनुमत नहीं हैं।",
        "《公平债务催收作业法》禁止虚假、误导性陈述和骚扰行为——包括不打算实施或不被允许的法律行动威胁。",
        "La FDCPA interdit les mentions fallacieuses et le harcèlement — y compris les menaces d'actions non envisagées ou non autorisées.",
      ),
    },
  ],
  eviction: [
    {
      source_id: "es_lec_22",
      title: l4("Stop a first eviction claim by paying everything owed (enervación)", "बकाया चुकाकर पहली बेदखली रोकें (enervación)", "付清欠款以阻止首次驱逐诉讼（enervación）", "Arrêter une première expulsion en payant tout ce qui est dû (enervación)"),
      detail: l4(
        "In a first eviction claim for unpaid rent, paying the landlord ALL amounts owed within 10 business days of the claim's notification can stop the eviction (enervación).",
        "बकाया किराए की पहली बेदखली कार्रवाई में, मुकदमे की अधिसूचना के 10 कार्य-दिवसों के भीतर मकान मालिक को पूरी बकाया राशि चुकाने से बेदखली रुक सकती है (enervación)।",
        "在首次欠租驱逐诉讼中，于诉讼送达后10个工作日内向房东付清全部欠款，可阻止驱逐（enervación）。",
        "En cas de première demande d'expulsion pour loyers impayés, payer TOUTES les sommes dues sous 10 jours ouvrables dès la notification peut arrêter l'expulsion (enervación).",
      ),
    },
    {
      source_id: "es_lec_22",
      title: l4("Enervación has its own limits", "Enervación की अपनी सीमाएँ हैं", "Enervación 有其适用限制", "L'enervación a ses propres limites"),
      detail: l4(
        "Enervation is not available if it was already used before, or if the landlord demanded payment at least 30 days earlier without result. This must be checked against the case history.",
        "यह पहले भी इस्तेमाल हो चुका हो, या मकान मालिक ने कम से कम 30 दिन पहले बिना नतीजे भुगतान की मांग की हो, तो enervation उपलब्ध नहीं है। यह मामले के इतिहास से जांचना होगा।",
        "如此前已使用过 enervación，或房东至少30天前曾催告付款但无果，则不能再次适用。需结合案件历史核实。",
        "L'enervation n'est pas possible si elle a déjà été utilisée, ou si le bailleur a exigé le paiement au moins 30 jours plus tôt sans résultat. À vérifier selon l'historique.",
      ),
    },
  ],
  consumer: [
    {
      source_id: "in_cpa_s35",
      title: l4("File a complaint with the District Commission", "जिला आयोग में शिकायत दर्ज करें", "可向地区委员会投诉", "Déposer plainte auprès de la Commission de district"),
      detail: l4(
        "A consumer may file a complaint with the District Commission relating to defective goods or deficient services, ordinarily within two years from the cause of action; a lawyer is not mandatory.",
        "उपभोक्ता जिला आयोग में दोषपूर्ण माल या घटिया सेवा संबंधी शिकायत दर्ज कर सकता है — सामान्यतः विवाद के दो वर्ष के भीतर; वकील अनिवार्य नहीं है।",
        "消费者可就缺陷商品或瑕疵服务向地区委员会投诉，一般应在争议发生起两年内提出；无需强制聘请律师。",
        "Le consommateur peut saisir la Commission de district pour produits défectueux ou services défaillants, généralement sous deux ans ; l'avocat n'est pas obligatoire.",
      ),
    },
  ],
  court_summons: [
    {
      source_id: "in_cpc_o9r6",
      title: l4("The right to be heard before any decision", "किसी भी निर्णय से पहले सुनवाई का अधिकार", "在任何裁决前获得聆讯的权利", "Le droit d'être entendu avant toute décision"),
      detail: l4(
        "If you appear and answer, the court decides the case with your participation. Ex-parte proceedings (decided without you) are only possible when a party does not appear when the suit is called on for hearing.",
        "यदि आप उपस्थित होकर जवाब देते हैं, तो अदालत आपकी भागीदारी के साथ मामला तय करती है। एकपक्षीय कार्रवाई (आपके बिना निर्णय) तभी संभव है जब पक्षकार सुनवाई पर उपस्थित न हो।",
        "如您出庭并答辩，法院将在您参与下审理案件。只有当事人经合法传唤未出庭时，才可能进行缺席（一方）审理。",
        "Si vous comparaissez et répondez, le tribunal statue avec votre participation. Une procédure par défaut n'est possible que si une partie ne comparaît pas à l'audience.",
      ),
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
      text: l4(
        "If the amount is not paid within the 15-day window and the statutory requirements are otherwise satisfied, the payee may file a criminal complaint under §138 read with §142 of the NI Act.",
        "यदि 15-दिन की अवधि में राशि भुगतान नहीं होती और अन्य वैधानिक शर्तें पूरी होती हैं, तो लाभार्थी धारा 138 (धारा 142 सहित) के अंतर्गत आपराधिक शिकायत दर्ज कर सकता है।",
        "如未在15天期限内付款且其他法定条件成就，收款方可依《流通票据法》第138条连同第142条提起刑事控告。",
        "Si le montant n'est pas payé sous 15 jours et que les autres conditions légales sont réunies, le bénéficiaire peut déposer une plainte pénale au titre des art. 138 et 142 du NI Act.",
      ),
    },
    {
      key: "prosecution",
      tone: "danger",
      text: l4(
        "If such a complaint is filed and the offence is proved, the court may impose imprisonment up to two years, a fine up to twice the cheque amount, or both.",
        "यदि ऐसी शिकायत दर्ज हो और अपराध सिद्ध हो, तो अदालत दो वर्ष तक की कैद, चेक राशि के दोगुने तक का जुर्माना, या दोनों का दंड दे सकती है।",
        "如控告被受理且罪名成立，法院可判处最高两年监禁、支票金额两倍以下的罚金，或两者并罚。",
        "Si la plainte est déposée et l'infraction établie, le tribunal peut prononcer jusqu'à deux ans d'emprisonnement, une amende allant jusqu'au double du montant du chèque, ou les deux.",
      ),
    },
    {
      key: "civil_recovery",
      tone: "neutral",
      text: l4(
        "Separately, the outstanding amount may still be pursued through civil recovery regardless of the criminal track.",
        "अलग से, आपराधिक रास्ते के बावजूद बकाया राशि की नागरिक वसूली की जा सकती है।",
        "此外，无论刑事程序如何，欠款仍可能通过民事途径追偿。",
        "Par ailleurs, le montant dû peut être recouvré par la voie civile, indépendamment du volet pénal.",
      ),
    },
  ],
  debt_collection: [
    {
      key: "collection_continues",
      tone: "warning",
      text: l4(
        "If the debt is not disputed or resolved, collection activity may continue and the matter may be referred to a court.",
        "यदि कर्ज विवादित या सुलझाया नहीं जाता, तो वसूली जारी रह सकती है और मामला अदालत जा सकता है।",
        "如债务未被争议或解决，催收可能继续，案件可能被移交法院。",
        "Si la dette n'est ni contestée ni réglée, le recouvrement peut se poursuivre et le dossier être porté devant un tribunal.",
      ),
    },
    {
      key: "judgment",
      tone: "danger",
      text: l4(
        "If a lawsuit is filed and goes unanswered, a default judgment may be entered for the amount demanded, which can be enforced through wage garnishment or bank levies.",
        "यदि मुकदमा दर्ज हो और जवाब न दिया जाए, तो मांगी गई राशि पर पूर्वनिर्णय (default judgment) हो सकता है, जिसे वेतन कटौती या बैंक ज़ब्ती से लागू किया जा सकता है।",
        "如提起诉讼且未应诉，可能被缺席判决支付所请金额，并可通过工资扣划或银行扣押执行。",
        "Si une action est intentée sans réponse, un jugement par défaut peut être rendu pour le montant demandé, exécutable par saisie de salaire ou de compte.",
      ),
    },
  ],
  eviction: [
    {
      key: "eviction_claim",
      tone: "warning",
      text: l4(
        "If the arrears are not settled, the landlord may file an eviction claim for non-payment under LAU art. 27.2.a).",
        "यदि बकाया न चुके, तो मकान मालिक LAU कलम 27.2.a) के तहत गैर-भुगतान हेतु बेदखली मुकदमा दायर कर सकता है।",
        "如欠租未解决，房东可依 LAU 第27.2.a)条提起欠付驱逐诉讼。",
        "Si les arriérés ne sont pas réglés, le bailleur peut engager une demande d'expulsion pour non-paiement (LAU art. 27.2.a).",
      ),
    },
    {
      key: "possession",
      tone: "danger",
      text: l4(
        "If the claim succeeds and the arrears are not paid within the enervación window, a court may order eviction and award unpaid rent plus interest and costs.",
        "यदि दावा स्वीकार हो और enervación अवधि में बकाया न चुके, तो अदालत बेदखली का आदेश दे सकती है और बकाया किराया, ब्याज व व्यय दिला सकती है।",
        "如诉讼请求成立且未在 enervación 期限内付款，法院可判决腾退房屋，并判付欠租、利息及费用。",
        "Si la demande aboutit sans paiement dans le délai d'enervación, le tribunal peut ordonner l'expulsion et allouer les loyers impayés, intérêts et frais.",
      ),
    },
  ],
  court_summons: [
    {
      key: "ex_parte",
      tone: "danger",
      text: l4(
        "If you do not appear when the suit is called on for hearing, the court may proceed ex parte and decide the case without hearing your side.",
        "यदि सुनवाई पर आप उपस्थित नहीं होते, तो अदालत एकपक्षीय कार्रवाई कर आपकी सुनवाई के बिना निर्णय दे सकती है।",
        "如开庭时您未出庭，法院可进行缺席审理，在您未陈述的情况下作出裁决。",
        "Si vous ne comparaissez pas à l'audience, le tribunal peut statuer par défaut sans vous entendre.",
      ),
    },
  ],
};

const GENERIC_CONSEQUENCES: ConsequenceTemplate[] = [
  {
    key: "no_action",
    tone: "warning",
    text: l4(
      "If no response is made within the stated period, the sender may consider further legal steps. What those steps are depends on the notice type and the applicable rules.",
      "यदि बताई गई अवधि में जवाब नहीं दिया जाता, तो भेजने वाला आगे कानूनी कदम उठा सकता है। वे कदम क्या होंगे, यह नोटिस के प्रकार और लागू नियमों पर निर्भर करता है।",
      "如在载明期限内未作回应，发送方可能采取进一步法律步骤。具体步骤取决于通知类型与适用规则。",
      "Sans réponse dans le délai indiqué, l'expéditeur peut envisager des suites judiciaires, selon le type de constat et les règles applicables.",
    ),
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
      title: l4("Confirm when the notice was received", "पुष्टि करें कि नोटिस कब प्राप्त हुआ", "确认何时收到该通知", "Confirmer la date de réception du constat"),
      reason: l4(
        "The statutory response period depends on receipt of the notice, so the exact deadline cannot be calculated until this date is confirmed.",
        "वैधानिक जवाबी अवधि नोटिस प्राप्ति पर निर्भर है, इसलिए यह तिथि पुष्ट हुए बिना सटीक समा-सीमा नहीं निकल सकती।",
        "法定答复期限自收到通知起算，因此在确认该日期之前无法计算确切截止日。",
        "Le délai légal dépend de la réception du constat : le délai exact ne peut être calculé sans cette date.",
      ),
    },
    {
      key: "verify_cheque", priority: 2, source_id: null,
      when: () => true,
      title: l4("Verify the cheque and bank details", "चेक और बैंक विवरण जांचें", "核对支票与银行信息", "Vérifier le chèque et les données bancaires"),
      reason: l4(
        "Check the cheque number, date, bank and amount against your own records before responding to the claim.",
        "दावे का जवाब देने से पहले चेक संख्या, तारीख, बैंक और राशि अपने रिकॉर्ड से मिलाएँ।",
        "在回应索赔之前，先将支票号码、日期、银行和金额与您自己的记录核对。",
        "Vérifiez numéro, date, banque et montant avec vos propres documents avant de répondre.",
      ),
    },
    {
      key: "preserve_documents", priority: 3, source_id: null,
      when: () => true,
      title: l4("Preserve all relevant documents", "सभी प्रासंगिक दस्तावेज़ सुरक्षित रखें", "保存所有相关文件", "Conserver tous les documents pertinents"),
      reason: l4(
        "Keep the cheque, invoices, bank memos and this notice — they are the evidence base for any response or defence.",
        "चेक, इनवॉइस, बैंक मेमो और यह नोटिस संभालकर रखें — यही जवाब या बचाव का साक्ष्य आधार हैं।",
        "保存支票、发票、银行凭证及本通知——它们是任何答复或抗辩的证据基础。",
        "Conservez chèque, factures, mémos et le présent constat — ce sont les preuves de toute réponse ou défense.",
      ),
    },
    {
      key: "act_before_deadline", priority: 4, source_id: "in_ni_138",
      when: (c) => c.deadline_calculated,
      title: l4("Decide before the deadline: pay or prepare a response", "समा-सीमा से पहले तय करें: भुगतान या जवाब", "在截止日前决定：付款或准备答复", "Décider avant l'échéance : payer ou préparer une réponse"),
      reason: l4(
        "Paying the claimed amount within the statutory window closes the §138 exposure; otherwise a written response through a lawyer is the usual next step.",
        "वैधानिक अवधि में राशि चुकाने से §138 का जोखिम समाप्त हो जाता है; अन्यथा अगला सामान्य कदम वकील के जरिए लिखित जवाब है।",
        "在法定期限内付款可消除第138条风险；否则下一步通常是由律师起草书面答复。",
        "Payer dans le délai légal éteint l'exposition à l'art. 138 ; sinon, l'étape suivante usuelle est une réponse écrite via un avocat.",
      ),
    },
    {
      key: "consult_lawyer", priority: 5, source_id: "in_ni_138",
      when: (c) => c.severity === "red",
      title: l4("Review the claim with a qualified lawyer", "योग्य वकील से दावा समीक्षा कराएँ", "与合格律师研究该索赔", "Faire examiner la créance par un avocat qualifié"),
      reason: l4(
        "§138 notices carry criminal exposure while unpaid — a lawyer should review the documents before the window closes.",
        "§138 नोटिस में अवैतनिक अवस्था में आपराधिक जोखिम होता है — अवधि समाप्त होने से पहले वकील से दस्तावेज़ समीक्षा कराएँ।",
        "第138条通知在未付款期间涉及刑事风险——应在期限届满前由律师审阅文件。",
        "Les constats art. 138 exposent au pénal tant que c'est impayé — un avocat doit examiner les documents avant l'échéance.",
      ),
    },
  ],
  debt_collection: [
    {
      key: "confirm_receipt", priority: 1, source_id: "fdcpa_1692g",
      when: (c) => c.missing.includes("receipt_date"),
      title: l4("Confirm when the notice was received", "पुष्टि करें कि नोटिस कब प्राप्त हुआ", "确认何时收到该通知", "Confirmer la date de réception"),
      reason: l4(
        "The 30-day dispute and verification-request window runs from receipt of the notice.",
        "30-दिन की विवाद व अनुरोध अवधि नोटिस प्राप्ति से चलती है।",
        "30天争议及索取核实材料的期限自收到通知起算。",
        "Le délai de 30 jours pour contester et demander la vérification court à compter de la réception.",
      ),
    },
    {
      key: "request_validation", priority: 2, source_id: "fdcpa_1692g",
      when: () => true,
      title: l4("Request written verification of the debt", "कर्ज का लिखित सत्यापन मांगें", "要求对债务进行书面核实", "Demander une vérification écrite de la dette"),
      reason: l4(
        "A written dispute within the window obliges the collector to stop collection until it verifies the debt; you may also request the original creditor's name and address.",
        "अवधि में लिखित विवाद करने पर सत्यापन तक वसूली रुक जाती है; मूल लेनदार का नाम-पता भी मांगा जा सकता है।",
        "在期限内书面提出争议可迫使催收方暂停催收直至完成核实；同时可索取原始债权人名称与地址。",
        "Une contestation écrite dans le délai suspend le recouvrement jusqu'à vérification ; le nom et l'adresse du créancier initial peuvent aussi être demandés.",
      ),
    },
    {
      key: "check_statements", priority: 3, source_id: null,
      when: () => true,
      title: l4("Match the claimed amount to your own records", "दावे की राशि अपने रिकॉर्ड से मिलाएँ", "将所主张金额与自己的记录核对", "Rapprocher le montant réclamé de vos relevés"),
      reason: l4(
        "Compare the balance and fees claimed against your statements before agreeing to anything.",
        "कुछ भी स्वीकार करने से पहले दावे वाली राशि व शुल्क अपने विवरण से मिलाएँ।",
        "在同意任何方案之前，先核对所主张的余额与费用是否与账单一致。",
        "Comparez le solde et les frais réclamés avec vos relevés avant tout accord.",
      ),
    },
    {
      key: "consult_lawyer", priority: 4, source_id: "ny_cplr_320",
      when: (c) => c.severity === "red",
      title: l4("Consult a lawyer about the threatened court action", "धमकी वाली अदालती कार्रवाई पर वकील से सलाह लें", "就威胁的诉讼咨询律师", "Consulter un avocat au sujet de l'action menacée"),
      reason: l4(
        "The letter refers the matter to court where a default judgment can be enforced by wage garnishment — get advice before that stage.",
        "पत्र मामला अदालत जाने की बात करता है, जहाँ पूर्वनिर्णय से वेतन कटौती हो सकती है — उस स्थिति से पहले सलाह लें।",
        "信中提及将诉诸法院，缺席判决可能导致工资扣划——应在此之前寻求建议。",
        "La lettre évoque une action en justice où un jugement par défaut peut être exécuté par saisie — consultez avant ce stade.",
      ),
    },
  ],
  eviction: [
    {
      key: "confirm_notification", priority: 1, source_id: "es_lec_22",
      when: (c) => c.missing.includes("court_notification_date"),
      title: l4("Confirm whether an eviction claim has been notified yet", "पुष्टि करें कि बेदखली मुकदमा अधिसूचित हुआ या नहीं", "确认驱逐诉讼是否已送达", "Confirmer si une demande d'expulsion a été notifiée"),
      reason: l4(
        "The 10-business-day enervación window only starts once the claim is notified — without that date the deadline cannot be calculated.",
        "10 कार्य-दिवस की enervación अवधि केवल मुकदमा अधिसूचित होने पर शुरू होती है — तिथि के बिना समा-सीमा नहीं निकल सकती।",
        "10个工作日的 enervación 期限自诉讼送达起算——没有该日期无法计算截止日。",
        "Le délai d'enervación de 10 jours ouvrables ne court qu'à compter de la notification — sans cette date, aucun calcul.",
      ),
    },
    {
      key: "check_arrears", priority: 2, source_id: "es_lau_27",
      when: () => true,
      title: l4("Check the arrears against rent receipts", "किराया रसीदों से बकाया जांचें", "用租金凭证核对欠款", "Vérifier les arriérés avec les quittances"),
      reason: l4(
        "Match the claimed unpaid months and amounts against your contract and payment receipts.",
        "दावे वाले महीने व राशि अपने अनुबंध व भुगतान रसीदों से मिलाएँ।",
        "将所主张的未付月份和金额与合同及付款凭证核对。",
        "Rapprochez les mois et montants réclamés du bail et de vos quittances.",
      ),
    },
    {
      key: "plan_payment", priority: 3, source_id: "es_lec_22",
      when: () => true,
      title: l4("Plan how to settle the arrears", "बकाया चुकाने की योजना बनाएँ", "规划清偿欠款", "Planifier le règlement des arriérés"),
      reason: l4(
        "Paying everything owed can stop a first eviction claim (enervación) if done within the statutory window after notification.",
        "अधिसूचना के बाद वैधानिक अवधि में पूरा बकाया चुकाने से पहली बेदखली कार्रवाई रुक सकती है (enervación)।",
        "在送达后的法定期限内付清全部欠款可阻止首次驱逐诉讼（enervación）。",
        "Payer tout ce qui est dû dans le délai légal après notification peut arrêter une première demande (enervación).",
      ),
    },
    {
      key: "consult_lawyer", priority: 4, source_id: "es_lec_22",
      when: (c) => c.severity === "red",
      title: l4("Consult a lawyer about the eviction claim", "बेदखली मुकदमे पर वकील से सलाह लें", "就驱逐诉讼咨询律师", "Consulter un avocat sur la demande d'expulsion"),
      reason: l4(
        "Home at risk: a lawyer can check enervation eligibility and represent you in the first-instance court.",
        "घर का जोखिम: वकील enervation पात्रता जांच सकता है और प्रथम-दृष्ट न्यायालय में आपका प्रतिनिधित्व कर सकता है।",
        "住房面临风险：律师可核查 enervación 资格并代理一审程序。",
        "Logement en jeu : un avocat peut vérifier l'éligibilité à l'enervación et vous représenter en première instance.",
      ),
    },
  ],
  court_summons: [
    {
      key: "confirm_hearing", priority: 1, source_id: "in_cpc_o9r6",
      when: (c) => c.missing.includes("hearing_date"),
      title: l4("Confirm the hearing / answer date", "सुनवाई / जवाब तिथि पुष्टि करें", "确认开庭/答辩日期", "Confirmer la date d'audience / de réponse"),
      reason: l4("The summons must state when to appear or answer — that date drives every next step.", "सम्मन में उपस्थिति/जवाब की तिथि होनी चाहिए — वही तिथि सब आगे के कदम तय करती है।", "传票应载明出庭或答辩日期——该日期决定后续所有安排。", "La citation doit indiquer la date de comparution — elle conditionne toute la suite."),
    },
    {
      key: "prepare_appearance", priority: 2, source_id: "in_cpc_o9r6",
      when: () => true,
      title: l4("Prepare to appear or file an answer", "उपस्थिति या जवाब की तैयारी करें", "准备出庭或提交答辩", "Préparer la comparution ou la réponse"),
      reason: l4("Organise your documents and consider engaging a lawyer before the stated date.", "बताई गई तिथि से पहले दस्तावेज़ सजाएँ और वकील पर विचार करें।", "在载明日期前整理文件并考虑聘请律师。", "Organisez vos documents et envisagez un avocat avant la date indiquée."),
    },
  ],
};

const GENERIC_ACTIONS: ActionTemplate[] = [
  {
    key: "confirm_receipt", priority: 1, source_id: null,
    when: (c) => c.missing.includes("receipt_date"),
    title: l4("Confirm when the notice was received", "पुष्टि करें कि नोटिस कब प्राप्त हुआ", "确认何时收到该通知", "Confirmer la date de réception"),
    reason: l4("Response periods usually run from receipt — the exact deadline depends on this date.", "जवाबी अवधि सामान्यतः प्राप्ति से चलती है — सटीक समा-सीमा इसी तिथि पर निर्भर है।", "答复期限通常自收到起算——确切截止日取决于该日期。", "Les délais courent généralement de la réception — l'échéance exacte en dépend."),
  },
  {
    key: "gather_documents", priority: 2, source_id: null,
    when: () => true,
    title: l4("Gather documents related to the notice", "नोटिस से जुड़े दस्तावेज़ इकट्ठा करें", "收集与通知相关的文件", "Rassembler les documents liés au constat"),
    reason: l4("Contracts, receipts and correspondence are the evidence base for any response.", "अनुबंध, रसीदें और पत्राचार ही किसी जवाब का साक्ष्य आधार हैं।", "合同、凭证与往来函件是任何答复的证据基础。", "Contrats, reçus et courriers constituent la base de preuve de toute réponse."),
  },
  {
    key: "respond_before_deadline", priority: 3, source_id: null,
    when: (c) => c.deadline_calculated,
    title: l4("Respond in writing before the deadline", "समा-सीमा से पहले लिखित जवाब दें", "在截止日前书面答复", "Répondre par écrit avant l'échéance"),
    reason: l4("A dated, written response preserves your position whatever you decide later.", "तय तिथि वाला लिखित जवाब बाद के किसी भी निर्णय में आपकी स्थिति सुरक्षित रखता है।", "注明日期的书面答复可在您后续决定时保留立场。", "Une réponse écrite datée préserve votre position, quelle que soit votre décision."),
  },
  {
    key: "consult_lawyer", priority: 4, source_id: null,
    when: (c) => c.severity === "red",
    title: l4("Consult a qualified lawyer", "योग्य वकील से सलाह लें", "咨询合格律师", "Consulter un avocat qualifié"),
    reason: l4("This notice is rated critical — a lawyer should review it before the deadline.", "यह नोटिस गंभीर श्रेणी में है — समा-सीमा से पहले वकील से समीक्षा कराएँ।", "该通知被评定为紧急——应在截止日前请律师审阅。", "Ce constat est jugé critique — un avocat doit l'examiner avant l'échéance."),
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
    title: l4("Prepare your defence file", "अपना बचाव फ़ाइल तैयार करें", "准备抗辩材料", "Préparer votre dossier de défense"),
    reason: l4(
      "Since you dispute the claim, collect every document that contradicts it — statements, receipts, correspondence — before drafting your reply.",
      "चूंकि आप दावे से असहमत हैं, जवाब लिखने से पहले हर वह दस्तावेज़ इकट्ठा करें जो उसके विपरीत है — विवरण, रसीदें, पत्राचार।",
      "由于您对索赔有异议，请在起草答复前收集所有与之相矛盾的材料——对账单、凭证、往来函件。",
      "La créance étant contestée, réunissez tout document contradictoire — relevés, reçus, courriers — avant de rédiger la réponse.",
    ),
  },
  already_paid: {
    key: "collect_payment_proof", priority: 2.5, source_id: null,
    when: () => true,
    title: l4("Collect proof of payment", "भुगतान का प्रमाण इकट्ठा करें", "收集付款证明", "Rassembler les preuves de paiement"),
    reason: l4(
      "Since you state the amount was already paid, bank confirmations or receipts are the key evidence to attach to your response.",
      "चूंकि आप कहते हैं कि राशि चुक गई, बैंक पुष्टि या रसीदें ही जवाब के साथ जोड़ने वाले मुख्य साक्ष्य हैं।",
      "由于您表示款项已付，银行确认单或收据是答复中应附的关键证据。",
      "Le paiement étant invoqué, les confirmations bancaires ou reçus sont les preuves clés à joindre à la réponse.",
    ),
  },
  partial_dispute: {
    key: "reconcile_amounts", priority: 2.5, source_id: null,
    when: () => true,
    title: l4("Build a line-by-line reconciliation", "राशि का वस्तुनिष्ठ मिलान बनाएँ", "逐项核对金额", "Établir un rapprochement détaillé"),
    reason: l4(
      "Since you dispute only part of the claim, a table matching each claimed item to your records makes the response precise.",
      "चूंकि आप दावे का केवल भाग अस्वीकार करते हैं, प्रत्येक मद को अपने रिकॉर्ड से मिलाने वाली तालिका जवाब को सटीक बनाती है।",
      "由于您仅对部分索赔有异议，逐项与记录核对的清单能让答复更精确。",
      "Ne contest qu'une partie : un rapprochement ligne à ligne rendra la réponse précise.",
    ),
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
    { key: "enforceable_debt", text: l4("Was the cheque issued towards a legally enforceable debt, in your view?", "आपके अनुसार क्या चेक किसी विधिक रूप से प्रवर्तनीय देनदारी के लिए जारी हुआ था?", "您认为该支票是否用于合法可强制执行的债务？", "Le chèque couvrait-il, selon vous, une créance légalement exécutoire ?") },
    { key: "receipt_date", when: (c) => c.missing.includes("receipt_date"), text: l4("When was the notice actually received? (This sets the 15-day window.)", "नोटिस वास्तव में कब प्राप्त हुआ? (इसी से 15-दिन की अवधि तय होती है।)", "通知实际是何时收到的？（这决定15天期限的起算。）", "Quand le constat a-t-il été réellement reçu ? (Cela fixe le délai de 15 jours.)") },
    { key: "conditions_check", text: l4("Do your documents show the cheque was presented within 3 months and the notice sent within 30 days of the dishonour memo?", "क्या आपके दस्तावेज़ दिखाते हैं कि चेक 3 महीने में प्रस्तुत हुआ और अनादरण मेमो के 30 दिन में नोटिस गया?", "您的文件能否显示支票在3个月内提示、通知在退票凭证后30天内发出？", "Vos documents montrent-ils une présentation sous 3 mois et un constat sous 30 jours après le rejet ?") },
    { key: "partial_payment", when: (c) => c.position === "partial_dispute" || c.position === "full_dispute", text: l4("Has any part of the amount been paid, and what proof exists?", "क्या कोई राशि चुकी है, और उसका प्रमाण है?", "是否已支付过部分款项？有何凭证？", "Une partie du montant a-t-elle été payée, et avec quelles preuves ?") },
  ],
  debt_collection: [
    { key: "debt_valid", text: l4("Does the claimed balance match your own account records?", "क्या दावे वाली राशि आपके खाता विवरण से मेल खाती है?", "所主张的余额与您的账户记录是否一致？", "Le solde réclamé correspond-il à vos relevés ?") },
    { key: "within_window", when: (c) => c.missing.includes("receipt_date"), text: l4("When did you receive this letter? (The 30-day dispute window depends on it.)", "यह पत्र आपको कब मिला? (30-दिन की विवाद अवधि इसी पर निर्भर है।)", "您何时收到此信？（30天争议期由此起算。）", "Quand avez-vous reçu cette lettre ? (Le délai de 30 jours en dépend.)") },
    { key: "statute_barred", when: (c) => c.position === "full_dispute" || c.position === "dont_recognize", text: l4("Could the debt be time-barred or already settled? What records support that?", "क्या कर्ज समय-सीमा से बाहर है या चुक चुका है? इसके पक्ष में क्या रिकॉर्ड हैं?", "债务是否已过诉讼时效或已清偿？有哪些记录支持？", "La dette est-elle prescrite ou déjà réglée ? Quels justificatifs ?") },
  ],
  eviction: [
    { key: "enervar_eligible", text: l4("Has enervación been used before in this tenancy, or did the landlord send a prior payment demand more than 30 days ago?", "इस किरायेदारी में enervación पहले इस्तेमाल हुई है, या मकान मालिक ने 30 दिन से पहले भुगतान की मांग भेजी थी?", "本租赁中是否已用过 enervación？房东是否在30天前曾催告付款？", "L'enervación a-t-elle déjà été utilisée, ou une demande de paiement antérieure de plus de 30 jours existe-t-elle ?") },
    { key: "claim_notified", when: (c) => c.missing.includes("court_notification_date"), text: l4("Has an eviction lawsuit actually been served yet? If so, when?", "क्या बेदखली मुकदमा वास्तव में सौंपा गया है? यदि हाँ, तो कब?", "驱逐诉讼是否实际已送达？如是，何时？", "Une demande d'expulsion a-t-elle réellement été notifiée ? Si oui, quand ?") },
    { key: "arrears_correct", text: l4("Do the claimed unpaid months match your rent receipts?", "क्या दावे वाले बकाया महीने आपकी रसीदों से मेल खाते हैं?", "所主张的未付月份与您的租金凭证是否一致？", "Les mois réclamés correspondent-ils à vos quittances ?") },
  ],
};

const GENERIC_QUESTIONS: QuestionTemplate[] = [
  { key: "facts_correct", text: l4("Are the sender, the amount and the dates in the notice correct according to your records?", "नोटिस में दिया भेजने वाला, राशि और तारीखें आपके रिकॉर्ड के अनुसार सही हैं?", "通知中的发送方、金额和日期与您的记录是否一致？", "L'expéditeur, le montant et les dates du constat sont-ils exacts selon vos documents ?") },
  { key: "deadline_feasible", text: l4("Is the stated response period feasible, and what would you need to respond by then?", "क्या बताई गई जवाबी अवधि पर्याप्त है, और तब तक जवाब के लिए क्या चाहिए?", "载明的答复期限是否可行？届时答复需要哪些材料？", "Le délai indiqué est-il tenable et de quoi aurez-vous besoin pour répondre ?") },
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

My position: ${positionLine(c.position, "en")} The notice was received on ${c.deadlineText ?? "[PLACEHOLDER — USER INPUT REQUIRED: receipt date]"}${c.deadlineText ? ", so the 15-day period is running from that date" : ""}.

[Draft for review — not legal advice. Fill every placeholder and have a qualified lawyer review before sending.]

Yours faithfully,
[PLACEHOLDER — USER INPUT REQUIRED: your name]`,
    hi: `विषय: ${c.noticeDate ?? "[स्थान-भरने योग्य — नोटिस तारीख]"} के कानूनी नोटिस का उत्तर

महोदय ${c.sender ?? "[प्रेषक का नाम — उपयोगकर्ता इनपुट आवश्यक]"},

आपके धारा 138 नोटिस में मांगी गई ${c.amount ?? "[राशि — उपयोगकर्ता इनपुट आवश्यक]"} के संदर्भ में।

मेरी स्थिति: ${positionLine(c.position, "hi")} नोटिस ${c.deadlineText ?? "[प्राप्ति तिथि — उपयोगकर्ता इनपुट आवश्यक]"} को प्राप्त हुआ।

[समीक्षा हेतु प्रारूप — कानूनी सलाह नहीं। प्रत्येक रिक्त स्थान भरें और भेजने से पहले योग्य वकील से समीक्षा कराएँ।]

भवदीय,
[आपका नाम — उपयोगकर्ता इनपुट आवश्यक]`,
    zh: `主题：对${c.noticeDate ?? "[占位符——需用户填写：通知日期]"}法律通知的回复

${c.sender ?? "[占位符——需用户填写：发件方]"}：

就贵方依《流通票据法》第138条发出的、要求支付${c.amount ?? "[占位符——需用户填写：金额]"}的通知，回复如下。

我的立场：${positionLine(c.position, "zh")}通知于${c.deadlineText ?? "[占位符——需用户填写：签收日期]"}收到。

[草稿供审阅——非法律意见。请填写所有占位符，并在发送前由合格律师审阅。]

此致
[占位符——需用户填写：您的姓名]`,
    fr: `Objet : Réponse au constat juridique du ${c.noticeDate ?? "[À COMPLÉTER : date du constat]"}

Cher ${c.sender ?? "[À COMPLÉTER : expéditeur]"},

Je fais référence à votre constat au titre de l'article 138 exigeant ${c.amount ?? "[À COMPLÉTER : montant]"}.

Ma position : ${positionLine(c.position, "fr")} Le constat a été reçu le ${c.deadlineText ?? "[À COMPLÉTER : date de réception]"}.

[Projet à examiner — ne constitue pas un avis juridique. Complétez chaque champ et faites relire par un avocat avant envoi.]

Veuillez agréer mes salutations,
[À COMPLÉTER : votre nom]`,
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
  zh: `主题：对${c.noticeDate ?? "[占位符——需用户填写：通知日期]"}通知的回复

${c.sender ?? "[占位符——需用户填写：发件方]"}：

已收悉贵方关于${c.amount ? `${c.amount}` : "[占位符——需用户填写：事项]"}的通知。

我的立场：${positionLine(c.position, "zh")}

[草稿供审阅——非法律意见。请填写所有占位符，并在发送前由合格律师审阅。]

此致
[占位符——需用户填写：您的姓名]`,
  fr: `Objet : Réponse à votre constat du ${c.noticeDate ?? "[À COMPLÉTER : date]"}

Cher ${c.sender ?? "[À COMPLÉTER : expéditeur]"},

J'accuse réception de votre constat concernant ${c.amount ? `un montant de ${c.amount}` : "[À COMPLÉTER : objet]"}.

Ma position : ${positionLine(c.position, "fr")}

[Projet à examiner — ne constitue pas un avis juridique. Complétez chaque champ et faites relire par un avocat.]

Veuillez agréer mes salutations,
[À COMPLÉTER : votre nom]`,
});

function positionLine(position: UserPosition | null, locale: keyof L4): string {
  const map: Record<UserPosition, L4> = {
    agree: {
      en: "I acknowledge the claim and intend to settle it.",
      hi: "मैं दावा स्वीकार करता/करती हूँ और उसे सुलझाना चाहता/चाहती हूँ।",
      zh: "我认可该索赔并打算解决。",
      fr: "Je reconnais la créance et compte la régler.",
    },
    partial_dispute: {
      en: "I dispute part of the claimed amount; a reconciliation is attached.",
      hi: "मैं दावे के एक भाग से असहमत हूँ; मिलान विवरण संलग्न है।",
      zh: "我对部分索赔金额有异议，附上逐项核对表。",
      fr: "Je conteste une partie du montant réclamé ; un rapprochement est joint.",
    },
    full_dispute: {
      en: "I dispute the claim in full.",
      hi: "मैं पूरे दावे से असहमत हूँ।",
      zh: "我对全部索赔有异议。",
      fr: "Je conteste intégralement la créance.",
    },
    already_paid: {
      en: "The amount has already been paid; proof of payment is attached.",
      hi: "राशि भुगतान हो चुकी है; भुगतान प्रमाण संलग्न है।",
      zh: "款项已支付，随附付款凭证。",
      fr: "Le montant a déjà été payé ; preuve de paiement jointe.",
    },
    dont_recognize: {
      en: "I do not recognize this claim.",
      hi: "मैं इस दावे को नहीं पहचानता/पहचानती।",
      zh: "我不认可该索赔。",
      fr: "Je ne reconnais pas cette créance.",
    },
    unknown: {
      en: "I am still reviewing the claim.",
      hi: "मैं दावे की समीक्षा कर रहा/रही हूँ।",
      zh: "我仍在审查该索赔。",
      fr: "J'examine encore la créance.",
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
export const CONDITIONAL_REPLACEMENT: L4 = l4(
  "If the statutory requirements are satisfied and the matter proceeds, the court may impose the penalties allowed by the applicable provision.",
  "यदि वैधानिक शर्तें पूरी हों और कार्रवाई आगे बढ़े, तो अदालत लागू प्रावधान द्वारा अनुमत दंड लगा सकती है।",
  "如法定条件成就且程序继续，法院可处以适用条款所允许的处罚。",
  "Si les conditions légales sont réunies et la procédure suit son cours, le tribunal peut prononcer les sanctions prévues par la disposition applicable.",
);
