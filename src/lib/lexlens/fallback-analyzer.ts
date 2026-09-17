// LexLens — Offline Demo Engine (fallback analyzer).
// Rule-based analyzer used when the LLM backend is unreachable (e.g. running
// locally in VS Code without SDK credentials, or a transient network failure).
// It pattern-matches the supported notice families, extracts entities with
// regex, and produces the exact same Analysis schema so the UI never breaks.
// Output is transcreated in 4 languages: EN / HI / ZH / FR.

import type {
  Analysis,
  Deadline,
  Demand,
  Locale,
  LocalizedBlock,
  LocalizedRight,
  NoticeType,
  SeverityLevel,
} from "./types";

function iso(offsetDays: number): string {
  const t = new Date();
  t.setDate(t.getDate() + offsetDays);
  return t.toISOString().slice(0, 10);
}

function money(n: number, currency: string | null): string {
  try {
    if (currency === "INR") return `₹${new Intl.NumberFormat("en-IN").format(n)}`;
    if (currency === "USD") return `$${new Intl.NumberFormat("en-US").format(n)}`;
    if (currency === "EUR") return `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(n)} €`;
    return `${currency ?? ""} ${n}`.trim();
  } catch {
    return `${currency ?? ""} ${n}`.trim();
  }
}

function detectLanguage(t: string): string {
  const devanagari = (t.match(/[\u0900-\u097F]/g) ?? []).length;
  if (devanagari > t.length * 0.05) return "hi";
  const cjk = (t.match(/[\u4E00-\u9FFF]/g) ?? []).length;
  if (cjk > t.length * 0.05) return "zh";
  if (
    /\b(vous|dans|pour|une|le|la|aux|avec|contester)\b/i.test(t) &&
    /mise en demeure|expulsion|créance|loyers impayés|commandement|bailleur|huissier/i.test(t)
  )
    return "fr";
  if (/\b(el|la|los|las|que|de|y)\b/i.test(t) && /ción|arrendatari|desahuci|pago/i.test(t)) return "es";
  return "en";
}

const num = (s: string) => Number(s.replace(/[, ]/g, ""));

function findAmount(t: string): { amount: number; currency: string } | null {
  // Indian formats: Rs. 4,50,000 / ₹4,50,000 / Rs 450000
  const inr = t.match(/(?:rs\.?|₹|inr)\s*([0-9][0-9,]*(?:\.[0-9]+)?)/i);
  if (inr) return { amount: num(inr[1].replace(/,/g, "")), currency: "INR" };
  // US: $2,340.55
  const usd = t.match(/\$\s*([0-9][0-9,]*(?:\.[0-9]{2})?)/);
  if (usd) return { amount: num(usd[1].replace(/,/g, "")), currency: "USD" };
  // EU: 2.750,00 € or 2 750,00 €
  const eur = t.match(/([0-9][0-9 .,]*,[0-9]{2})\s*€/);
  if (eur) return { amount: num(eur[1].replace(/\./g, "").replace(",", ".")), currency: "EUR" };
  return null;
}

type R4 = Record<Locale, LocalizedRight>;

/** Build per-language rights arrays from a compact tuple list. */
function rights4(items: { en: [string, string]; hi: [string, string]; zh: [string, string]; fr: [string, string]; sid: string | null }[]): Record<Locale, LocalizedRight[]> {
  const pick = (loc: Locale): LocalizedRight[] =>
    items.map((it) => ({ title: it[loc][0], detail: it[loc][1], source_id: it.sid }));
  return { en: pick("en"), hi: pick("hi"), zh: pick("zh"), fr: pick("fr") };
}

interface Kit {
  notice_type: NoticeType;
  severity: SeverityLevel;
  sender: { name: string; type: string };
  demands: Demand[];
  deadlines: Deadline[];
  citations: Analysis["citations"];
  rights: Record<Locale, LocalizedRight[]>;
  next_steps: Record<Locale, string[]>;
  summary: Record<Locale, string>;
  key_risk: Record<Locale, string>;
  confidence: number;
}

/* ─────────────────────────── India · §138 cheque bounce ─────────────────── */

