// Quick severity-rubric verification: §138 cheque bounce must come back RED.
const TEXT = `BY REGISTERED A.D. / SPEED POST
Ref. No.: SV/CL/2025-114
Date: 14 September 2026

To, Mr. Rohan Mehta, A-704, Sunrise Residency, Powai, Mumbai 400076.

SUB: LEGAL NOTICE UNDER SECTION 138 OF THE NEGOTIABLE INSTRUMENTS ACT, 1881 — DEMAND OF PAYMENT OF Rs. 4,50,000/-

Under instructions from and on behalf of my client, M/s Sharma Traders Pvt. Ltd., Mumbai, I hereby serve upon you the following legal notice:

1. That you issued a cheque bearing Cheque No. 004512 dated 10 August 2026 for Rs. 4,50,000/- drawn on HDFC Bank Ltd., Powai Branch, in favour of my client.

2. That the said cheque, on presentment before the drawee bank, was returned dishonoured with the remarks "FUNDS INSUFFICIENT".

I, therefore, call upon you to pay the said sum of Rs. 4,50,000/- together with interest at 18% per annum within FIFTEEN (15) DAYS from the receipt of this notice, failing which my client shall be constrained to initiate criminal proceedings against you under Section 138 read with Section 142 of the Negotiable Instruments Act, 1881 before the learned Magistrate Court at Mumbai.

(Amit V. Shenoy)
Advocate — Shenoy & Associates, Advocates, Mumbai`;

const res = await fetch("http://localhost:3000/api/analyze", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text: TEXT }),
});
const r = await res.json();
const a = r.analysis;
console.log(`HTTP ${res.status} | model=${r.pipeline_meta.model} | ${((Date.now() - 0) / 1000).toFixed(0)}s budget check: ms=${r.processing_ms}`);
console.log(`type=${a.notice_type} severity=${a.severity.level} conf=${a.overall_confidence}`);
console.log(`citations=${a.citations.map((c) => c.source_id).join(",")}`);
// zh is compact: 3 full sentences ≈ 60–120 chars; use 25 as its floor.
const all4 =
  a.localized.en.summary.length > 40 &&
  a.localized.hi.summary.length > 40 &&
  a.localized.zh.summary.length > 25 &&
  a.localized.fr.summary.length > 40;
console.log(`4-language blocks: ${all4 ? "OK" : "INCOMPLETE"}`);
const ok = a.notice_type === "cheque_bounce" && a.severity.level === "red" && all4;
console.log(ok ? "RUBRIC CHECK PASSED (red, §138, 4 languages)" : "RUBRIC CHECK FAILED");
process.exit(ok ? 0 : 1);
