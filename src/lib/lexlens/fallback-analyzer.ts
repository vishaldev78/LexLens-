// LexLens — Offline Demo Engine v2 (fallback analyzer).
// Rule-based extractor used when the LLM backend is unreachable (local VS Code
// run without SDK credentials, transient network failure). Produces the exact
// same CaseBase schema as the LLM path so the deterministic case engine, UI
// and tests behave identically. Never invents dates or amounts it cannot find.

import type { CaseBase, ExtractedClaim, ExtractedFact, Locale, LocalizedBlock, NoticeType, StatedDeadline } from "./types";

/* ───────────────────────── small utils ───────────────────────── */

const num = (s: string) => Number(s.replace(/[, ]/g, ""));

function detectLanguage(t: string): string {
  const devanagari = (t.match(/[\u0900-\u097F]/g) ?? []).length;
  if (devanagari > t.length * 0.05) return "hi";
  const cjk = (t.match(/[\u4E00-\u9FFF]/g) ?? []).length;
  if (cjk > t.length * 0.05) return "zh";
  if (/\b(vous|dans|pour|une|le|la|aux|avec)\b/i.test(t) && /mise en demeure|expulsion|créance|loyers|bailleur|huissier|enerv/i.test(t)) return "fr";
  if (/\b(el|la|los|las|que|de|y)\b/i.test(t) && /ción|arrendatari|desahuci|pago|notari/i.test(t)) return "es";
  return "en";
}

function findAmount(t: string): { amount: number; currency: string } | null {
  const inr = t.match(/(?:rs\.?|₹|inr)\s*([0-9][0-9,]*(?:\.[0-9]+)?)/i);
  if (inr) return { amount: num(inr[1].replace(/,/g, "")), currency: "INR" };
  const usd = t.match(/\$\s*([0-9][0-9,]*(?:\.[0-9]{2})?)/);
  if (usd) return { amount: num(usd[1].replace(/,/g, "")), currency: "USD" };
  const eur = t.match(/([0-9][0-9 .,]*,[0-9]{2})\s*€/);
  if (eur) return { amount: num(eur[1].replace(/\./g, "").replace(",", ".")), currency: "EUR" };
  return null;
}

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7,
  august: 8, september: 9, sept: 9, october: 10, november: 11, december: 12,
  janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4, juin: 6, juillet: 7, août: 8, aout: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12, decembre: 12,
  enero: 1, febrero: 2, marzo: 3, abril: 4, junio: 6, julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

