// LexLens — professional structured PDF report generator (server-side).
//
// Produces a real document (never a page screenshot): cover masthead,
// numbered sections, multi-line-safe tables, running header on every page,
// "Page N of M" footer and the mandatory disclaimer. Locale-aware fonts are
// bundled with the project so the same PDF is produced on any machine
// (Windows / macOS / Linux) without system-font requirements.
//
// Nothing internal is exposed: no engine, model, framework or provider names.

import PDFDocument from "pdfkit";
import * as fontkit from "fontkit";
import path from "node:path";
import { CORPUS } from "@/lib/lexlens/corpus";
import { buildBrief, buildCaseView, money as caseMoney, fmtISO } from "@/lib/lexlens/case-engine";
import { todayISO } from "@/lib/lexlens/deadline-engine";
import type { CaseBase, Locale, UserCaseState } from "@/lib/lexlens/types";

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
const DEVANAGARI_FONT = path.join(FONT_DIR, "NotoSansDevanagari-Regular.ttf");
const SC_FONT = path.join(FONT_DIR, "NotoSansSC-Regular.ttf");

const INDIGO = "#4338CA";
const INK = "#0F172A";
const MUTED = "#475569";
const FAINT = "#94A3B8";
const LINE = "#E2E8F0";
const FILL = "#F8FAFC";
const FILL_INDIGO = "#EEF2FF";

interface PdfStrings {
  reportTitle: string;
  generatedOn: (d: string) => string;
  preparedFor: string;
  noticeSummary: string;
  actionCenter: string;
  nextActions: string;
  timeline: string;
  keyFacts: string;
  missingInfo: string;
  evidence: string;
  legalBasis: string;
  ifNothing: string;
  yourPosition: string;
  responseDraft: string;
  lawyerBrief: string;
  disclaimer: string;
  sources: string;
  page: (n: string, m: string) => string;
  footer: string;
  fact: string;
  value: string;
  source: string;
  confidence: string;
  noticeType: string;
  jurisdiction: string;
  noticeLanguage: string;
  analysisDate: string;
  severity: string;
  claimedAmount: string;
  receiptDate: string;
  exactDeadline: string;
  daysRemaining: string;
  deadlineUnknown: string;
  cannotCalculate: (reason: string) => string;
  statusLabel: string;
  analysisCompleted: string;
  sourcesChecked: string;
  noDeadline: string;
  noneMissing: string;
  available: string;
  missingLabel: string;
  eventLabel: string;
  dateLabel: string;
  statusLabelShort: string;
  notProvided: string;
  deadlineRule: string;
  lawStatute: string;
  explanation: string;
  noDraft: string;
  noBrief: string;
  positionLabels: Record<string, string>;
  positionNone: string;
  countdown: (days: number) => string;
  dueToday: string;
  dueTomorrow: string;
  overdueBy: (d: number) => string;
  disclaimerFull: string;
  briefWarning: string;
  generatedBy: string;
  questionsFor: string;
}

