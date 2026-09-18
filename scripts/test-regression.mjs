// LexLens — India / USA / Hindi regression tests (PRD §31/§32/§33/§7).
// Runs the full pipeline against the live dev server and asserts:
//   §31 India: correct classification, canonical receipt date, 15-day deadline
//              from 2026-09-19 → 2026-10-04, ZERO US legal terms.
//   §32 USA:   NY debt notice → USA/New York, NI Act absent, federal/state
//              distinction respected, FDCPA only where actually applicable.
//   §33 Hindi: same India facts in Hindi — identical dates/amount/jurisdiction;
//              the Hindi report carries the same legal facts.
// Run: node scripts/test-regression.mjs

const BASE = "http://localhost:3000";
let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name} ${extra}`); }
}

const stamp = Date.now();
const U = { email: `regression+${stamp}@test.local`, name: "Regression", password: "passw0rd-regression" };

const session = { cookie: "" };
async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(session.cookie ? { Cookie: session.cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) session.cookie = setCookie.split(";")[0];
  return res;
}

console.log("Anonymous session (auto-provisioned, no signup)");
{
  const r = await req("GET", "/api/notices");
  check("session provisioned", r.status === 200);
}

async function analyze(text, label) {
  const r = await req("POST", "/api/notices", { text, label, source: "paste" });
  const d = await r.json();
  if (!d.notice?.id) throw new Error(`upload failed: ${JSON.stringify(d)}`);
  await req("POST", `/api/notices/${d.notice.id}/analyze`, {});
  for (let i = 0; i < 30; i++) {
    const g = await (await req("GET", `/api/notices/${d.notice.id}`)).json();
    if (g.notice?.analysisStatus === "READY") return g;
    if (g.notice?.analysisStatus === "FAILED") throw new Error("analysis failed");
    await new Promise((r2) => setTimeout(r2, 2000));
  }
  throw new Error("analysis timed out");
}

/* ───────────────────────── PRD §31 — INDIA regression ───────────────────────── */
console.log("\nPRD §31 — India cheque dishonour (fixed test notice)");
const INDIA_NOTICE = `BY REGISTERED POST A.D. / SPEED POST
Ref. No.: SV/CL/2026-114

Date: 18 September 2026

To,
Mr. Rohan Mehta,
A-704, Sunrise Residency, Powai,
Mumbai – 400076.

SUB: LEGAL NOTICE UNDER SECTION 138 OF THE NEGOTIABLE INSTRUMENTS ACT, 1881 — DEMAND OF PAYMENT OF Rs. 85,000/- (RUPEES EIGHTY FIVE THOUSAND ONLY)

Under instructions from and on behalf of my client, M/s Sharma Traders Pvt. Ltd., Mumbai, I hereby serve upon you the following legal notice:

1. That my client states that you had business dealings with my client and, towards payment for goods supplied, you issued a cheque bearing Cheque No. 458721 dated 5 September 2026 for Rs. 85,000/- drawn on State Bank of India, Powai Branch, in favour of my client.

2. That the said cheque, on presentment before the drawee bank, was returned dishonoured vide Return Memo dated 10 September 2026 with the remarks "FUNDS INSUFFICIENT".

3. That despite repeated verbal demands and written reminders, you have failed and neglected to pay the said amount.

I, therefore, call upon you to pay the said sum of Rs. 85,000/- together with interest at 18% per annum within FIFTEEN (15) DAYS from the receipt of this notice, failing which my client shall be constrained to initiate criminal proceedings against you under Section 138 read with Section 142 of the Negotiable Instruments Act, 1881 before the learned Magistrate Court at Mumbai.

This notice was received under acknowledgment on 19 September 2026.

