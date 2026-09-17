// Test the offline fallback analyzer against all 3 sample notices + generic text.
import { offlineAnalyze } from "../src/lib/lexlens/fallback-analyzer";
import { SAMPLES } from "../src/lib/lexlens/samples";

const generic = `To Whom It May Concern: This letter is to inform you that your membership account #88123 remains unpaid in the amount of $312.00. Please remit payment within 14 days of the date of this letter to avoid further collection activity, as permitted by applicable regulations.`;

let pass = 0;
let fail = 0;

function check(name: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.error(`  ✗ ${name}`);
  }
}

const LOCALES = ["en", "hi", "zh", "fr"] as const;

for (const s of SAMPLES) {
  console.log(`\n=== ${s.id} ===`);
  const a = offlineAnalyze(s.text);
  console.log(`  type=${a.notice_type} severity=${a.severity.level} lang=${a.language_detected} conf=${a.overall_confidence}`);
  console.log(`  sender=${a.sender.name} (${a.sender.type}) | demands=${a.demands.length} deadlines=${a.deadlines.length} citations=${a.citations.map((c) => c.source_id).join(",")}`);
  for (const loc of LOCALES) {
    console.log(`  ${loc}.summary="${a.localized[loc].summary.slice(0, 64)}…"`);
  }

  check(`${s.id}: localized EN/HI/ZH/FR summaries present`, LOCALES.every((l) => a.localized[l].summary.length > 0));
  check(`${s.id}: next_steps in all 4 languages`, LOCALES.every((l) => a.localized[l].next_steps.length > 0));
  check(`${s.id}: key_risk in all 4 languages`, LOCALES.every((l) => a.localized[l].key_risk.length > 0));
  check(`${s.id}: citations whitelisted`, a.citations.every((c) => ["fdcpa_1692g", "fdcpa_1692e", "ny_cplr_320", "in_ni_138", "in_cpc_o9r6", "in_cpa_s35", "es_lau_27", "es_lec_22", "eu_crd_16", "uk_ha_s21"].includes(c.source_id)));
  check(`${s.id}: amounts parsed`, a.demands.some((d) => d.amount !== null && d.amount > 0));
}

console.log("\n=== generic ===");
const g = offlineAnalyze(generic);
console.log(`  type=${g.notice_type} severity=${g.severity.level} lang=${g.language_detected} conf=${g.overall_confidence}`);
check("generic: degrades gracefully with low confidence", g.notice_type === "other" && g.overall_confidence < 0.75);
check("generic: localized blocks in 4 languages", LOCALES.every((l) => g.localized[l].summary.length > 0));

// red-severity safety: cheque bounce must include lawyer step in all languages
const cb = offlineAnalyze(SAMPLES[1].text);
check("cheque bounce (red): lawyer step in EN", cb.localized.en.next_steps.some((x) => /lawyer/i.test(x)));
check("cheque bounce (red): lawyer step in HI", cb.localized.hi.next_steps.some((x) => /वकील|अधिवक्ता/.test(x)));
check("cheque bounce (red): lawyer step in ZH", cb.localized.zh.next_steps.some((x) => /律师/.test(x)));
check("cheque bounce (red): lawyer step in FR", cb.localized.fr.next_steps.some((x) => /avocat/i.test(x)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