const PDF_STRINGS: Record<Locale, PdfStrings> = {
  en: {
    reportTitle: "Legal Notice Analysis Report",
    generatedOn: (d) => `Generated on ${d}`,
    preparedFor: "Prepared for",
    noticeSummary: "Notice summary",
    actionCenter: "Action center",
    nextActions: "Recommended next actions",
    timeline: "Legal timeline",
    keyFacts: "Key facts",
    missingInfo: "Missing information",
    evidence: "Case evidence",
    legalBasis: "Legal basis",
    ifNothing: "What happens if I do nothing?",
    yourPosition: "Your position",
    responseDraft: "Response draft",
    lawyerBrief: "Lawyer brief",
    disclaimer: "Disclaimer",
    sources: "Sources",
    page: (n, m) => `Page ${n} of ${m}`,
    footer: "LexLens — legal information, not legal advice",
    fact: "Fact",
    value: "Value",
    source: "Source",
    confidence: "Confidence",
    noticeType: "Notice type",
    jurisdiction: "Jurisdiction",
    noticeLanguage: "Notice language",
    analysisDate: "Analysis date",
    severity: "Severity",
    claimedAmount: "Claimed amount",
    receiptDate: "Receipt date",
    exactDeadline: "Exact deadline",
    daysRemaining: "Days remaining",
    deadlineUnknown: "Cannot calculate yet",
    cannotCalculate: (r) => `Exact deadline cannot be calculated because ${r} is unknown.`,
    statusLabel: "Status",
    analysisCompleted: "Completed",
    sourcesChecked: "Verified",
    noDeadline: "No statutory deadline applies to this notice type.",
    noneMissing: "No critical information is missing.",
    available: "Available",
    missingLabel: "Missing",
    eventLabel: "Event",
    dateLabel: "Date",
    statusLabelShort: "Status",
    notProvided: "Not provided",
    deadlineRule: "Rule applied",
    lawStatute: "Law / statute",
    explanation: "Explanation",
    noDraft: "No response draft has been generated for this notice yet.",
    noBrief: "No lawyer brief has been prepared for this notice yet.",
    positionLabels: {
      agree: "Agree — intend to settle",
      partial_dispute: "Dispute part of the amount",
      full_dispute: "Dispute the claim in full",
      already_paid: "Already paid",
      dont_recognize: "Do not recognize this claim",
      unknown: "Still reviewing",
    },
    positionNone: "Not stated yet.",
    countdown: (d) => `${d} days remaining`,
    dueToday: "Due today",
    dueTomorrow: "Due tomorrow",
    overdueBy: (d) => `Overdue by ${d} day${d === 1 ? "" : "s"}`,
    disclaimerFull:
      "LexLens provides legal information and document assistance, not legal advice or legal representation. Deadlines are calculated by deterministic rules from verified statutes. For decisions about your specific situation, consult a qualified lawyer or an authorised legal-aid service.",
    briefWarning: "This is a factual summary prepared for lawyer review. It is not legal advice.",
    generatedBy: "Generated by LexLens",
    questionsFor: "Questions for your lawyer",
  },
  hi: {
    reportTitle: "कानूनी नोटिस विश्लेषण रिपोर्ट",
    generatedOn: (d) => `जारी तिथि: ${d}`,
    preparedFor: "तैयार किया गया",
    noticeSummary: "नोटिस सारांश",
    actionCenter: "कार्य केंद्र",
    nextActions: "अनुशंसित अगले कदम",
    timeline: "कानूनी समय-रेखा",
    keyFacts: "प्रमुख तथ्य",
    missingInfo: "अनुपलब्ध जानकारी",
    evidence: "केस साक्ष्य",
    legalBasis: "कानूनी आधार",
    ifNothing: "अगर मैं कुछ न करूँ तो क्या होगा?",
    yourPosition: "आपकी स्थिति",
    responseDraft: "जवाबी पत्र मसौदा",
    lawyerBrief: "वकील ब्रीफ",
    disclaimer: "अस्वीकरण",
    sources: "स्रोत",
    page: (n, m) => `पृष्ठ ${n} / ${m}`,
    footer: "LexLens — कानूनी जानकारी, कानूनी सलाह नहीं",
    fact: "तथ्य",
    value: "मान",
    source: "स्रोत",
    confidence: "विश्वास",
    noticeType: "नोटिस प्रकार",
    jurisdiction: "क्षेत्राधिकार",
    noticeLanguage: "नोटिस भाषा",
    analysisDate: "विश्लेषण तिथि",
    severity: "गंभीरता",
    claimedAmount: "मांगी गई राशि",
    receiptDate: "प्राप्ति तिथि",
    exactDeadline: "सटीक समा-सीमा",
    daysRemaining: "शेष दिन",
    deadlineUnknown: "अभी गणना नहीं हो सकती",
    cannotCalculate: (r) => `${r} ज्ञात न होने के कारण सटीक समा-सीमा की गणना नहीं की जा सकती।`,
    statusLabel: "स्थिति",
    analysisCompleted: "पूर्ण",
    sourcesChecked: "सत्यापित",
    noDeadline: "इस नोटिस प्रकार पर कोई वैधानिक समा-सीमा लागू नहीं होती।",
    noneMissing: "कोई महत्वपूर्ण जानकारी अनुपलब्ध नहीं है।",
    available: "उपलब्ध",
    missingLabel: "अनुपलब्ध",
    eventLabel: "घटना",
    dateLabel: "तिथि",
    statusLabelShort: "स्थिति",
    notProvided: "प्रदान नहीं की गई",
    deadlineRule: "लागू नियम",
    lawStatute: "कानून / अधिनियम",
    explanation: "व्याख्या",
    noDraft: "इस नोटिस के लिए अभी कोई जवाबी पत्र मसौदा तैयार नहीं किया गया है।",
    noBrief: "इस नोटिस के लिए अभी कोई वकील ब्रीफ तैयार नहीं किया गया है।",
    positionLabels: {
      agree: "सहमत — निपटान का इरादा",
      partial_dispute: "राशि के हिस्से पर विवाद",
      full_dispute: "पूरे दावे से इनकार",
      already_paid: "भुगतान हो चुका है",
      dont_recognize: "इस दावे को नहीं पहचानते",
      unknown: "अभी समीक्षा जारी",
    },
    positionNone: "अभी बताई नहीं गई।",
    countdown: (d) => `${d} दिन शेष`,
    dueToday: "आज समा-सीमा",
    dueTomorrow: "कल समा-सीमा",
    overdueBy: (d) => `${d} दिन अतिरिक्त`,
    disclaimerFull:
      "LexLens कानूनी जानकारी और दस्तावेज़ सहायता प्रदान करता है, कानूनी सलाह या कानूनी प्रतिनिधित्व नहीं। समा-सीमाएँ सत्यापित कानूनों से नियम-आधारित गणना से निकलती हैं। अपनी स्थिति के बारे में निर्णय के लिए योग्य वकील या अधिकृत विधिक सहायता सेवा से परामर्श करें।",
    briefWarning: "यह वकील की समीक्षा के लिए तथ्यात्मक सारांश है — कानूनी सलाह नहीं।",
    generatedBy: "LexLens द्वारा निर्मित",
    questionsFor: "वकील से पूछने के प्रश्न",
  },
  zh: {
    reportTitle: "法律通知分析报告",
    generatedOn: (d) => `生成日期：${d}`,
    preparedFor: "报告对象",
    noticeSummary: "通知摘要",
    actionCenter: "行动中心",
    nextActions: "建议的后续步骤",
    timeline: "法律时间线",
    keyFacts: "关键事实",
    missingInfo: "缺失信息",
    evidence: "案件证据",
    legalBasis: "法律依据",
    ifNothing: "如果我不采取行动会怎样？",
    yourPosition: "您的立场",
    responseDraft: "回复函草稿",
    lawyerBrief: "律师简报",
    disclaimer: "免责声明",
    sources: "引用来源",
    page: (n, m) => `第 ${n} 页 / 共 ${m} 页`,
    footer: "LexLens — 法律信息，非法律意见",
    fact: "事实",
    value: "内容",
    source: "来源",
    confidence: "置信度",
    noticeType: "通知类型",
    jurisdiction: "管辖区",
    noticeLanguage: "通知语言",
    analysisDate: "分析日期",
    severity: "严重程度",
    claimedAmount: "索赔金额",
    receiptDate: "签收日期",
    exactDeadline: "确切截止日",
    daysRemaining: "剩余天数",
    deadlineUnknown: "尚无法计算",
    cannotCalculate: (r) => `由于尚不知道${r}，无法计算确切截止日。`,
    statusLabel: "状态",
    analysisCompleted: "已完成",
    sourcesChecked: "已核实",
    noDeadline: "此类通知不适用法定截止日。",
    noneMissing: "没有缺失的关键信息。",
    available: "已有",
    missingLabel: "缺失",
    eventLabel: "事件",
    dateLabel: "日期",
    statusLabelShort: "状态",
    notProvided: "未提供",
    deadlineRule: "适用规则",
    lawStatute: "法律 / 法规",
    explanation: "说明",
    noDraft: "此通知尚未生成回复函草稿。",
    noBrief: "此通知尚未准备律师简报。",
    positionLabels: {
      agree: "认可——打算和解",
      partial_dispute: "对部分金额有争议",
      full_dispute: "对全部索赔有争议",
      already_paid: "已经付款",
      dont_recognize: "不认可此索赔",
      unknown: "仍在了解中",
    },
    positionNone: "尚未说明。",
    countdown: (d) => `剩余 ${d} 天`,
    dueToday: "今天到期",
    dueTomorrow: "明天到期",
    overdueBy: (d) => `已逾期 ${d} 天`,
    disclaimerFull:
      "LexLens 提供法律信息与文书协助，不提供法律意见或法律代理。截止日期由基于已核实法规的确定性规则计算。涉及您的具体情况的决定，请咨询合资格律师或授权的法律援助机构。",
    briefWarning: "这是供律师审阅的事实摘要，不构成法律意见。",
    generatedBy: "由 LexLens 生成",
    questionsFor: "请律师解答的问题",
  },
  fr: {
    reportTitle: "Rapport d'analyse d'avis légal",
    generatedOn: (d) => `Généré le ${d}`,
    preparedFor: "Préparé pour",
    noticeSummary: "Résumé de l'avis",
    actionCenter: "Centre d'action",
    nextActions: "Prochaines étapes recommandées",
    timeline: "Chronologie légale",
    keyFacts: "Faits clés",
    missingInfo: "Informations manquantes",
    evidence: "Preuves du dossier",
    legalBasis: "Base légale",
    ifNothing: "Que se passe-t-il si je ne fais rien ?",
    yourPosition: "Votre position",
    responseDraft: "Projet de réponse",
    lawyerBrief: "Synthèse pour avocat",
    disclaimer: "Avertissement",
    sources: "Sources",
    page: (n, m) => `Page ${n} sur ${m}`,
    footer: "LexLens — information juridique, pas un avis juridique",
    fact: "Fait",
    value: "Valeur",
    source: "Source",
    confidence: "Confiance",
    noticeType: "Type d'avis",
    jurisdiction: "Juridiction",
    noticeLanguage: "Langue de l'avis",
    analysisDate: "Date d'analyse",
    severity: "Gravité",
    claimedAmount: "Montant réclamé",
    receiptDate: "Date de réception",
    exactDeadline: "Échéance exacte",
    daysRemaining: "Jours restants",
    deadlineUnknown: "Calcul impossible pour l'instant",
    cannotCalculate: (r) => `L'échéance exacte ne peut être calculée car ${r} est inconnu.`,
    statusLabel: "Statut",
    analysisCompleted: "Terminée",
    sourcesChecked: "Vérifiées",
    noDeadline: "Aucune échéance légale ne s'applique à ce type d'avis.",
    noneMissing: "Aucune information critique ne manque.",
    available: "Disponible",
    missingLabel: "Manquant",
    eventLabel: "Événement",
    dateLabel: "Date",
    statusLabelShort: "Statut",
    notProvided: "Non fournie",
    deadlineRule: "Règle appliquée",
    lawStatute: "Loi / texte",
    explanation: "Explication",
    noDraft: "Aucun projet de réponse n'a encore été généré pour cet avis.",
    noBrief: "Aucune synthèse pour avocat n'a encore été préparée pour cet avis.",
    positionLabels: {
      agree: "D'accord — intention de régler",
      partial_dispute: "Contestation partielle du montant",
      full_dispute: "Contestation totale de la créance",
      already_paid: "Déjà payé",
      dont_recognize: "Ne reconnaît pas cette créance",
      unknown: "Encore en examen",
    },
    positionNone: "Pas encore indiquée.",
    countdown: (d) => `${d} jours restants`,
    dueToday: "Échéance aujourd'hui",
    dueTomorrow: "Échéance demain",
    overdueBy: (d) => `En retard de ${d} jour${d === 1 ? "" : "s"}`,
    disclaimerFull:
      "LexLens fournit une information juridique et une assistance documentaire, pas des conseils juridiques ni une représentation légale. Les échéances sont calculées par des règles déterministes issues de textes vérifiés. Pour toute décision concernant votre situation, consultez un avocat qualifié ou un service d'aide juridique agréé.",
    briefWarning: "Résumé factuel préparé pour examen par un avocat — ne constitue pas un avis juridique.",
    generatedBy: "Généré par LexLens",
    questionsFor: "Questions pour votre avocat",
  },
};