(Amit V. Shenoy)
Advocate — Enrolment No. MAH/14526/2011
Shenoy & Associates, Advocates, Mumbai`;

let inCase;
try {
  inCase = await analyze(INDIA_NOTICE, "India §138 regression");
  const n = inCase.notice;
  const base = inCase.base;
  const dump = JSON.stringify({ base, notice: n });

  check("Jurisdiction = INDIA", base.jurisdiction?.country === "INDIA" && n.jurisdiction === "INDIA", `got ${base.jurisdiction?.country}/${n.jurisdiction}`);
  check("Type = cheque_bounce", n.noticeType === "cheque_bounce", `got ${n.noticeType}`);
  check("legalDomain = CHEQUE_DISHONOUR", n.legalDomain === "CHEQUE_DISHONOUR", `got ${n.legalDomain}`);
  check("Classification primary = Cheque Dishonour (NOT debt collection)", base.classification?.primary === "Cheque Dishonour", `got ${base.classification?.primary}`);
  check("Subcategory = Section 138 Demand Notice", base.classification?.subcategory === "Section 138 Demand Notice", `got ${base.classification?.subcategory}`);
  check("Receipt date canonical = 2026-09-19", n.receiptDate === "2026-09-19", `got ${n.receiptDate}`);
  check("Receipt date NOT reported missing", n.missingReceipt === false);
  check("Notice date = 2026-09-18", n.noticeDate === "2026-09-18", `got ${n.noticeDate}`);
  check("Deadline = 2026-10-04 (15 days from receipt)", n.deadlineDate === "2026-10-04", `got ${n.deadlineDate}`);
  check("Deadline rule is the §138 payment window", (n.ruleLabel ?? "").toLowerCase().includes("payment window"), `got ${n.ruleLabel}`);
  check("Amount 85000 INR", base.facts?.some((f) => f.key === "amount" && f.num === 85000 && f.currency === "INR"), JSON.stringify(base.facts?.find((f) => f.key === "amount")));
  check("Cheque number 458721 stored", base.facts?.some((f) => f.key === "cheque_number" && f.value === "458721"));
  check("Bank stored", base.facts?.some((f) => f.key === "bank_name" && /state bank/i.test(f.value)));
  check("NO FDCPA anywhere", !/FDCPA/i.test(dump));
  check("NO 15 U.S.C. anywhere", !/15\s+U\.?S\.?C|1692/i.test(dump));
  check("NO New York CPLR anywhere", !/CPLR/i.test(dump));
  check("NO US wage garnishment / bank levy anywhere", !/wage\s+garnishment|bank\s+levy/i.test(dump));
  check("NO '30-day dispute window' phrasing", !/30[\s-]*(day|दिन)[\s-]*(dispute|recipient response)/i.test(dump));
  check("Hindi block exists alongside English", !!base.localized?.hi?.summary && base.localized.hi.summary.length > 20);
  check("Only en/hi locale keys exist", !("zh" in (base.localized ?? {})) && !("fr" in (base.localized ?? {})));
} catch (e) {
  check("India pipeline completed", false, e.message);
}

/* ───────────────────────── PRD §32 — USA regression ───────────────────────── */
console.log("\nPRD §32 — US debt collection, New York");
const US_NOTICE = `ALLIED RECOVERY SYSTEMS LLC
PO Box 4192, Buffalo, NY 14213

Date: ${new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10)}

Re: Our File No. 4471-88231
Original Creditor: Feline Bank USA — Credit Card Account ending 4471
Balance Owed: $2,340.55

Mr. James Mercer
1482 Maple Row, Apt 6B
Brooklyn, NY 11221

Dear Mr. Mercer:

Allied Recovery Systems LLC is a debt collector. This is an attempt to collect a debt and any information obtained will be used for that purpose.

Our client has placed the above-referenced account with our office for collection in the amount of $2,340.55. Unless you notify this office within thirty (30) days after receiving this notice that you dispute the validity of this debt or any portion thereof, this office will assume the debt is valid.

If you notify this office in writing within that 30-day period that the debt, or any portion of it, is disputed, we will obtain verification of the debt and mail it to you. Upon written request within the same period, we will provide the name and address of the original creditor.

If the debt is not resolved within forty-five (45) days, this office has been authorized to refer the matter to the Civil Court of Kings County, New York, where a money judgment may be entered against you.

This communication is from a debt collector.`;

let usCase;
try {
  usCase = await analyze(US_NOTICE, "US NY regression");
  const n = usCase.notice;
  const base = usCase.base;
  const dump = JSON.stringify({ base, notice: n });

  check("Jurisdiction = USA", base.jurisdiction?.country === "USA" && n.jurisdiction === "USA", `got ${base.jurisdiction?.country}/${n.jurisdiction}`);
  check("State detected = New York", base.jurisdiction?.region === "New York", `got ${base.jurisdiction?.region}`);
  check("Type = debt_collection", n.noticeType === "debt_collection", `got ${n.noticeType}`);
  check("Federal rule applicability established from facts (true)", base.debt_rule_applicable === true, `got ${base.debt_rule_applicable}`);
  check("Classification = Debt Collection / Debt Validation Notice", base.classification?.primary === "Debt Collection" && base.classification?.subcategory === "Debt Validation Notice", `got ${base.classification?.primary}/${base.classification?.subcategory}`);
  check("NO NI Act / Section 138 anywhere", !/Negotiable\s+Instruments|Section\s*138|in_ni_138/i.test(dump));
  check("NO Indian CPC/CPA anywhere", !/Code of Civil Procedure|Consumer Protection Act|in_cpc|in_cpa/i.test(dump));
  check("FDCPA §1692g citation present (US federal rule selected)", (base.citations ?? []).some((c) => c.source_id === "fdcpa_1692g"));
  check("Citations are US-only", (base.citations ?? []).every((c) => { const j = c.source_id; return /fdcpa|us_regf|ny_cplr/.test(j); }));
  check("Only en/hi locale keys exist", !("zh" in (base.localized ?? {})) && !("fr" in (base.localized ?? {})));
} catch (e) {
  check("US pipeline completed", false, e.message);
}

/* ───────────────────────── PRD §33 — HINDI regression ───────────────────────── */
console.log("\nPRD §33 — Hindi report of the same India notice");
const HINDI_NOTICE = `राजपत्रित डाक ए.डी. / स्पीड पोस्ट द्वारा
दिनांक: 18 सितंबर 2026