function kitChequeBounce(t: string): Kit {
  const amt = findAmount(t) ?? { amount: 0, currency: "INR" };
  const amtStr = amt.amount ? money(amt.amount, amt.currency) : "the cheque amount";
  const client = (t.match(/(?:on behalf of|behalf of)\s+(?:my\s+)?client[,]?\s*([A-Z][A-Za-z0-9 .&()/,-]{3,60}?),/)?.[1] ?? "the complainant").trim();
  const advocate = (t.match(/([A-Z][A-Za-z.&' ]+(?:Associates|Advocates|& Co\.?|Law Chambers))/)?.[1] ?? "the complainant's advocate").trim();
  return {
    notice_type: "cheque_bounce",
    severity: "red",
    sender: { name: advocate, type: "law_firm" },
    demands: [
      {
        demand: `Pay ${amtStr} (dishonoured cheque) plus interest at ~18% per annum`,
        amount: amt.amount || null,
        currency: amt.currency,
      },
    ],
    deadlines: [
      {
        action: `Pay the full cheque amount (${amtStr}) within 15 days of receiving this notice`,
        date: iso(15),
        days_from_today: 15,
        consequence_if_missed:
          "A criminal complaint under Section 138 NI Act can be filed; punishment can be up to 2 years' imprisonment, a fine up to twice the cheque amount, or both.",
        legal_basis_source_id: "in_ni_138",
      },
    ],
    citations: [{ source_id: "in_ni_138", relevance: "Dishonour of cheque for insufficiency of funds triggers the 15-day payment window before criminal prosecution." }],
    rights: rights4([
      {
        en: ["Right to pay within 15 days", "The notice itself gives you a 15-day window — paying the cheque amount within it completely bars the criminal complaint."],
        hi: ["15 दिनों के भीतर भुगतान का अधिकार", "नोटिस मिलने के 15 दिनों के भीतर चेक राशि चुकाने पर आपराधिक शिकायत नहीं हो सकती।"],
        zh: ["15天付款期内了结的权利", "通知本身就给了您15天的窗口期——在此期限内付清支票金额即可完全阻止刑事控告。"],
        fr: ["Droit de payer dans les 15 jours", "L'avis vous accorde lui-même un délai de 15 jours : payer le montant du chèque dans ce délai fait totalement obstacle à la plainte pénale."],
        sid: "in_ni_138",
      },
      {
        en: ["Right to contest liability", "You may respond in writing denying liability (e.g., cheque not issued toward this debt, payment already made, or signature disputed) — the complainant must then prove the case."],
        hi: ["देयता चुनौती देने का अधिकार", "आप लिखित रूप में देयता से इनकार कर सकते हैं — तब शिकायतकर्ता को अदालत में अपना मामला साबित करना होगा।"],
        zh: ["对付款责任提出异议的权利", "您可以书面回复并否认付款责任（例如：支票并非用于该笔债务、款项已经支付、或签名存在争议）——此后投诉方须在法庭上证明其主张。"],
        fr: ["Droit de contester la dette", "Vous pouvez répondre par écrit en contestant votre obligation de paiement (chèque non émis pour cette dette, paiement déjà effectué ou signature contestée) — le plaignant devra alors prouver son affaire devant le tribunal."],
        sid: null,
      },
    ]),
    next_steps: {
      en: [
        `Arrange payment of ${amtStr} before the 15-day window closes — a bank transfer with written acknowledgement works best.`,
        "Keep the cheque, bank return memo and this notice together as your document set.",
        "Reply to the notice in writing (keep proof of delivery), stating your position.",
        "Consult a qualified lawyer immediately — this is criminal exposure, not just a civil demand.",
      ],
      hi: [
        `15 दिनों की समा समाप्त होने से पहले ${amtStr} का भुगतान कर दें — बैंक ट्रांसफर और लिखित पावती रखें।`,
        "चेक, बैंक रिटर्न मेमो और यह नोटिस — तीनों एक साथ सुरक्षित रखें।",
        "नोटिस का लिखित जवाब दें (डिलीवरी का प्रमाण रखें) और अपनी स्थिति स्पष्ट करें।",
        "तुरंत एक योग्य वकील से संपर्क करें — यह आपराधिक मामला हो सकता है, मात्र नागरिक मांग नहीं।",
      ],
      zh: [
        `请在15天期限届满前安排支付${amtStr}——银行转账并保留书面回执最有保障。`,
        "将支票、银行退票回单和本通知放在一起妥善保存。",
        "以书面形式回复通知（保留送达证明），清楚说明您的立场。",
        "请立即咨询合资格律师——这涉及刑事责任，而不仅仅是民事付款要求。",
      ],
      fr: [
        `Organisez le paiement de ${amtStr} avant la fin du délai de 15 jours — un virement bancaire avec accusé de réception écrit est préférable.`,
        "Conservez ensemble le chèque, l'attestation de rejet bancaire et cet avis.",
        "Répondez à l'avis par écrit (conservez une preuve de remise) en exposant votre position.",
        "Consultez immédiatement un avocat qualifié — il s'agit d'une exposition pénale, pas d'une simple demande civile.",
      ],
    },
    summary: {
      en: `This is a criminal legal notice under Section 138 of the Negotiable Instruments Act, sent by ${advocate} on behalf of ${client}. A cheque of ${amtStr} was dishonoured for insufficient funds, and you are being asked to pay the full amount plus interest within 15 days of receiving this notice. If you do not pay within those 15 days, a criminal case can be filed before the Magistrate court.`,
      hi: `यह परक्राम्य लिखत अधिनियम की धारा 138 के तहत आपराधिक कानूनी नोटिस है, जो ${advocate} द्वारा ${client} की ओर से भेजा गया है। ${amtStr} का चेक फंड की कमी के कारण अनादरित हुआ है और आपसे नोटिस मिलने के 15 दिनों के भीतर ब्याज सहित पूरी राशि मांगी जा रही है। 15 दिनों में भुगतान न करने पर मजिस्ट्रेट अदालत में आपराधिक केस दर्ज हो सकता है।`,
      zh: `这是一份根据印度《票据法》第138条发出的刑事法律通知，由律师 ${advocate} 代表 ${client} 发送。您开出的一张金额为 ${amtStr} 的支票因"存款不足"被银行退票，通知要求您在收到本通知后15天内支付全部款项及利息。如果15天内未付款，对方可以向治安法院提起刑事诉讼。`,
      fr: `Il s'agit d'une mise en demeure à caractère pénal fondée sur l'article 138 de la loi indienne sur les instruments négociables (Negotiable Instruments Act), envoyée par ${advocate} pour le compte de ${client}. Un chèque de ${amtStr} a été retourné impayé pour insuffisance de provision, et il vous est demandé de régler le montant intégral majoré des intérêts dans les 15 jours suivant la réception de cet avis. À défaut de paiement dans ce délai, une plainte pénale peut être déposée devant le tribunal de magistrate.`,
    },
    key_risk: {
      en: `Criminal prosecution under Section 138: up to 2 years' imprisonment or a fine up to twice the cheque amount if the 15-day window lapses unpaid.`,
      hi: `धारा 138 के तहत आपराधिक अभियोजन: 15 दिनों में भुगतान न होने पर 2 साल तक की जेल या चेक राशि का दोगुना जुर्माना हो सकता है।`,
      zh: `第138条项下的刑事追诉风险：若15天付款期届满仍未支付，可能面临最高2年监禁，或最高达支票金额两倍的罚金，或两者并罚。`,
      fr: `Poursuite pénale au titre de l'article 138 : jusqu'à 2 ans d'emprisonnement ou une amende pouvant atteindre le double du montant du chèque si le délai de 15 jours expire sans paiement.`,
    },
    confidence: 0.8,
  };
}

/* ─────────────────────────── US · FDCPA debt collection ─────────────────── */

function kitDebtCollection(t: string): Kit {
  const amt = findAmount(t) ?? { amount: 0, currency: "USD" };
  const amtStr = amt.amount ? money(amt.amount, amt.currency) : "the claimed balance";
  const collector = (t.match(/^([A-Z][A-Za-z&.,' ]{4,60}(?:LLC|LLP|Inc\.?|Agency|Systems|Associates))/m)?.[1] ?? "The collection agency").trim();
  const isNY = /new york|kings county|brooklyn|queens|manhattan|bronx/i.test(t);
  const deadlines: Deadline[] = [
    {
      action: "Dispute the debt in writing within 30 days of receiving this letter",
      date: iso(30),
      days_from_today: 30,
      consequence_if_missed: "The collector will assume the debt is valid and may proceed without further validation.",
      legal_basis_source_id: "fdcpa_1692g",
    },
    {
      action: "Resolve the debt before the threatened referral date (~45 days)",
      date: iso(45),
      days_from_today: 45,
      consequence_if_missed: "The matter may be referred to court; a money judgment can be entered and enforced through wage garnishment or bank levy.",
      legal_basis_source_id: isNY ? "ny_cplr_320" : null,
    },
  ];
  const citations: Analysis["citations"] = [{ source_id: "fdcpa_1692g", relevance: "Gives you the 30-day written dispute and validation right referenced in the letter." }];
  if (isNY) citations.push({ source_id: "ny_cplr_320", relevance: "Explains the default-judgment risk the letter threatens in New York courts." });
  const rights = rights4([
    {
      en: ["30-day validation right", "Disputing in writing within 30 days forces the collector to stop collection until it mails verification of the debt."],
      hi: ["30-दिन का सत्यापन अधिकार", "30 दिनों के भीतर लिखित विवाद करने पर कलेक्टर को सत्यापन भेजने तक वसूली रोकनी होगी।"],
      zh: ["30天债务核实权", "在30天内以书面形式提出争议，可迫使催收机构在寄出债务核实材料之前暂停催收。"],
      fr: ["Droit de validation de 30 jours", "Contester par écrit dans les 30 jours oblige le recouvreur à suspendre ses démarches jusqu'à l'envoi de la vérification de la dette."],
      sid: "fdcpa_1692g",
    },
    {
      en: ["Protection from false threats", "Collectors may not threaten court action they do not intend or are not permitted to take."],
      hi: ["झूठी धमकियों से सुरक्षा", "कलेक्टर ऐसी अदालती कार्रवाई की धमकी नहीं दे सकता जिसका इरादा या अधिकार नहीं है।"],
      zh: ["免受虚假威胁的保护", "催收机构不得威胁采取其无意进行或无权进行的法律行动。"],
      fr: ["Protection contre les menaces fallacieuses", "Un recouvreur ne peut menacer d'une action en justice qu'il n'a pas l'intention ou le droit d'engager."],
      sid: "fdcpa_1692e",
    },
  ]);
  return {
    notice_type: "debt_collection",
    severity: "yellow",
    sender: { name: collector, type: "debt_collector" },
    demands: [
      { demand: `Pay the claimed credit-card balance of ${amtStr}`, amount: amt.amount || null, currency: amt.currency },
      { demand: `Or accept a settlement offer (~70% of balance)`, amount: amt.amount ? Math.round(amt.amount * 0.7 * 100) / 100 : null, currency: amt.currency },
    ],
    deadlines,
    citations,
    rights,
    next_steps: {
      en: [
        "Check your records for this account — verify the amount and that the debt is really yours.",
        "If anything is wrong, send a written dispute within 30 days (keep proof of mailing).",
        "Request debt validation and the original creditor's details in the same letter.",
        "Consult a qualified lawyer before the threatened court referral if you cannot resolve it.",
      ],
      hi: [
        "अपने रिकॉर्ड में इस खाते की जाँच करें — राशि और देयता सत्यापित करें।",
        "कुछ भी गलत होने पर 30 दिनों के भीतर लिखित विवाद (dispute) भेजें — डाक प्रमाण रखें।",
        "उसी पत्र में डेट सत्यापन और मूल लेनदार का विवरण मांगें।",
        "मामला हल न होने पर अदालत रेफरल से पहले तुरंत एक योग्य वकील से संपर्क करें।",
      ],
      zh: [
        "核对您自己的账户记录——确认金额无误，且该债务确实属于您。",
        "如发现任何问题，请在30天内发出书面争议函（保留邮寄凭证）。",
        "在同一封信中要求对方提供债务核实材料及原始债权人的信息。",
        "若无法在法院移交前解决，请咨询合资格律师。",
      ],
      fr: [
        "Vérifiez vos propres relevés pour ce compte — contrôlez le montant et l'existence réelle de la dette.",
        "Si quelque chose cloche, envoyez une contestation écrite dans les 30 jours (conservez la preuve d'envoi).",
        "Demandez dans la même lettre la validation de la dette et l'identité du créancier initial.",
        "Consultez un avocat qualifié avant l'éventuel renvoi en justice si vous ne pouvez pas régler le litige.",
      ],
    },
    summary: {
      en: `${collector}, a debt collector, is demanding ${amtStr} for a credit card account. You have 30 days from receiving this letter to dispute the debt in writing and demand validation. The letter threatens a court referral within 45 days, which could end in a money judgment and wage garnishment if you do nothing.`,
      hi: `${collector} नामक डेट कलेक्टर एक क्रेडिट कार्ड खाते के लिए ${amtStr} की मांग कर रहा है। इस पत्र मिलने के 30 दिनों के भीतर आप लिखित रूप में इस डेट को चुनौती देकर सत्यापन मांग सकते हैं। पत्र में 45 दिनों के भीतर अदालत जाने की धमकी है — कुछ न करने पर जज्मत और वेतन कटौती हो सकती है।`,
      zh: `${collector} 是一家债务催收机构，正就一个信用卡账户要求您支付 ${amtStr}。自收到本函之日起30天内，您有权以书面形式对该债务提出异议并要求核实。信函威胁在45天内将案件移交法院——若您不采取任何行动，可能导致败诉判决和工资扣划。`,
      fr: `${collector}, une société de recouvrement, réclame ${amtStr} au titre d'un compte de carte de crédit. Vous disposez de 30 jours à compter de la réception de cette lettre pour contester la dette par écrit et exiger sa validation. La lettre menace d'un renvoi devant le tribunal sous 45 jours, ce qui peut aboutir à un jugement condamnant au paiement et à une saisie sur salaire en cas d'inaction.`,
    },
    key_risk: {
      en: "Ignoring the 30/45-day windows can end in a default judgment with wage garnishment.",
      hi: "30/45 दिनों की समा नजरअंदाज करने पर डिफॉल्ट जज्मत और वेतन कटौती हो सकती है।",
      zh: "若忽视30/45天的期限，可能面临败诉判决并被工资扣划。",
      fr: "Ignorer les délais de 30/45 jours peut aboutir à un jugement par défaut avec saisie sur salaire.",
    },
    confidence: 0.8,
  };
}

/* ─────────────────────────── Spain · LAU eviction demand ─────────────────── */

function kitEviction(t: string): Kit {
  const amt = findAmount(t) ?? { amount: 0, currency: "EUR" };
  const amtStr = amt.amount ? money(amt.amount, amt.currency) : "the unpaid rent";
  const landlord = (t.match(/D\.ª?\s+([A-ZÁÉÍÓÚ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚ][a-záéíóúñ]+)+),?\s+en calidad de arrendador/)?.[1] ?? "The landlord").trim();
  return {
    notice_type: "eviction",
    severity: "red",
    sender: { name: landlord, type: "landlord" },
    demands: [
      { demand: `Pay the unpaid rent claimed (${amtStr}) to undo the non-payment`, amount: amt.amount || null, currency: amt.currency },
      { demand: "Vacate the property if the non-payment is not undone (landlord may file for eviction)", amount: null, currency: null },
    ],
    deadlines: [
      {
        action: "Pay all rent owed before the landlord files the eviction suit",
        date: null,
        days_from_today: null,
        consequence_if_missed: "Under LAU art. 27.2.a the landlord can terminate the lease and file for eviction (desahucio por impago).",
        legal_basis_source_id: "es_lau_27",
      },
      {
        action: "If sued: pay everything owed within 10 business days of court notification (enervación)",
        date: iso(10),
        days_from_today: 10,
        consequence_if_missed: "The eviction proceeds and a date for vacating the property will be set.",
        legal_basis_source_id: "es_lec_22",
      },
    ],
    citations: [
      { source_id: "es_lau_27", relevance: "Non-payment entitles the landlord to terminate the lease and demand eviction." },
      { source_id: "es_lec_22", relevance: "First-time enervación: paying all arrears within 10 business days of the court notification stops the eviction." },
    ],
    rights: rights4([
      {
        en: ["Right to stop the eviction by paying (enervación)", "As this is the first eviction demand, paying every amount owed within 10 business days of the court notification stops the eviction."],
        hi: ["भुगतान करके बेदखली रोकने का अधिकार (enervación)", "यह पहली मांग है — अदालती सूचना के 10 कार्यदिवसों में पूरी बकाया चुकाने पर बेदखली रुक सकती है।"],
        zh: ["通过付款阻止驱逐的权利（enervación）", "由于这是第一次驱逐主张，在法院通知后10个工作日内付清全部欠款即可阻止驱逐。"],
        fr: ["Droit d'« enervación » : arrêter l'expulsion en payant", "S'agissant d'une première demande, le paiement de la totalité des sommes dues dans les 10 jours ouvrables suivant la notification judiciaire arrête l'expulsion."],
        sid: "es_lec_22",
      },
      {
        en: ["Right to a court process first", "The landlord cannot remove you without a court order; a notarial demand is a warning, not an eviction."],
        hi: ["पहले अदालती प्रक्रिया का अधिकार", "बिना अदालती आदेश मकान मालिक आपको निकाल नहीं सकता; नोटरी नोटिस चेतावनी है, बेदखली नहीं।"],
        zh: ["先经法院程序的权利", "没有法院命令，房东不能将您逐出住所；公证催告只是警告，并非驱逐。"],
        fr: ["Droit à une procédure judiciaire préalable", "Le bailleur ne peut vous expulser sans décision de justice ; un commandement notarial est un avertissement, pas une expulsion."],
        sid: null,
      },
    ]),
    next_steps: {
      en: [
        `Gather the funds to pay the full arrears (${amtStr}) as early as possible — payment before any lawsuit avoids court costs.`,
        "Request a written receipt and confirm the landlord accepts the payment in full settlement of the arrears.",
        "If you cannot pay in full, consult a qualified lawyer immediately — and check whether local tenant-assistance schemes apply.",
        "Do not ignore any court notification: the 10-day enervación window only opens once you are notified.",
      ],
      hi: [
        `पूरी बकाया (${amtStr}) जल्द से जल्द चुकाने की व्यवस्था करें — मुकदमा दायर होने से पहले भुगतान करने पर अदालती खर्च बचता है।`,
        "लिखित पावती लें और पुष्टि करें कि मकान मालिक ने पूरी बकाया का भुगतान स्वीकार किया है।",
        "पूरा भुगतान न कर सकने पर तुरंत एक योग्य वकील से संपर्क करें — और स्थानीय किरायेदार सहायता योजनाएँ जाँचें।",
        "किसी भी अदालती सूचना को नजरअंदाज न करें: 10 दिनों का enervación विंडो सूचना मिलने पर ही खुलता है।",
      ],
      zh: [
        `尽早筹措资金付清全部欠款（${amtStr}）——在对方起诉之前付款可避免诉讼费用。`,
        "索取书面收据，并确认房东接受该笔付款作为全部欠款的清偿。",
        "如无法全额支付，请立即咨询合资格律师——并查询当地租客援助计划是否适用。",
        "切勿忽视任何法院通知：10个工作日的 enervación 期限自您收到通知时才起算。",
      ],
      fr: [
        `Réunissez les fonds pour régler la totalité des arriérés (${amtStr}) dès que possible — payer avant toute assignation évite les dépens.`,
        "Exigez un reçu écrit et confirmez que le bailleur accepte le paiement en règlement total des sommes dues.",
        "Si vous ne pouvez pas payer intégralement, consultez immédiatement un avocat qualifié et renseignez-vous sur les dispositifs locaux d'aide aux locataires.",
        "N'ignorez aucune notification judiciaire : le délai d'enervación de 10 jours ne court qu'à compter de votre signification.",
      ],
    },
    summary: {
      en: `This is a notarial payment demand from your landlord, ${landlord}, claiming ${amtStr} in unpaid rent. Under Spain's urban lease law (LAU), continued non-payment lets the landlord terminate the lease and file an eviction suit (desahucio). Because this would be a first eviction claim, you would still be able to stop it by paying everything owed within 10 business days of the court notification (enervación).`,
      hi: `यह आपके मकान मालिक ${landlord} की ओर से नोटरी के जरिए भेजी गई भुगतान मांग है, जिसमें ${amtStr} की अदत्त किराया बकाया है। स्पेन के LAU कानून के तहत, भुगतान जारी रहने पर मकान मालिक अनुबंध समाप्त कर बेदखली (desahucio) का मुकदमा दायर कर सकता है। चूंकि यह पहली बेदखली मांग है, अदालती सूचना के 10 कार्यदिवसों में पूरी बकाया चुकाकर आप इसे रोक सकते हैं (enervación)।`,
      zh: `这是您的房东 ${landlord} 通过公证人发出的付款催告，主张 ${amtStr} 的未付租金。根据西班牙《城市租赁法》（LAU），持续欠租使房东有权解除租约并提起驱逐诉讼（desahucio）。由于这将是第一次驱逐主张，您仍可在法院通知后10个工作日内付清全部欠款来阻止驱逐（enervación）。`,
      fr: `Il s'agit d'un commandement de payer délivré par notaire par votre bailleur, ${landlord}, qui réclame ${amtStr} de loyers impayés. En vertu de la loi espagnole sur les baux urbains (LAU), le défaut de paiement persistant permet au bailleur de résilier le bail et d'intenter une action en expulsion (desahucio). S'agissant d'une première demande de ce type, vous pourriez encore l'arrêter en réglant la totalité des sommes dues dans les 10 jours ouvrables suivant la notification judiciaire (enervación).`,
    },
    key_risk: {
      en: "Your home is at risk: an eviction suit ends your tenancy — only fast payment (or the 10-day enervación window) stops it.",
      hi: "आपका घर खतरे में है: बेदखली मुकदमा किराया खत्म कर देगा — केवल तेज़ भुगतान (या 10 दिनों की enervación अवधि) ही इसे रोक सकता है।",
      zh: "您的住所面临风险：驱逐诉讼将终止您的租赁关系——只有尽快付款（或利用10个工作日的 enervación 期限）才能阻止。",
      fr: "Votre logement est menacé : une action en expulsion met fin au bail — seul un paiement rapide (ou le délai d'enervación de 10 jours) peut l'arrêter.",
    },
    confidence: 0.8,
  };
}

/* ─────────────────────────── Generic / unknown ─────────────────── */

function kitGeneric(t: string): Kit {
  const amt = findAmount(t);
  const amtStr = amt ? money(amt.amount, amt.currency) : "an amount";
  return {
    notice_type: "other",
    severity: "yellow",
    sender: { name: "Unknown sender", type: "unknown" },
    demands: [{ demand: "The notice requests some action — verify the exact demand in the text.", amount: amt?.amount ?? null, currency: amt?.currency ?? null }],
    deadlines: [],
    citations: [],
    rights: rights4([
      {
        en: ["Right to verify before responding", "You are never obliged to respond on the spot. Verify the sender, the claim and the deadline with official sources first."],
        hi: ["जवाब देने से पहले सत्यापन का अधिकार", "तुरंत जवाब देने की कोई बाध्यता नहीं है। पहले प्रेषक, दावा और समा-सीमा आधिकारिक स्रोतों से जाँचें।"],
        zh: ["回复前先行核实的权利", "您绝无义务立即回复。请先通过官方来源核实寄件人身份、对方主张和期限。"],
        fr: ["Droit de vérifier avant de répondre", "Vous n'êtes jamais obligé de répondre immédiatement. Vérifiez d'abord l'expéditeur, la réclamation et le délai auprès de sources officielles."],
        sid: null,
      },
    ]),
    next_steps: {
      en: [
        "Identify the sender and verify the claim against your own records.",
        "Note any date or deadline mentioned and diarise it immediately.",
        "Gather related documents (contracts, receipts, emails) before responding.",
        "Consult a qualified lawyer if money, property or legal proceedings are mentioned.",
      ],
      hi: [
        "प्रेषक की पहचान करें और अपने रिकॉर्ड से दावे की जाँच करें।",
        "उल्लिखित कोई भी तारीख या समा-सीमा तुरंत नोट करें।",
        "जवाब देने से पहले संबंधित दस्तावेज़ (अनुबंध, रसीदें, ईमेल) इकट्ठा करें।",
        "धन, संपत्ति या कानूनी कार्यवाही का उल्लेख हो तो एक योग्य वकील से संपर्क करें।",
      ],
      zh: [
        "查明寄件人身份，并对照您自己的记录核实对方主张。",
        "记下文中提到的任何日期或期限，并立即登记在案。",
        "回复之前收集相关文件（合同、收据、电子邮件）。",
        "如涉及金钱、财产或法律程序，请咨询合资格律师。",
      ],
      fr: [
        "Identifiez l'expéditeur et vérifiez la réclamation au regard de vos propres documents.",
        "Notez immédiatement toute date ou tout délai mentionné et inscrivez-le dans votre agenda.",
        "Rassemblez les documents pertinents (contrats, reçus, e-mails) avant de répondre.",
        "Consultez un avocat qualifié si de l'argent, un bien ou une procédure judiciaire est mentionné.",
      ],
    },
    summary: {
      en: `This appears to be a formal legal notice, but the offline demo engine could not match it to a supported category (debt collection, cheque bounce, or eviction). It references ${amtStr} and possibly a deadline. Read the original carefully and treat any date mentioned as important.`,
      hi: `यह एक औपचारिक कानूनी नोटिस प्रतीत होता है, लेकिन ऑफलाइन डेमो इंजन इसे समर्थित श्रेणी (डेट कलेक्शन, चेक अनादरण या बेदखली) से मेल नहीं खा पाया। इसमें ${amtStr} और संभवतः कोई समा-सीमा का उल्लेख है। मूल दस्तावेज़ ध्यान से पढ़ें और उल्लिखित हर तारीख को महत्वपूर्ण मानें।`,
      zh: `这似乎是一份正式的法律通知，但离线演示引擎未能将其归入受支持的类别（债务催收、支票退票或驱逐）。文中提及 ${amtStr}，并可能涉及某个期限。请仔细阅读原件，并将文中提及的任何日期都视为重要。`,
      fr: `Il semble s'agir d'une mise en demeure formelle, mais le moteur de démonstration hors ligne n'a pas pu la classer dans une catégorie prise en charge (recouvrement de créances, chèque impayé ou expulsion). Elle mentionne ${amtStr} et possiblement un délai. Lisez l'original avec attention et traitez toute date mentionnée comme importante.`,
    },
    key_risk: {
      en: "Unclassified notice: a missed deadline cannot be ruled out — verify the dates in the text today.",
      hi: "अवर्गीकृत नोटिस: समा छूटने की संभावना खारिज नहीं की जा सकती — आज ही दस्तावेज़ की तारीखें जाँचें।",
      zh: "未分类通知：无法排除错过期限的可能——请今天就核实文中的日期。",
      fr: "Avis non classé : un délai manqué ne peut être exclu — vérifiez dès aujourd'hui les dates figurant dans le document.",
    },
    confidence: 0.55,
  };
}

/* ─────────────────────────── dispatcher ─────────────────── */

export function offlineAnalyze(text: string): Analysis {
  const isCheque = /section\s*138|negotiable\s*instruments|cheque|checque|dishonou?r/i.test(text);
  const isDebt = /debt\s*collect|fdcpa|collect(?:ion)?\s+agency|attempt\s+to\s+collect\s+a\s+debt|validation\s+of\s+the\s+debt|this\s+is\s+an\s+attempt/i.test(text);
  const isEviction = /desahuci|arrendatari|arrendador|renta\s+devengada|requerimiento\s+notarial|eviction\s+notice|notice\s+to\s+quit|lau\b/i.test(text);

  let kit: Kit;
  let jurisdiction: Analysis["jurisdiction"];
  let lang: string;

  if (isCheque && /rs\.|₹|india|mumbai|magistrate|hdfc|sbi|icici/i.test(text)) {
    kit = kitChequeBounce(text);
    jurisdiction = { country: "IN", region: /mumbai|maharashtra/i.test(text) ? "Maharashtra" : "India", confidence: 0.85 };
    lang = /[\u0900-\u097F]/.test(text) ? "hi" : "en";
  } else if (isDebt || (isCheque && /\$/i.test(text))) {
    kit = kitDebtCollection(text);
    const state = /new york|brooklyn|kings county/i.test(text) ? "New York" : /california/i.test(text) ? "California" : /texas/i.test(text) ? "Texas" : "Federal";
    jurisdiction = { country: "US", region: state, confidence: 0.85 };
    lang = "en";
  } else if (isEviction) {
    kit = kitEviction(text);
    jurisdiction = { country: "ES", region: /madrid/i.test(text) ? "Madrid" : /barcelona|cataluña/i.test(text) ? "Cataluña" : "Spain", confidence: 0.82 };
    lang = "es";
  } else {
    kit = kitGeneric(text);
    const l = detectLanguage(text);
    lang = l;
    jurisdiction = { country: "XX", region: "Unresolved", confidence: 0.4 };
  }

  const block = (loc: Locale): LocalizedBlock => ({
    summary: kit.summary[loc],
    key_risk: kit.key_risk[loc],
    rights: kit.rights[loc],
    next_steps: kit.next_steps[loc],
  });

  return {
    notice_type: kit.notice_type,
    jurisdiction,
    language_detected: lang,
    sender: kit.sender,
    demands: kit.demands,
    deadlines: kit.deadlines,
    severity: { level: kit.severity, confidence: 0.75 },
    citations: kit.citations,
    localized: { en: block("en"), hi: block("hi"), zh: block("zh"), fr: block("fr") },
    overall_confidence: kit.confidence,
  };
}