const SEVERITY_PDF: Record<string, { label: Record<Locale, string>; color: string }> = {
  red: { label: { en: "Critical", hi: "अत्यंत गंभीर", zh: "危急", fr: "Critique" }, color: "#DC2626" },
  yellow: { label: { en: "Action needed", hi: "कार्रवाई आवश्यक", zh: "需要行动", fr: "Action requise" }, color: "#D97706" },
  green: { label: { en: "Informational", hi: "सूचनात्मक", zh: "一般告知", fr: "Information" }, color: "#059669" },
};

const NOTICE_TYPE_PDF: Record<string, Record<Locale, string>> = {
  debt_collection: { en: "Debt collection", hi: "कर्ज वसूली", zh: "债务催收", fr: "Recouvrement de dette" },
  cheque_bounce: { en: "Cheque bounce (NI Act)", hi: "चेक अनादरण (धारा 138)", zh: "支票退票（NI 法）", fr: "Chèque rejeté (NI Act)" },
  eviction: { en: "Eviction / tenancy", hi: "बेदखली / किराया", zh: "驱逐 / 租赁", fr: "Expulsion / bail" },
  consumer: { en: "Consumer dispute", hi: "उपभोक्ता विवाद", zh: "消费争议", fr: "Litige de consommation" },
  tax: { en: "Tax notice", hi: "कर नोटिस", zh: "税务通知", fr: "Avis fiscal" },
  employment: { en: "Employment", hi: "रोजगार", zh: "劳动雇佣", fr: "Emploi" },
  court_summons: { en: "Court summons", hi: "न्यायालय सम्मन", zh: "法院传票", fr: "Citation à comparaître" },
  other: { en: "Other notice", hi: "अन्य नोटिस", zh: "其他通知", fr: "Autre avis" },
};