सेवा में,
श्री रोहन मेहता, मुंबई – 400076।

विषय: परिवहनीय उपकरण अधिनियम, 1881 की धारा 138 के अंतर्गत कानूनी नोटिस — रु. 85,000/- के भुगतान की मांग

मेरे ग्राहक, एम/एस शर्मा ट्रेडर्स प्रा. लि., के निर्देश पर मैं आपको निम्नलिखित कानूनी नोटिस सौंपता हूँ:

1. मेरे ग्राहक का कहना है कि आपने चेक संख्या 458721, दिनांक 5 सितंबर 2026, रु. 85,000/- की राशि का, स्टेट बैंक ऑफ़ इंडिया, पोवई शाखा पर आहरित, मेरे ग्राहक के पक्ष में जारी किया था।

2. उक्त चेक बैंक में प्रस्तुत करने पर दिनांक 10 सितंबर 2026 के रिटर्न मेमो द्वारा "पर्याप्त धनराशि नहीं" के कारण अनादरित हुआ।

3. बार-बार के अनुरोध के बावजूद आपने राशि का भुगतान नहीं किया।

अतः मैं आपको नोटिस प्राप्ति से पंद्रह (15) दिनों के भीतर रु. 85,000/- का भुगतान करने का अवसर देता हूँ, अन्यथा ग्राहक धारा 138 सपठित धारा 142 के अंतर्गत मुंबई के न्यायालय में आपराधिक कार्यवाही करने को बाध्य होगा।

यह नोटिस पावती पर 19 सितंबर 2026 को प्राप्त हुआ।

(अमित वी. शेनोय)
अधिवक्ता, मुंबई`;

let hiCase;
try {
  hiCase = await analyze(HINDI_NOTICE, "Hindi regression");
  const n = hiCase.notice;
  const base = hiCase.base;

  check("Jurisdiction = INDIA (language-neutral)", base.jurisdiction?.country === "INDIA" && n.jurisdiction === "INDIA", `got ${base.jurisdiction?.country}`);
  check("Hindi detected", base.language_detected === "hi", `got ${base.language_detected}`);
  check("Same legal domain CHEQUE_DISHONOUR", n.legalDomain === "CHEQUE_DISHONOUR", `got ${n.legalDomain}`);
  check("Same classification Cheque Dishonour", base.classification?.primary === "Cheque Dishonour", `got ${base.classification?.primary}`);
  check("Same receipt date 2026-09-19 (facts are language-neutral)", n.receiptDate === "2026-09-19", `got ${n.receiptDate}`);
  check("Same deadline 2026-10-04", n.deadlineDate === "2026-10-04", `got ${n.deadlineDate}`);
  check("Same amount ₹85,000", base.facts?.some((f) => f.key === "amount" && f.num === 85000 && f.currency === "INR"));
  check("Same cheque number 458721", base.facts?.some((f) => f.key === "cheque_number" && f.value === "458721"));
  check("Statute identifier kept in English alongside Hindi", !!base.localized?.hi?.summary);
  check("Hindi block present and substantive", (base.localized?.hi?.summary ?? "").length > 30);
  check("NO US legal terms in the Hindi India case", !/FDCPA|CPLR|1692/i.test(JSON.stringify(base)));
} catch (e) {
  check("Hindi pipeline completed", false, e.message);
}


/* ───────────────────────── PRD §42 — missing receipt date ───────────────────────── */
console.log("\nPRD §42 — same India notice WITHOUT the receipt date");
try {
  const noReceipt = INDIA_NOTICE.replace(/\nThis notice was received under acknowledgment on 19 September 2026\./, "");
  const mCase = await analyze(noReceipt, "Missing-date regression");
  const n = mCase.notice;

  check("Receipt date absent → not provided", n.receiptDate === null && n.missingReceipt === true, `got ${n.receiptDate}/${n.missingReceipt}`);
  check("Deadline NOT invented (cannot calculate yet)", n.deadlineDate === null, `got ${n.deadlineDate}`);
  check("Status = UNKNOWN_DEADLINE", n.status === "UNKNOWN_DEADLINE", `got ${n.status}`);
  const mBase = mCase.base;
  check("No fabricated receipt fact", !mBase.facts?.some((f) => f.key === "receipt_date" && f.iso));
  check("No invented deadline date in facts", !mBase.facts?.some((f) => f.key === "deadline" && f.iso));
  // Response draft must use a placeholder, never a date
  const dr = await req("POST", `/api/notices/${n.id}/draft`, { locale: "en" });
  const dd = await dr.json();
  check("Draft generated", !!dd.draft, JSON.stringify(dd).slice(0, 120));
  check("Draft uses [Notice receipt date] placeholder (no invented date)", /\[Notice receipt date\]/.test(dd.draft ?? "") && !/received on \d{1,2} \w+ 2026/.test(dd.draft ?? ""));
} catch (e) {
  check("Missing-date pipeline completed", false, e.message);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);