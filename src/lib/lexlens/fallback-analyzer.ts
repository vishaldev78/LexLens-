// LexLens — Offline Demo Engine (fallback analyzer).
// Rule-based analyzer used when the LLM backend is unreachable (e.g. running
// locally in VS Code without SDK credentials, or a transient network failure).
// It pattern-matches the supported notice families, extracts entities with
// regex, and produces the exact same Analysis schema so the UI never breaks.

import type {
  Analysis,
  Deadline,
  Demand,
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
    if (currency === "EUR") return `€${new Intl.NumberFormat("es-ES").format(n)}`;
    return `${currency ?? ""} ${n}`.trim();
  } catch {
    return `${currency ?? ""} ${n}`.trim();
  }
}

function detectLanguage(t: string): string {
  const devanagari = (t.match(/[\u0900-\u097F]/g) ?? []).length;
  if (devanagari > t.length * 0.05) return "hi";
  if (/\b(el|la|los|las|que|de|y)\b/i.test(t) && /ción|arrendatari|desahuci|pago/i.test(t)) return "es";
  return "en";
}

const num = (s: string) => Number(s.replace(/[, ]/g, ""));

function findAmount(t: string): { amount: number; currency: string } | null {
  // Indian formats: Rs. 4,50,000 / ₹4,50,000 / Rs 450000
  const inr = t.match(/(?:rs\.?|₹|inr)\s*([0-9][0-9,]*(?:\.[0-9]+)?)/i);
  if (inr) return { amount: num(inr[1]), currency: "INR" };
  // US: $2,340.55
  const usd = t.match(/\$\s*([0-9][0-9,]*(?:\.[0-9]{2})?)/);
  if (usd) return { amount: num(usd[1]), currency: "USD" };
  // ES: 2.750,00 €
  const eur = t.match(/([0-9][0-9.]*,[0-9]{2})\s*€/);
  if (eur) return { amount: num(eur[1].replace(/\./g, "").replace(",", ".")), currency: "EUR" };
  return null;
}

function r(title_en: string, detail_en: string, title_hi: string, detail_hi: string, title_es: string, detail_es: string, source_id: string | null): Record<"en" | "hi" | "es", LocalizedRight> {
  return {
    en: { title: title_en, detail: detail_en, source_id },
    hi: { title: title_hi, detail: detail_hi, source_id },
    es: { title: title_es, detail: detail_es, source_id },
  };
}