const LANGUAGE_PDF: Record<string, Record<Locale, string>> = {
  en: { en: "English", hi: "अंग्रेज़ी", zh: "英语", fr: "Anglais" },
  hi: { en: "Hindi", hi: "हिन्दी", zh: "印地语", fr: "Hindi" },
  zh: { en: "Chinese", hi: "चीनी", zh: "中文", fr: "Chinois" },
  fr: { en: "French", hi: "फ़्रेंच", zh: "法语", fr: "Français" },
};

function glyphCoverage(fontPath: string): { rupee: boolean } | null {
  try {
    const f = fontkit.openSync(fontPath) as { hasGlyphForCodePoint: (cp: number) => boolean };
    return { rupee: f.hasGlyphForCodePoint(0x20b9) };
  } catch {
    return null;
  }
}

interface ReportInput {
  locale: Locale;
  noticeTitle: string;
  noticeType: string;
  jurisdiction: string;
  noticeLanguage: string;
  severity: string;
  claimedAmount: string | null;
  currency: string | null;
  noticeDate: string | null;
  receiptDate: string | null;
  deadlineDate: string | null;
  daysRemaining: number | null;
  deadlineStatus: string;
  ruleLabel: string | null;
  base: CaseBase;
  userState: UserCaseState;
  draftText: string | null;
  briefJson: string | null;
}