/** Parse the date formats our demos + most notices use. Returns YYYY-MM-DD. */
export function parseHumanDate(s: string): string | null {
  const t = s.trim();
  let m: RegExpMatchArray | null;
  // ISO
  if ((m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/))) return t;
  // 13 September 2026 / 13 de septiembre de 2026
  if ((m = t.match(/(\d{1,2})\s*(?:de\s+)?([A-Za-zéûà]+)\s*(?:de\s+)?(\d{4})/))) {
    const mo = MONTHS[m[2].toLowerCase()];
    if (mo) return `${m[3]}-${String(mo).padStart(2, "0")}-${String(Number(m[1])).padStart(2, "0")}`;
  }
  // September 13, 2026
  if ((m = t.match(/([A-Za-zéûà]+)\s+(\d{1,2}),?\s+(\d{4})/))) {
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

const WORDNUM: Record<string, number> = { one: 1, two: 2, three: 3, five: 5, seven: 7, ten: 10, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fortyfive: 45, sixty: 60, ninety: 90 };

function parsePeriod(text: string): { days: number; anchor: "receipt" | "notice" | "explicit" } | null {
  const re = /within\s+([a-z]+|\d+)\s*(?:\((\d+)\))?\s*(?:calendar|business)?\s*days?\s*(?:habiles?|ouvrables)?\s*(.*?)(?:[.;]|\n|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const w = m[1].toLowerCase().replace(/[^a-z0-9]/g, "");
    let days = /^\d+$/.test(w) ? Number(w) : (WORDNUM[w] ?? null);
    if (days === null && m[2]) days = Number(m[2]);
    if (!days) continue;
    const tail = (m[3] ?? "").toLowerCase();
    if (/receip|receiv|prapt|notification|notificación|réception|से प्राप्त/i.test(tail)) return { days, anchor: "receipt" };
    if (/this notice|of this notice|de ce constat|नोटिस की तारीख|本通知之日/i.test(tail) && !/receip|receiv/i.test(tail)) return { days, anchor: "notice" };
    return { days, anchor: "receipt" };
  }
  return null;
}

/* ───────────────────────── classification ───────────────────────── */

function classify(t: string): NoticeType {
  if (/section\s*138|negotiable\s*instruments|cheque|चेक|check\s*no/i.test(t)) return "cheque_bounce";
  if (/debt\s*collect|collection\s*(letter|agency|notice)|fdcpa|creditor|recover.*debt|settle.*balance/i.test(t)) return "debt_collection";
  if (/desahuci|arrendamiento|expuls|enerv/i.test(t)) return "eviction";
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
  const notary = text.match(/D\.\s*([A-ZÁ][A-Za-zÁÉÍÓÚáéíóúñ' ]+),\s*Notario/i);
  if (notary) return { name: notary[1].trim(), type: "notary" };
  const collector = text.match(/^([A-Z][A-Z& .]+ (?:LLC|INC|LTD))\s*$/m);
  if (collector) return { name: collector[1].trim(), type: "debt_collector" };
  const firm = text.match(/^([A-Z][A-Za-z&.,' ]+(?:LLC|Pvt\.? Ltd\.?|Ltd\.?|Traders|Associates))\b/m);
  if (firm) return { name: firm[1].trim(), type: "company" };
  return { name: "Unknown", type: "unknown" };
}

function findRecipient(text: string): string | null {
  const to = text.match(/To,?\s*\n?\s*(?:Mr\.?|Ms\.?|Mrs\.?|D\.ª|D\.)\s*([A-Z][A-Za-z ]+)\n/i);
  if (to) return `${to[0].replace(/^To,?\s*\n?\s*/i, "").split(",")[0].trim()}`;
  const dear = text.match(/Dear\s+(?:Mr\.?|Ms\.?)\s+([A-Za-z ]+)[,:]/);
  if (dear) return `Mr. ${dear[1].trim()}`;
  const req = text.match(/requiriendo\s+a\s+(D\.ª\s*[A-ZÁ][A-Za-záéíóúñ' ]+)/i);
  if (req) return req[1].trim();
  return null;
}

/* ───────────────────────── per-kit localized explanation blocks ───────────────────────── */

function block(sum: Record<Locale, string>, risk: Record<Locale, string>, steps: Record<Locale, string[]>): Record<Locale, LocalizedBlock> {
  return {
    en: { summary: sum.en, key_risk: risk.en, rights: [], next_steps: steps.en },
    hi: { summary: sum.hi, key_risk: risk.hi, rights: [], next_steps: steps.hi },
    zh: { summary: sum.zh, key_risk: risk.zh, rights: [], next_steps: steps.zh },
    fr: { summary: sum.fr, key_risk: risk.fr, rights: [], next_steps: steps.fr },
  };
}

function localizedFor(type: NoticeType, sender: string, amountStr: string | null, jurisdiction: string): Record<Locale, LocalizedBlock> {
  const who = sender && sender !== "Unknown" ? sender : "";
  const blocks: Partial<Record<NoticeType, Record<Locale, LocalizedBlock>>> = {
    cheque_bounce: block(
      {
        en: `A legal notice under Section 138 of the Negotiable Instruments Act has been sent on behalf of ${who || "a claimant"}. It demands payment of ${amountStr ?? "a stated amount"} for a dishonoured cheque within 15 days of receiving the notice. If the statutory conditions are satisfied and payment is not made in that window, the payee may file a criminal complaint under Sections 138 and 142.`,
        hi: `${who || "एक दावेदार"} की ओर से धारा 138 (परिवहनीय उपकरण अधिनियम) के अंतर्गत कानूनी नोटिस भेजा गया है। यह ${amountStr ?? "बताई गई राशि"} का भुगतान, नोटिस प्राप्ति से 15 दिनों के भीतर, अनादरित चेक के लिए मांगता है। यदि वैधानिक शर्तें पूरी हों और इस अवधि में भुगतान न हो, तो लाभार्थी धारा 138 व 142 के तहत आपराधिक शिकायत कर सकता है।`,
        zh: `${who || "索赔方"}依据《流通票据法》第138条发出法律通知，要求在收到通知后15日内支付${amountStr ?? "载明金额"}（支票退票）。如法定条件成就且未在该期限内付款，收款方可依第138条及第142条提起刑事控告。`,
        fr: `Un constat juridique au titre de l'article 138 du NI Act a été envoyé pour le compte de ${who || "un réclamant"}. Il exige le paiement de ${amountStr ?? "un montant indiqué"} pour un chèque rejeté, sous 15 jours dès réception. Si les conditions légales sont réunies sans paiement, le bénéficiaire peut déposer une plainte pénale (art. 138 et 142).`,
      },
      {
        en: "While the cheque amount remains unpaid, the notice carries criminal exposure under Section 138 NI Act.",
        hi: "चेक राशि बकाया रहने तक इस नोटिस में धारा 138 के अंतर्गत आपराधिक जोखिम बना रहता है।",
        zh: "在支票款项付清之前，该通知存在第138条项下的刑事风险。",
        fr: "Tant que le chèque reste impayé, le constat expose au pénal (art. 138 NI Act).",
      },
      {
        en: ["Confirm the date you actually received the notice — the 15-day window runs from receipt.", "Verify the cheque number, bank and amount against your own records.", "Gather the cheque copy, bank return memo and underlying invoice.", "Consult a qualified lawyer before the payment window closes."],
        hi: ["पुष्टि करें कि नोटिस वास्तव में कब प्राप्त हुआ — 15-दिन की अवधि प्राप्ति से चलती है।", "चेक संख्या, बैंक और राशि अपने रिकॉर्ड से जांचें।", "चेक प्रति, बैंक रिटर्न मेमो और मूल इनवॉइस इकट्ठा करें।", "भुगतान अवधि समाप्त होने से पहले योग्य वकील से सलाह लें।"],
        zh: ["确认实际收到通知的日期——15天期限自收到起算。", "将支票号码、银行与金额与自己的记录核对。", "收集支票复印件、银行退票凭证及基础发票。", "在付款期限届满前咨询合格律师。"],
        fr: ["Confirmez la date réelle de réception — le délai de 15 jours court dès réception.", "Vérifiez numéro du chèque, banque et montant avec vos documents.", "Réunissez copie du chèque, mémoire de rejet et facture sous-jacente.", "Consultez un avocat qualifié avant la fin du délai de paiement."],
      },
    ),
    debt_collection: block(
      {
        en: `${who || "A debt collector"} claims you owe ${amountStr ?? "a balance"} on a referenced account. Under FDCPA §1692g you may dispute the debt — or any part — in writing within 30 days of receiving this notice, which suspends collection until the debt is verified. If the debt is not resolved, the letter threatens referral to court.`,
        hi: `${who || "एक डेट कलेक्टर"} का कहना है कि आप पर ${amountStr ?? "एक राशि"} बकाया है। FDCPA §1692g के तहत आप नोटिस प्राप्ति से 30 दिनों के भीतर लिखित रूप में विवाद कर सकते हैं — तब तक वसूली रुक जाती है जब तक कर्ज सत्यापित न हो। समाधान न होने पर पत्र अदालत जाने की बात करता है।`,
        zh: `${who || "催收机构"}声称您在某账户下欠款${amountStr ?? "一定金额"}。根据 FDCPA 第1692g条，您可在收到通知后30天内以书面形式争议全部或部分债务，催收将暂停直至债务核实。若未解决，信中威胁将诉诸法院。`,
        fr: `${who || "Un collecteur"} affirme que vous devez ${amountStr ?? "un solde"} sur un compte désigné. Selon la FDCPA §1692g, vous pouvez contester par écrit sous 30 jours dès réception, ce qui suspend le recouvrement jusqu'à vérification. À défaut, la lettre menace d'une action en justice.`,
      },
      {
        en: "A money judgment (with possible wage garnishment) is the stated escalation if the debt stays unresolved.",
        hi: "कर्ज अनसुलझा रहने पर बताया गया अगला कदम धन-आदेश (संभावित वेतन कटौती) है।",
        zh: "若债务持续未决，信中列明的升级路径是金钱判决（可能伴随工资扣划）。",
        fr: "Un jugement (avec saisie possible de salaire) est l'escalade annoncée si la dette demeure irrésolue.",
      },
      {
        en: ["Confirm when you received the letter — the 30-day window runs from receipt.", "Dispute in writing within the window if any part is wrong; request verification and the original creditor's details.", "Match the claimed balance to your own statements.", "Contact a lawyer or legal-aid clinic if a court action actually arrives."],
        hi: ["पुष्टि करें कि पत्र कब मिला — 30-दिन की अवधि प्राप्ति से चलती है।", "यदि कोई भाग गलत है तो अवधि में लिखित विवाद करें; सत्यापन व मूल लेनदार विवरण मांगें।", "दावे वाली राशि अपने विवरण से मिलाएँ।", "अदालती कार्रवाई होने पर वकील या लीगल-एड से संपर्क करें।"],
        zh: ["确认收到信件的日期——30天期限自收到起算。", "如任何部分有误，在期限内书面争议；并要求核实材料与原始债权人信息。", "将所主张余额与自己的对账单核对。", "若实际收到诉讼，联系律师或法律援助。"],
        fr: ["Confirmez la date de réception — le délai de 30 jours court dès réception.", "Si un élément est erroné, contestez par écrit dans le délai ; demandez la vérification et les coordonnées du créancier initial.", "Rapprochez le solde réclamé de vos relevés.", "En cas d'action judiciaire, contactez un avocat ou une aide juridique."],
      },
    ),
    eviction: block(
      {
        en: `${who || "The landlord"} demands ${amountStr ?? "unpaid rent"} for months of unpaid rent and warns of an eviction claim under LAU art. 27.2.a). In a first eviction claim, paying ALL arrears within 10 business days of the claim's notification can stop the eviction (enervación, LEC art. 22.2).`,
        hi: `${who || "मकान मालिक"} बकाया किराया ${amountStr ?? "बकाया राशि"} मांगता है और LAU कलम 27.2.a) के तहत बेदखली कार्रवाई की चेतावनी देता है। पहली बेदखली कार्रवाई में, मुकदमे की अधिसूचना के 10 कार्य-दिवसों के भीतर पूरा बकाया चुकाने से बेदखली रुक सकती है (enervación, LEC कलम 22.2)।`,
        zh: `${who || "房东"}要求支付${amountStr ?? "欠付租金"}并警告将依 LAU 第27.2.a)条提起驱逐诉讼。在首次驱逐诉讼中，于诉讼送达后10个工作日内付清全部欠款可阻止驱逐（enervación，LEC 第22.2条）。`,
        fr: `${who || "Le bailleur"} réclame ${amountStr ?? "des loyers impayés"} et menace d'une demande d'expulsion (LAU art. 27.2.a). En cas de première demande, payer TOUTES les sommes dues sous 10 jours ouvrables dès la notification peut arrêter l'expulsion (enervación, LEC art. 22.2).`,
      },
      {
        en: "Your home is at risk: an eviction claim can end in a court-ordered move-out plus rent, interest and costs.",
        hi: "आपका घर जोखिम में है: बेदखली कार्रवाई के नतीजे में अदालती आदेश से घर खाली कराना और किराया, ब्याज व व्यय देना पड़ सकता है।",
        zh: "住房面临风险：驱逐诉讼可能导致法院判决腾退，并需支付租金、利息与费用。",
        fr: "Votre logement est en jeu : une expulsion judiciaire peut être prononcée, avec loyers, intérêts et frais.",
      },
      {
        en: ["Check whether an eviction lawsuit has actually been served — the enervación window starts only at notification.", "Match the claimed unpaid months to your rent receipts and contract.", "Plan how to pay all arrears within the statutory window.", "Consult a lawyer quickly — deadlines here are short."],
        hi: ["जांचें कि बेदखली मुकदमा वास्तव में सौंपा गया या नहीं — enervación अवधि केवल अधिसूचना से शुरू होती है।", "दावे वाले महीने अपनी रसीदों व अनुबंध से मिलाएँ।", "वैधानिक अवधि में पूरा बकाया चुकाने की योजना बनाएँ।", "समा-सीमाएँ छोटी हैं — जल्दी वकील से सलाह लें।"],
        zh: ["核实驱逐诉讼是否实际已送达——enervación 期限自送达起算。", "将主张的未付月份与租金凭证及合同核对。", "规划在法定期限内付清全部欠款。", "期限较短——请尽快咨询律师。"],
        fr: ["Vérifiez si une demande d'expulsion a réellement été notifiée — le délai d'enervación ne court qu'à la notification.", "Rapprochez les mois réclamés de vos quittances et du bail.", "Planifiez le paiement de toutes les sommes dues dans le délai légal.", "Les délais sont courts — consultez rapidement un avocat."],
      },
    ),
  };
  const generic = block(
    {
      en: `This appears to be a formal legal notice from ${who || "a sender"} in ${jurisdiction}. It makes demands that may carry deadlines, so treat the dates in the text as important and respond through an appropriate written channel.`,
      hi: `यह ${who || "एक प्रेषक"} की ओर से ${jurisdiction} का औपचारिक कानूनी नोटिस प्रतीत होता है। इसमें ऐसी मांगें हो सकती हैं जिनकी समा-सीमाएँ हों — अतः पाठ में दी तिथियों को महत्व दें और उचित लिखित माध्यम से जवाब दें।`,
      zh: `这似乎是来自${who || "某发送方"}（${jurisdiction}）的正式法律通知。其中可能包含带期限的要求，请务必重视文中的日期，并通过适当的书面渠道答复。`,
      fr: `Il s'agit vraisemblablement d'un constat juridique formel de ${who || "un expéditeur"} (${jurisdiction}). Il peut contenir des demandes assorties de délais — traitez les dates comme importantes et répondez par écrit.`,
    },
    {
      en: "Formal legal notices can carry deadlines whose breach has legal consequences.",
      hi: "औपचारिक कानूनी नोटिस में ऐसी समा-सीमाएँ हो सकती हैं जिनकी अवहेलना के कानूनी परिणाम हो सकते हैं।",
      zh: "正式法律通知可能载有期限，逾期会产生法律后果。",
      fr: "Un constat formel peut contenir des délais dont le dépassement a des conséquences juridiques.",
    },
    {
      en: ["Note every date and deadline stated in the notice.", "Gather documents related to the matter.", "Respond in writing within the stated period.", "Seek legal advice on your specific situation."],
      hi: ["नोटिस में दी हर तिथि व समा-सीमा नोट करें।", "मामले से जुड़े दस्तावेज़ इकट्ठा करें।", "बताई गई अवधि में लिखित जवाब दें।", "अपनी स्थिति पर कानूनी सलाह लें।"],
      zh: ["记录通知中的每个日期与期限。", "收集与事项相关的文件。", "在载明期限内书面答复。", "就您的具体情况寻求法律意见。"],
      fr: ["Notez chaque date et délai du constat.", "Rassemblez les documents liés au dossier.", "Répondez par écrit dans le délai indiqué.", "Consultez un professionnel sur votre situation."],
    },
  );
  const chosen = blocks[type] ?? generic;
  return chosen;
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
      : amount.currency === "EUR"
        ? `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(amount.amount)} €`
        : `$${new Intl.NumberFormat("en-US").format(amount.amount)}`
    : null;

  const facts: ExtractedFact[] = [];
  // notice date from header
  const headerDate = t.match(/^date\s*:\s*(.+)$/im);
  if (headerDate) {
    const iso = parseHumanDate(headerDate[1]);
    if (iso) facts.push({ key: "notice_date", value: iso, kind: "date", iso, num: null, currency: null, confidence: 0.85, source_ref: "header" });
  }
  if (amount) {
    facts.push({ key: "amount", value: amountStr ?? String(amount.amount), kind: "money", iso: null, num: amount.amount, currency: amount.currency, confidence: 0.88, source_ref: "subject line" });
  }
  const cheque = t.match(/cheque(?:\s+bearing)?\s+no\.?\s*[:#]?\s*(\d{4,})/i);
  if (cheque) facts.push({ key: "cheque_number", value: cheque[1], kind: "text", iso: null, num: null, currency: null, confidence: 0.85, source_ref: refFor(t, cheque.index ?? 0) });
  const bank = t.match(/drawn on\s+([A-Z][A-Za-z .&]+?(?:Bank|Banca)[A-Za-z .]*)/i);
  if (bank) facts.push({ key: "bank_name", value: bank[1].trim(), kind: "text", iso: null, num: null, currency: null, confidence: 0.8, source_ref: refFor(t, bank.index ?? 0) });
  const present = t.match(/present(?:ment|ed)?[^.\n]{0,40}?(?:on|dated)\s+([0-9]{1,2}\s+\w+\s+\d{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i);
  if (present) {
    const iso = parseHumanDate(present[1]);
    if (iso) facts.push({ key: "presentation_date", value: iso, kind: "date", iso, num: null, currency: null, confidence: 0.8, source_ref: refFor(t, present.index ?? 0) });
  }
  const dishonour = t.match(/dishonour(?:ed)?[^.\n]{0,80}?dated\s+([0-9]{1,2}\s+\w+\s+\d{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i);
  if (dishonour) {
    const iso = parseHumanDate(dishonour[1]);
    if (iso) facts.push({ key: "dishonour_date", value: iso, kind: "date", iso, num: null, currency: null, confidence: 0.82, source_ref: refFor(t, dishonour.index ?? 0) });
  }
  const invoice = t.match(/invoice\s*(?:no\.?|number)?\s*[:#]?\s*([A-Z0-9][A-Z0-9/-]{3,})/i);
  if (invoice) facts.push({ key: "invoice_number", value: invoice[1], kind: "text", iso: null, num: null, currency: null, confidence: 0.8, source_ref: refFor(t, invoice.index ?? 0) });
  const origCred = t.match(/original creditor\s*:\s*([^\n]+)/i);
  if (origCred) facts.push({ key: "original_creditor", value: origCred[1].split(/—|--/)[0].trim(), kind: "text", iso: null, num: null, currency: null, confidence: 0.85, source_ref: refFor(t, origCred.index ?? 0) });
  const account = t.match(/account\s*(?:no\.?|number|ending)\s*[:#]?\s*(\d{4,}[0-9xX*]*)/i);
  if (account) facts.push({ key: "account_number", value: account[1], kind: "text", iso: null, num: null, currency: null, confidence: 0.8, source_ref: refFor(t, account.index ?? 0) });

  // stated deadline
  const period = parsePeriod(t);
  const stated: StatedDeadline[] = period
    ? [{ description: "Response period as stated in the notice text", period_days: period.days, anchor: period.anchor, explicit_date: null, source_ref: null }]
    : [];

  // jurisdiction
  let country = "IN";
  let region = "";
  if (/\$|USD|Brooklyn|New York|FDCPA/i.test(t)) { country = "US"; region = /New York|Brooklyn|Kings County/i.test(t) ? "New York" : "Federal"; }
  else if (/€|Madrid|España|LAU|desahuci|Notari/i.test(t)) { country = "ES"; region = /Madrid/i.test(t) ? "Madrid" : ""; }
  else if (/Mumbai|Maharashtra|§?\s*138|cheque/i.test(t)) { country = "IN"; region = /Mumbai|Maharashtra/i.test(t) ? "Maharashtra" : ""; }

  const sender = findSender(t, type);
  const citations: { source_id: string; relevance: string }[] = [];
  if (type === "cheque_bounce" || /§?\s*138|negotiable/i.test(t)) citations.push({ source_id: "in_ni_138", relevance: "Dishonour of a cheque triggers the 15-day payment window before a §138/§142 complaint." });
  if (type === "debt_collection" || /debt collector|fdcpa/i.test(t)) citations.push({ source_id: "fdcpa_1692g", relevance: "Validation notice: 30-day written dispute and verification rights." });
  if (type === "eviction") {
    citations.push({ source_id: "es_lau_27", relevance: "Non-payment empowers the landlord to resolve the lease and seek eviction." });
    citations.push({ source_id: "es_lec_22", relevance: "Enervación: paying all arrears within 10 business days of notification stops a first eviction claim." });
  }
  if (type === "consumer") citations.push({ source_id: "in_cpa_s35", relevance: "District Commission complaint route and two-year limitation." });
  if (type === "court_summons") citations.push({ source_id: "in_cpc_o9r6", relevance: "Non-appearance can lead to ex-parte proceedings." });
  if (/default judgment|wage garnishment/i.test(t)) citations.push({ source_id: "ny_cplr_320", relevance: "Default judgment for the demanded amount can be enforced by garnishment." });

  const jurisdiction_label = country === "IN" ? "India" : country === "US" ? "United States" : country === "ES" ? "Spain" : country;
  const localized = localizedFor(type, sender.name, amountStr, jurisdiction_label);

  // per-type severity (deterministic rubric mirrors the LLM one)
  const severity = type === "cheque_bounce" || type === "eviction" ? "red" : type === "debt_collection" ? "yellow" : "yellow";

  return {
    notice_type: type,
    jurisdiction: { country, region, confidence: 0.6 },
    language_detected: lang,
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
    severity: { level: severity, confidence: 0.7 },
    overall_confidence: type === "other" ? 0.55 : 0.68,
  };
}