interface Kit {
  notice_type: NoticeType;
  severity: SeverityLevel;
  sender: { name: string; type: string };
  demands: Demand[];
  deadlines: Deadline[];
  citations: Analysis["citations"];
  rights: Record<"en" | "hi" | "es", LocalizedRight[]>;
  next_steps: Record<"en" | "hi" | "es", string[]>;
  summary: Record<"en" | "hi" | "es", string>;
  key_risk: Record<"en" | "hi" | "es", string>;
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
    rights: (() => {
      const recs = [
        r(
          "Right to pay within 15 days",
          "The notice itself gives you a 15-day window — paying the cheque amount within it completely bars the criminal complaint.",
          "15 दिनों के भीतर भुगतान का अधिकार",
          "नोटिस मिलने के 15 दिनों के भीतर चेक राशि चुकाने पर आपराधिक शिकायत नहीं हो सकती।",
          "Derecho a pagar dentro de 15 días",
          "Pagar el importe del cheque dentro del plazo de 15 días impide la querella criminal.",
          "in_ni_138"
        ),
        r(
          "Right to contest liability",
          "You may respond in writing denying liability (e.g., cheque not issued toward this debt, payment already made, or signature disputed) — the complainant must then prove the case.",
          "देयता चुनौती देने का अधिकार",
          "आप लिखित रूप में देयता से इनकार कर सकते हैं — तब शिकायतकर्ता को अदालत में अपना मामला साबित करना होगा।",
          "Derecho a impugnar la deuda",
          "Puede responder por escrito negando la obligación de pago; el denunciante deberá probar su caso.",
          null
        ),
      ];
      return {
        en: recs.map((x) => x.en),
        hi: recs.map((x) => x.hi),
        es: recs.map((x) => x.es),
      };
    })(),
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
      es: [
        `Organice el pago de ${amtStr} antes de que venza el plazo de 15 días; lo mejor es una transferencia con acuse escrito.`,
        "Guarde juntos el cheque, el memo de devolución bancario y este aviso.",
        "Responda al aviso por escrito (conservando prueba de entrega) exponiendo su postura.",
        "Consulte de inmediato con un abogado cualificado: hay exposición penal, no solo una exigencia civil.",
      ],
    },
    summary: {
      en: `This is a criminal legal notice under Section 138 of the Negotiable Instruments Act, sent by ${advocate} on behalf of ${client}. A cheque of ${amtStr} was dishonoured for insufficient funds, and you are being asked to pay the full amount plus interest within 15 days of receiving this notice. If you do not pay within those 15 days, a criminal case can be filed before the Magistrate court.`,
      hi: `यह परक्राम्य लिखत अधिनियम की धारा 138 के तहत आपराधिक कानूनी नोटिस है, जो ${advocate} द्वारा ${client} की ओर से भेजा गया है। ${amtStr} का चेक फंड की कमी के कारण अनादरित हुआ है और आपसे नोटिस मिलने के 15 दिनों के भीतर ब्याज सहित पूरी राशि मांगी जा रही है। 15 दिनों में भुगतान न करने पर मजिस्ट्रेट अदालत में आपराधिक केस दर्ज हो सकता है।`,
      es: `Este es un aviso legal de carácter penal conforme al artículo 138 de la Ley de Instrumentos Negociables (India), enviado por ${advocate} en nombre de ${client}. Un cheque de ${amtStr} fue devuelto por fondos insuficientes y se le exige pagar el importe íntegro más intereses dentro de los 15 días desde la recepción del aviso. Si no paga en ese plazo, puede presentarse una causa penal ante el juzgado.`,
    },
    key_risk: {
      en: `Criminal prosecution under Section 138: up to 2 years' imprisonment or a fine up to twice the cheque amount if the 15-day window lapses unpaid.`,
      hi: `धारा 138 के तहत आपराधिक अभियोजन: 15 दिनों में भुगतान न होने पर 2 साल तक की जेल या चेक राशि का दोगुना जुर्माना हो सकता है।`,
      es: `Encausamiento penal por el artículo 138: hasta 2 años de prisión o multa de hasta el doble del importe del cheque si vence el plazo de 15 días sin pago.`,
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
  const rightsEn = [
    { title: "30-day validation right", detail: "Disputing in writing within 30 days forces the collector to stop collection until it mails verification of the debt.", source_id: "fdcpa_1692g" },
    { title: "Protection from false threats", detail: "Collectors may not threaten court action they do not intend or are not permitted to take.", source_id: "fdcpa_1692e" as const },
  ];
  const kit: Kit = {
    notice_type: "debt_collection",
    severity: "yellow",
    sender: { name: collector, type: "debt_collector" },
    demands: [
      { demand: `Pay the claimed credit-card balance of ${amtStr}`, amount: amt.amount || null, currency: amt.currency },
      { demand: `Or accept a settlement offer (~70% of balance)`, amount: amt.amount ? Math.round(amt.amount * 0.7 * 100) / 100 : null, currency: amt.currency },
    ],
    deadlines,
    citations,
    rights: {
      en: rightsEn,
      hi: [
        { title: "30-दिन का सत्यापन अधिकार", detail: "30 दिनों के भीतर लिखित विवाद करने पर कलेक्टर को सत्यापन भेजने तक वसूली रोकनी होगी।", source_id: "fdcpa_1692g" },
        { title: "झूठी धमकियों से सुरक्षा", detail: "कलेक्टर ऐसी अदालती कार्रवाई की धमकी नहीं दे सकता जिसका इरादा या अधिकार नहीं है।", source_id: "fdcpa_1692e" },
      ],
      es: [
        { title: "Derecho de validación de 30 días", detail: "Disputar por escrito dentro de 30 días obliga al cobrador a pausar el reclamo hasta enviar la verificación.", source_id: "fdcpa_1692g" },
        { title: "Protección contra amenazas falsas", detail: "Los cobradores no pueden amenazar con acciones judiciales que no van a ejercer.", source_id: "fdcpa_1692e" },
      ],
    },
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
      es: [
        "Revise sus registros de esta cuenta: verifique el importe y que la deuda sea suya.",
        "Si algo no cuadra, envíe una disputa por escrito dentro de 30 días (guarde prueba de envío).",
        "Solicite en la misma carta la validación de la deuda y los datos del acreedor original.",
        "Consulte con un abogado cualificado antes del posible envío a tribunales si no puede resolverlo.",
      ],
    },
    summary: {
      en: `${collector}, a debt collector, is demanding ${amtStr} for a credit card account. You have 30 days from receiving this letter to dispute the debt in writing and demand validation. The letter threatens a court referral within 45 days, which could end in a money judgment and wage garnishment if you do nothing.`,
      hi: `${collector} नामक डेट कलेक्टर एक क्रेडिट कार्ड खाते के लिए ${amtStr} की मांग कर रहा है। इस पत्र मिलने के 30 दिनों के भीतर आप लिखित रूप में इस डेट को चुनौती देकर सत्यापन मांग सकते हैं। पत्र में 45 दिनों के भीतर अदालत जाने की धमकी है — कुछ न करने पर जज्मत और वेतन कटौती हो सकती है।`,
      es: `${collector}, una agencia de cobro, exige ${amtStr} por una cuenta de tarjeta de crédito. Tiene 30 días desde recibir esta carta para disputar la deuda por escrito y exigir su validación. La carta amenaza con acudir a los tribunales en 45 días, lo que podría terminar en un fallo y embargo de salario si no actúa.`,
    },
    key_risk: {
      en: "Ignoring the 30/45-day windows can end in a default judgment with wage garnishment.",
      hi: "30/45 दिनों की समा नजरअंदाज करने पर डिफॉल्ट जज्मत और वेतन कटौती हो सकती है।",
      es: "Ignorar los plazos de 30/45 días puede acabar en un fallo en rebeldía con embargo de salario.",
    },
    confidence: 0.8,
  };
  return kit;
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
    rights: {
      en: [
        { title: "Right to stop the eviction by paying (enervación)", detail: "As this is the first eviction demand, paying every amount owed within 10 business days of the court notification stops the eviction.", source_id: "es_lec_22" },
        { title: "Right to a court process first", detail: "The landlord cannot remove you without a court order; a notarial demand is a warning, not an eviction.", source_id: null },
      ],
      hi: [
        { title: "भुगतान करके बेदखली रोकने का अधिकार (enervación)", detail: "यह पहली मांग है — अदालती सूचना के 10 कार्यदिवसों में पूरी बकाया चुकाने पर बेदखली रुक सकती है।", source_id: "es_lec_22" },
        { title: "पहले अदालती प्रक्रिया का अधिकार", detail: "बिना अदालती आदेश मकान मालिक आपको निकाल नहीं सकता; नोटरी नोटिस चेतावनी है, बेदखली नहीं।", source_id: null },
      ],
      es: [
        { title: "Derecho a enervar la acción pagando", detail: "Al ser la primera demanda, pagando todo lo adeudado en los 10 días hábiles tras la notificación judicial se detiene el desahucio.", source_id: "es_lec_22" },
        { title: "Derecho a un proceso judicial previo", detail: "El arrendador no puede desalojarle sin orden judicial; un requerimiento notarial es un aviso, no un desalojo.", source_id: null },
      ],
    },
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
      es: [
        `Reúna los fondos para pagar toda la deuda (${amtStr}) cuanto antes: pagar antes de la demanda evita costas judiciales.`,
        "Exija recibo escrito y confirme que el arrendador acepta el pago como liquidación total de la deuda.",
        "Si no puede pagar el total, consulte de inmediato con un abogado cualificado y verifique si aplica algún programa local de asistencia al inquilino.",
        "No ignore ninguna notificación judicial: el plazo de 10 días para enervar solo se abre al ser notificado.",
      ],
    },
    summary: {
      en: `This is a notarial payment demand from your landlord, ${landlord}, claiming ${amtStr} in unpaid rent. Under Spain's urban lease law (LAU), continued non-payment lets the landlord terminate the lease and file an eviction suit (desahucio). Because this would be a first eviction claim, you would still be able to stop it by paying everything owed within 10 business days of the court notification (enervación).`,
      hi: `यह आपके मकान मालिक ${landlord} की ओर से नोटरी के जरिए भेजी गई भुगतान मांग है, जिसमें ${amtStr} की अदत्त किराया बकाया है। स्पेन के LAU कानून के तहत, भुगतान जारी रहने पर मकान मालिक अनुबंध समाप्त कर बेदखली (desahucio) का मुकदमा दायर कर सकता है। चूंकि यह पहली बेदखली मांग है, अदालती सूचना के 10 कार्यदिवसों में पूरी बकाया चुकाकर आप इसे रोक सकते हैं (enervación)।`,
      es: `Este es un requerimiento notarial de pago de su arrendadora, ${landlord}, que reclama ${amtStr} de rentas impagadas. Según la LAU, el impago continuado faculta al arrendador para resolver el contrato e interponer demanda de desahucio. Al ser la primera reclamación de este tipo, aún podría detenerlo pagando todo lo adeudado en los 10 días hábiles desde la notificación judicial (enervación).`,
    },
    key_risk: {
      en: "Your home is at risk: an eviction suit ends your tenancy — only fast payment (or the 10-day enervación window) stops it.",
      hi: "आपका घर खतरे में है: बेदखली मुकदमा किराया खत्म कर देगा — केवल तेज़ भुगतान (या 10 दिनों की enervación अवधि) ही इसे रोक सकता है।",
      es: "Su vivienda está en riesgo: la demanda de desahucio pone fin al alquiler; solo el pago rápido (o la enervación de 10 días) lo detiene.",
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
    rights: {
      en: [{ title: "Right to verify before responding", detail: "You are never obliged to respond on the spot. Verify the sender, the claim and the deadline with official sources first.", source_id: null }],
      hi: [{ title: "जवाब देने से पहले सत्यापन का अधिकार", detail: "तुरंत जवाब देने की कोई बाध्यता नहीं है। पहले प्रेषक, दावा और समा-सीमा आधिकारिक स्रोतों से जाँचें।", source_id: null }],
      es: [{ title: "Derecho a verificar antes de responder", detail: "No está obligado a responder de inmediato. Verifique remitente, reclamación y plazo con fuentes oficiales.", source_id: null }],
    },
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
      es: [
        "Identifique al remitente y verifique la reclamación con sus propios registros.",
        "Anote cualquier fecha o plazo mencionado y agéndelo de inmediato.",
        "Reúna los documentos relacionados (contratos, recibos, correos) antes de responder.",
        "Consulte con un abogado cualificado si se mencionan dinero, propiedad o procedimientos legales.",
      ],
    },
    summary: {
      en: `This appears to be a formal legal notice, but the offline demo engine could not match it to a supported category (debt collection, cheque bounce, or eviction). It references ${amtStr} and possibly a deadline. Read the original carefully and treat any date mentioned as important.`,
      hi: `यह एक औपचारिक कानूनी नोटिस प्रतीत होता है, लेकिन ऑफलाइन डेमो इंजन इसे समर्थित श्रेणी (डेट कलेक्शन, चेक अनादरण या बेदखली) से मेल नहीं खा पाया। इसमें ${amtStr} और संभवतः कोई समा-सीमा का उल्लेख है। मूल दस्तावेज़ ध्यान से पढ़ें और उल्लिखित हर तारीख को महत्वपूर्ण मानें।`,
      es: `Parece un aviso legal formal, pero el motor de demostración sin conexión no pudo clasificarlo (cobro de deudas, protesto de cheque o desahucio). Menciona ${amtStr} y posiblemente un plazo. Lea el original con atención y trate cualquier fecha indicada como importante.`,
    },
    key_risk: {
      en: "Unclassified notice: a missed deadline cannot be ruled out — verify the dates in the text today.",
      hi: "अवर्गीकृत नोटिस: समा छूटने की संभावना खारिज नहीं की जा सकती — आज ही दस्तावेज़ की तारीखें जाँचें।",
      es: "Aviso sin clasificar: no se puede descartar la pérdida de un plazo; verifique hoy las fechas del documento.",
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

  const block = (loc: "en" | "hi" | "es"): LocalizedBlock => ({
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
    localized: { en: block("en"), hi: block("hi"), es: block("es") },
    overall_confidence: kit.confidence,
  };
}
