// LexLens — preloaded demo notices. FICTIONAL documents written to mirror
// real-world formats (no real personal data).
//
// PRD §7/§31: the India cheque notice uses the EXACT fixed test dates so the
// regression test can assert canonical facts + the calculated deadline
// (receipt 19 Sep 2026 + 15 days → 4 Oct 2026).
// PRD §32: the US notice is a New York debt-collection validation letter.
// PRD §33: the Hindi notice carries the same India facts in Hindi so the
// language regression can assert language-neutral legal facts.

export interface SampleNotice {
  id: string;
  title: string;
  jurisdiction_label: string;
  stat_hint: string;
  words: number;
  text: string;
}

/** Human date like "September 13, 2026" (en-US) offset from today. */
function dUS(offsetDays: number): string {
  const t = new Date();
  t.setDate(t.getDate() + offsetDays);
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(`${t.toISOString().slice(0, 10)}T00:00:00Z`)
  );
}

/** PRD §7 — India test notice (FIXED dates, receipt date stated). */
const INDIA_CHEQUE_TEST = `BY REGISTERED POST A.D. / SPEED POST
Ref. No.: SV/CL/2026-114

Date: 18 September 2026

To,
Mr. Rohan Mehta,
A-704, Sunrise Residency, Powai,
Mumbai – 400076.

SUB: LEGAL NOTICE UNDER SECTION 138 OF THE NEGOTIABLE INSTRUMENTS ACT, 1881 — DEMAND OF PAYMENT OF Rs. 85,000/- (RUPEES EIGHTY FIVE THOUSAND ONLY)

Under instructions from and on behalf of my client, M/s Sharma Traders Pvt. Ltd., having its registered office at 2nd Floor, Kanakia Spaces, Andheri East, Mumbai – 400093, I hereby serve upon you the following legal notice:

1. That my client states that you had business dealings with my client and, towards payment for goods supplied vide Invoice No. ST/26-27/0458, you issued a cheque bearing Cheque No. 458721 dated 5 September 2026 for Rs. 85,000/- drawn on State Bank of India, Powai Branch, in favour of my client.

2. That the said cheque, on presentment before the drawee bank, was returned dishonoured vide Return Memo dated 10 September 2026 with the remarks "FUNDS INSUFFICIENT".

3. That despite repeated verbal demands and written reminders, you have failed and neglected to pay the said amount.

I, therefore, call upon you to pay the said sum of Rs. 85,000/- (Rupees Eighty Five Thousand Only) together with interest at 18% per annum within FIFTEEN (15) DAYS from the receipt of this notice, failing which my client shall be constrained to initiate criminal proceedings against you under Section 138 read with Section 142 of the Negotiable Instruments Act, 1881 before the learned Magistrate Court at Mumbai, wherein you shall be liable to be punished with imprisonment which may extend to two years, or with fine which may extend to twice the amount of the cheque, or with both, besides costs.

This notice was received under acknowledgment on 19 September 2026.

A copy of this notice is retained in my office for record and further necessary action.

(Amit V. Shenoy)
Advocate — Enrolment No. MAH/14526/2011
Shenoy & Associates, Advocates, Mumbai`;

/** PRD §33 — the same India §138 facts in Hindi (language-neutral legal facts). */
const INDIA_CHEQUE_HINDI = `राजपत्रित डाक ए.डी. / स्पीड पोस्ट द्वारा
संदर्भ संख्या: एसवी/सीएल/2026-114

दिनांक: 18 सितंबर 2026

सेवा में,
श्री रोहन मेहता,
ए-704, सनराइज़ रेज़ीडेंसी, पोवई,
मुंबई – 400076।

विषय: परिवहनीय उपकरण अधिनियम, 1881 की धारा 138 के अंतर्गत कानूनी नोटिस — रु. 85,000/- (पैंतालीस हज़ार रुपये) के भुगतान की मांग

अपने ग्राहक, एम/एस शर्मा ट्रेडर्स प्रा. लि., के निर्देश पर मैं आपको निम्नलिखित कानूनी नोटिस सौंपता हूँ:

1. मेरे ग्राहक का कहना है कि आपके और ग्राहक के बीच व्यापारिक लेन-देन था और माल के भुगतान हेतु आपने चेक संख्या 458721, दिनांक 5 सितंबर 2026, रु. 85,000/- की राशि का, स्टेट बैंक ऑफ़ इंडिया, पोवई शाखा पर आहरित, मेरे ग्राहक के पक्ष में जारी किया था।

2. उक्त चेक बैंक में प्रस्तुत करने पर दिनांक 10 सितंबर 2026 के रिटर्न मेमो द्वारा "पर्याप्त धनराशि नहीं" (FUNDS INSUFFICIENT) के कारण अनादरित हुआ।

3. बार-बार के मौखिक व लिखित अनुरोध के बावजूद आपने राशि का भुगतान नहीं किया।

अतः मैं आपको नोटिस प्राप्ति से पंद्रह (15) दिनों के भीतर रु. 85,000/- (ब्याज सहित 18% वार्षिक) का भुगतान करने का अवसर देता हूँ, अन्यथा ग्राहक धारा 138 सपठित धारा 142 के अंतर्गत मुंबई के न्यायालय में आपराधिक कार्यवाही करने को बाध्य होगा, जिसमें दो वर्ष तक की कैद, चेक राशि के दोगुने तक का जुर्माना, या दोनों हो सकते हैं।

यह नोटिस पावती पर 19 सितंबर 2026 को प्राप्त हुआ।

(अमित वी. शेनोय)
अधिवक्ता — नामांकन संख्या महा/14526/2011
शेनोय एंड एसोसिएट्स, अधिवक्ता, मुंबई`;

/** PRD §32 — US debt-collection validation notice, New York (dynamic dates). */
const US_DEBT_NY = `ALLIED RECOVERY SYSTEMS LLC
PO Box 4192, Buffalo, NY 14213
(800) 555-0142 | alliedrecovery.example

Date: ${dUS(-4)}

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

If the debt is not resolved within forty-five (45) days, this office has been authorized to refer the matter to the Civil Court of Kings County, New York, where a money judgment may be entered against you, which may include wage garnishment.

You may settle today for 70% of the balance: $1,638.38. Payments accepted online or by phone.

Sincerely,
R. Donovan
Compliance Manager, Allied Recovery Systems LLC

This communication is from a debt collector.`;

export const SAMPLES: SampleNotice[] = [
  {
    id: "in-cheque",
    title: "Cheque bounce legal notice (§138)",
    jurisdiction_label: "India · Maharashtra",
    stat_hint: "Negotiable Instruments Act, 1881 · §138",
    words: 330,
    text: INDIA_CHEQUE_TEST,
  },
  {
    id: "in-cheque-hi",
    title: "चेक अनादरण कानूनी नोटिस (§138)",
    jurisdiction_label: "भारत · महाराष्ट्र",
    stat_hint: "परिवहनीय उपकरण अधिनियम, 1881 · धारा 138",
    words: 300,
    text: INDIA_CHEQUE_HINDI,
  },
  {
    id: "us-debt",
    title: "Debt collection letter (New York)",
    jurisdiction_label: "United States · New York",
    stat_hint: "FDCPA · 15 U.S.C. §1692g",
    words: 280,
    text: US_DEBT_NY,
  },
];