export async function generateNoticePdf(input: ReportInput): Promise<Buffer> {
  const locale = input.locale;
  const S = PDF_STRINGS[locale];
  const today = todayISO();

  const fontPath = locale === "hi" ? DEVANAGARI_FONT : locale === "zh" ? SC_FONT : null;
  const coverage = fontPath ? glyphCoverage(fontPath) : null;
  const canRupee = locale === "hi" ? coverage?.rupee ?? false : false;

  const pdfMoney = (amount: number | null, currency: string | null): string | null => {
    if (amount === null) return null;
    if (currency === "INR" && !canRupee) {
      try {
        return `INR ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(amount)}`;
      } catch {
        return `INR ${amount}`;
      }
    }
    return caseMoney(amount, currency, locale);
  };

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 96, bottom: 72, left: 52, right: 52 },
    bufferPages: true,
    info: { Title: `${S.reportTitle} — ${input.noticeTitle}`, Author: "LexLens", Creator: "LexLens", Producer: "LexLens" },
  });

  const fontRegular = locale === "en" || locale === "fr" ? "Helvetica" : "Custom";
  const fontBold = locale === "en" || locale === "fr" ? "Helvetica-Bold" : "Custom";
  if (fontPath) doc.registerFont("Custom", fontPath);

  const W = doc.page.width;
  const left = doc.page.margins.left;
  const right = W - doc.page.margins.right;
  const contentW = right - left;
  const bottomLimit = doc.page.height - doc.page.margins.bottom;

  const ensure = (h: number) => {
    if (doc.y + h > bottomLimit) doc.addPage();
  };

  const para = (text: string, opts: { size?: number; color?: string; bold?: boolean; gap?: number; indent?: number } = {}) => {
    const size = opts.size ?? 10.5;
    doc.font(opts.bold ? fontBold : fontRegular).fontSize(size).fillColor(opts.color ?? INK);
    const h = doc.heightOfString(text, { width: contentW - (opts.indent ?? 0), lineGap: 2 });
    ensure(h + 6);
    doc.text(text, left + (opts.indent ?? 0), doc.y, { width: contentW - (opts.indent ?? 0), lineGap: 2 });
    doc.y += opts.gap ?? 6;
  };

  const section = (num: number, title: string) => {
    ensure(58);
    doc.y += 10;
    doc.font(fontBold).fontSize(13).fillColor(INDIGO);
    doc.text(`${num}.  ${title.toUpperCase()}`, left, doc.y, { characterSpacing: 0.5, width: contentW });
    doc.moveTo(left, doc.y + 5).lineTo(right, doc.y + 5).lineWidth(1).strokeColor(LINE).stroke();
    doc.y += 14;
  };

  const kvTable = (rows: { label: string; value: string; color?: string }[]) => {
    for (const r of rows) {
      const labelW = 165;
      const valueW = contentW - labelW - 20;
      doc.font(fontBold).fontSize(9.5);
      const lh = doc.heightOfString(r.label, { width: labelW });
      doc.font(fontRegular).fontSize(10);
      const vh = doc.heightOfString(r.value || "—", { width: valueW });
      const rowH = Math.max(lh, vh) + 12;
      ensure(rowH + 2);
      const y = doc.y;
      doc.rect(left, y, contentW, rowH).fill(r.color ?? (rows.indexOf(r) % 2 === 0 ? FILL : "#FFFFFF"));
      doc.fillColor(FAINT).font(fontBold).fontSize(9.5).text(r.label, left + 10, y + 6, { width: labelW });
      doc.fillColor(r.color ? r.color : INK).font(fontRegular).fontSize(10).text(r.value || "—", left + labelW + 14, y + 6, { width: valueW });
      doc.y = y + rowH;
    }
    doc.y += 6;
  };

  const numberedList = (items: string[]) => {
    items.forEach((item, i) => {
      const text = `${i + 1}.  ${item}`;
      doc.font(fontRegular).fontSize(10.5).fillColor(INK);
      const h = doc.heightOfString(text, { width: contentW - 14, lineGap: 2 });
      ensure(h + 8);
      doc.text(text, left + 14, doc.y, { width: contentW - 14, lineGap: 2 });
      doc.y += 7;
    });
    doc.y += 4;
  };

  const bulletList = (items: { text: string; color?: string }[]) => {
    for (const it of items) {
      doc.font(fontRegular).fontSize(10.5).fillColor(it.color ?? INK);
      const text = `•  ${it.text}`;
      const h = doc.heightOfString(text, { width: contentW - 14, lineGap: 2 });
      ensure(h + 6);
      doc.text(text, left + 14, doc.y, { width: contentW - 14, lineGap: 2 });
      doc.y += 5;
    }
    doc.y += 4;
  };

  /* ─────────────── masthead ─────────────── */
  doc.rect(left, 40, contentW, 3).fill(INDIGO);
  doc.font(fontBold).fontSize(17).fillColor(INDIGO).text("LEXLENS", left, 52, { characterSpacing: 2 });
  doc.font(fontRegular).fontSize(9).fillColor(MUTED).text(S.footer, left, 74, { width: contentW });

  doc.font(fontBold).fontSize(19).fillColor(INK).text(S.reportTitle, left, 102, { width: contentW });
  doc.font(fontRegular).fontSize(9.5).fillColor(MUTED).text(S.generatedOn(fmtISO(today, locale)), left, doc.y + 2, { width: contentW });
  doc.font(fontRegular).fontSize(9.5).fillColor(MUTED).text(`${S.preparedFor}: ${input.noticeTitle}`, left, doc.y + 1, { width: contentW });
  doc.y += 8;

  const view = buildCaseView(input.base, input.userState, locale, today);

  /* ─────────────── 1 · notice summary ─────────────── */
  section(1, S.noticeSummary);
  const block = input.base.localized[locale] ?? input.base.localized.en;
  kvTable([
    { label: S.noticeType, value: NOTICE_TYPE_PDF[input.noticeType]?.[locale] ?? input.noticeType },
    { label: S.jurisdiction, value: input.jurisdiction || "—" },
    { label: S.noticeLanguage, value: LANGUAGE_PDF[input.noticeLanguage]?.[locale] ?? input.base.language_detected ?? "—" },
    { label: S.analysisDate, value: fmtISO(today, locale) },
  ]);
  para(block.summary, { size: 10.5, color: INK });

  /* ─────────────── 2 · action center ─────────────── */
  section(2, S.actionCenter);
  const sevMeta = SEVERITY_PDF[input.severity] ?? SEVERITY_PDF.yellow;
  const dlRows: { label: string; value: string; color?: string }[] = [
    { label: S.severity, value: sevMeta.label[locale] ?? input.severity, color: sevMeta.color },
    { label: S.claimedAmount, value: input.claimedAmount ?? "—" },
    { label: S.receiptDate, value: input.receiptDate ? fmtISO(input.receiptDate, locale) : `⚠ ${S.notProvided}` },
  ];
  if (input.deadlineDate) {
    dlRows.push({ label: S.exactDeadline, value: `${fmtISO(input.deadlineDate, locale)}`, color: INDIGO });
    let countdown: string;
    if (input.daysRemaining === null) countdown = S.deadlineUnknown;
    else if (input.daysRemaining < 0) countdown = S.overdueBy(Math.abs(input.daysRemaining));
    else if (input.daysRemaining === 0) countdown = S.dueToday;
    else if (input.daysRemaining === 1) countdown = S.dueTomorrow;
    else countdown = S.countdown(input.daysRemaining);
    dlRows.push({ label: S.daysRemaining, value: countdown, color: input.daysRemaining !== null && input.daysRemaining <= 3 ? "#DC2626" : INK });
  } else {
    dlRows.push({ label: S.exactDeadline, value: S.deadlineUnknown, color: "#B45309" });
  }
  dlRows.push({ label: S.deadlineRule, value: input.ruleLabel ?? "—" });
  kvTable(dlRows);

  /* ─────────────── 3 · next actions ─────────────── */
  section(3, S.nextActions);
  numberedList(view.actions.map((a) => a.title));

  /* ─────────────── 4 · legal timeline ─────────────── */
  section(4, S.timeline);
  kvTable(
    view.timeline.map((t) => ({
      label: t.label,
      value: `${t.date ? fmtISO(t.date, locale) : "—"} · ${t.status === "confirmed" ? S.sourcesChecked : t.status === "estimated" ? S.analysisCompleted : S.notProvided}`,
    })),
  );

  /* ─────────────── 5 · key facts ─────────────── */
  section(5, S.keyFacts);
  kvTable(
    view.facts.map((f) => ({
      label: f.label,
      value: `${f.kind === "date" && f.value ? fmtISO(f.value, locale) : f.value || "—"}${f.confidence !== null ? `  (${S.confidence}: ${Math.round(f.confidence * 100)}%)` : ""}`,
    })),
  );

  /* ─────────────── 6 · missing information ─────────────── */
  section(6, S.missingInfo);
  if (!view.missing.length) para(S.noneMissing, { color: "#059669" });
  else
    bulletList(
      view.missing.map((m) => ({ text: `${m.label} — ${m.why}`, color: "#B45309" })),
    );

  /* ─────────────── 7 · case evidence ─────────────── */
  section(7, S.evidence);
  bulletList([
    ...view.evidence.filter((e) => e.have).map((e) => ({ text: `${S.available}: ${e.label}`, color: "#059669" })),
    ...view.evidence.filter((e) => !e.have).map((e) => ({ text: `${S.missingLabel}: ${e.label}`, color: "#B45309" })),
  ]);

  /* ─────────────── 8 · legal basis ─────────────── */
  section(8, S.legalBasis);
  if (!input.base.citations.length) para("—", { color: MUTED });
  else {
    for (const c of input.base.citations) {
      const entry = CORPUS.find((x) => x.source_id === c.source_id);
      ensure(30);
      para(entry?.title ?? c.source_id, { bold: true, size: 10.5, gap: 2 });
      para(c.relevance, { size: 10, color: MUTED, gap: 4 });
    }
  }

  /* ─────────────── 9 · if nothing happens ─────────────── */
  section(9, S.ifNothing);
  numberedList(view.consequences.map((c) => c.text));

  /* ─────────────── 10 · your position ─────────────── */
  section(10, S.yourPosition);
  para(
    input.userState.position
      ? S.positionLabels[input.userState.position] ?? input.userState.position
      : S.positionNone,
    { size: 10.5 },
  );

  /* ─────────────── 11 · response draft ─────────────── */
  section(11, S.responseDraft);
  if (input.draftText) {
    for (const chunk of input.draftText.split("\n")) {
      if (chunk.trim()) para(chunk.trim(), { size: 9.5, color: INK, gap: 3 });
    }
  } else {
    para(S.noDraft, { color: MUTED });
  }

  /* ─────────────── 12 · lawyer brief ─────────────── */
  section(12, S.lawyerBrief);
  if (input.briefJson) {
    try {
      const b = JSON.parse(input.briefJson) as {
        matter: string; jurisdiction: string; claimant: string; amount: string | null; deadline: string;
        verified_facts: string[]; unverified_facts: string[]; questions: string[];
      };
      kvTable([
        { label: S.noticeType, value: b.matter ?? "—" },
        { label: S.jurisdiction, value: b.jurisdiction ?? "—" },
        { label: S.exactDeadline, value: b.deadline ?? "—" },
      ]);
      if (b.verified_facts?.length) {
        para(S.keyFacts, { bold: true, size: 10, gap: 3 });
        bulletList(b.verified_facts.map((f) => ({ text: f })));
      }
      if (b.unverified_facts?.length) {
        bulletList(b.unverified_facts.map((f) => ({ text: f, color: "#B45309" })));
      }
      if (b.questions?.length) {
        para(S.questionsFor, { bold: true, size: 10, gap: 3 });
        numberedList(b.questions);
      }
      para(S.briefWarning, { size: 9, color: MUTED });
    } catch {
      para(S.noBrief, { color: MUTED });
    }
  } else {
    para(S.noBrief, { color: MUTED });
  }

  /* ─────────────── 13 · disclaimer ─────────────── */
  section(13, S.disclaimer);
  para(S.disclaimerFull, { size: 9.5, color: MUTED });

  /* ─────────────── 14 · sources ─────────────── */
  section(14, S.sources);
  const cited = new Map(input.base.citations.map((c) => [c.source_id, c.relevance]));
  let i = 1;
  for (const [sid, rel] of cited) {
    const entry = CORPUS.find((x) => x.source_id === sid);
    para(`${i}. ${entry?.title ?? sid}`, { bold: true, size: 9.5, gap: 2 });
    if (rel) para(rel, { size: 9, color: MUTED, gap: 4, indent: 12 });
    i++;
  }
  if (i === 1) para("—", { color: MUTED });

  /* ─────────────── running header + footer on every page ─────────────── */
  const range = doc.bufferedPageRange();
  for (let p = range.start; p < range.start + range.count; p++) {
    doc.switchToPage(p);
    // Header band
    if (p > range.start) {
      doc.font(fontBold).fontSize(8.5).fillColor(INDIGO).text("LEXLENS", left, 34, { characterSpacing: 2 });
      doc.font(fontRegular).fontSize(8.5).fillColor(FAINT).text(S.reportTitle, left + 70, 34, { width: contentW - 70, align: "right" });
      doc.moveTo(left, 48).lineTo(right, 48).lineWidth(0.75).strokeColor(LINE).stroke();
    }
    // Footer
    doc.moveTo(left, doc.page.height - 54).lineTo(right, doc.page.height - 54).lineWidth(0.75).strokeColor(LINE).stroke();
    doc.font(fontRegular).fontSize(8).fillColor(FAINT).text(S.generatedBy, left, doc.page.height - 46, { width: contentW / 2, lineBreak: false });
    doc.text(S.page(String(p - range.start + 1), String(range.count)), left + contentW / 2, doc.page.height - 46, { width: contentW / 2, align: "right", lineBreak: false });
  }
  doc.flushPages();

  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.end();
  });
}
