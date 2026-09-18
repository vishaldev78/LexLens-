// E2E API test: POST the US debt sample text to /api/analyze and verify
// the 4-language structured output (EN/HI/ZH/FR) + safety pipeline.
const TEXT = `ALLIED RECOVERY SYSTEMS LLC
PO Box 4192, Buffalo, NY 14213
Date: September 13, 2026
Re: Our File No. 4471-88231
Original Creditor: Feline Bank USA — Credit Card Account ending 4471
Balance Owed: $2,340.55

Dear Mr. Mercer:

Allied Recovery Systems LLC is a debt collector. This is an attempt to collect a debt and any information obtained will be used for that purpose.

Unless you notify this office within thirty (30) days after receiving this notice that you dispute the validity of this debt or any portion thereof, this office will assume the debt is valid. If you notify this office in writing within that 30-day period that the debt is disputed, we will obtain verification and mail it to you.

If the debt is not resolved within forty-five (45) days, this office has been authorized to refer the matter to the Civil Court of Kings County, New York, where a money judgment may be entered against you, which may include wage garnishment.

This communication is from a debt collector.`;

const t0 = Date.now();
const res = await fetch("http://localhost:3000/api/analyze", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text: TEXT }),
});
console.log(`HTTP ${res.status} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
const r = await res.json();
if (!r.analysis) {
  console.error("NO ANALYSIS:", JSON.stringify(r).slice(0, 500));
  process.exit(1);
}
const a = r.analysis;
console.log("model:", r.pipeline_meta.model, "| fallback:", r.pipeline_meta.fallback, "| ms:", r.processing_ms);
console.log("type:", a.notice_type, "| severity:", a.severity.level, "| conf:", a.overall_confidence, "| lang:", a.language_detected);
console.log("jurisdiction:", a.jurisdiction.country, "/", a.jurisdiction.region, "| citations:", a.citations.map((c) => c.source_id).join(", "));
console.log("deadlines:", a.deadlines.map((d) => `${d.days_from_today}d`).join(", "));
for (const loc of ["en", "hi", "zh", "fr"]) {
  const b = a.localized[loc];
  const ok = b.summary.length > 40 && b.key_risk.length > 10 && b.next_steps.length >= 3 && b.rights.length >= 2;
  console.log(`${ok ? "✓" : "✗"} ${loc}: summary=${b.summary.length}ch risk=${b.key_risk.length}ch steps=${b.next_steps.length} rights=${b.rights.length}`);
  console.log(`   ${b.summary.slice(0, 110).replace(/\n/g, " ")}`);
}
let fail = 0;
for (const loc of ["en", "hi", "zh", "fr"]) {
  const b = a.localized[loc];
  if (!(b.summary.length > 40 && b.next_steps.length >= 3)) fail++;
}
console.log(fail === 0 ? "\nALL 4 LANGUAGES OK" : `\n${fail} LANGUAGE BLOCKS INCOMPLETE`);
process.exit(fail === 0 ? 0 : 1);
