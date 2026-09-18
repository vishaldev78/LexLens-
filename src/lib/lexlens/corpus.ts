// LexLens — mini legal corpus ("RAG-lite" for the MVP demo).
// In production this lives in PostgreSQL + pgvector with BM25 hybrid retrieval
// (see TRD §4). For the hackathon build we ship a curated, versioned corpus
// that the model may ONLY cite from — no corpus match, no citation, and the
// overall confidence gets auto-capped (see /api/analyze post-processing).

import type { CorpusEntry } from "./types";

export const CORPUS_VERSION = "2025.09-mvp";
export const CORPUS: CorpusEntry[] = [
  {
    source_id: "fdcpa_1692g",
    jurisdiction: "US",
    title: "FDCPA §809 — 15 U.S.C. §1692g (Validation of Debts)",
    text: "Within five days of first contacting a consumer, a debt collector must send a written notice stating the amount of the debt and the creditor's name. If the consumer disputes the debt — or any part of it — in writing within 30 days of receiving the notice, the collector must stop collection until it obtains and mails verification of the debt. The consumer may also request the name and address of the original creditor within that 30-day window.",
  },
  {
    source_id: "fdcpa_1692e",
    jurisdiction: "US",
    title: "FDCPA §807/§808 — 15 U.S.C. §1692e–f (Prohibited Practices)",
    text: "A debt collector may not use false, deceptive or misleading representations — including threats to take legal action that is not intended or not permitted — and may not harass, oppress or abuse any person in connection with the collection of a debt.",
  },
  {
    source_id: "ny_cplr_320",
    jurisdiction: "US-NY",
    title: "New York CPLR §320 (Appearance; Default Judgment)",
    text: "A defendant served with a summons and complaint must appear or answer within the time prescribed by law. A defendant who fails to answer may have a default judgment entered against them for the amount demanded, which can be enforced through wage garnishment or bank levies.",
  },
  {
    source_id: "in_ni_138",
    jurisdiction: "IN",
    title: "Negotiable Instruments Act, 1881 — §138 (Dishonour of Cheque)",
    text: "Where a cheque drawn on an account is returned unpaid for insufficiency of funds, the drawer is deemed to have committed an offence punishable with imprisonment up to two years, or with fine up to twice the cheque amount, or with both. Conditions: the cheque must be presented within 3 months; the payee must send a written demand notice within 30 days of receiving the dishonour memo; and the drawer gets 15 days from receipt of that notice to pay before a criminal complaint can be filed under §142.",
  },
  {
    source_id: "in_cpc_o9r6",
    jurisdiction: "IN",
    title: "Code of Civil Procedure, 1908 — Order IX Rule 6 (Ex-parte Proceeding)",
    text: "Where the defendant does not appear when the suit is called on for hearing, the court may proceed to determine the suit ex parte and pronounce a decree against the defendant — meaning the case can be decided in the plaintiff's favour without the defendant being heard.",
  },
  {
    source_id: "in_cpa_s35",
    jurisdiction: "IN",
    title: "Consumer Protection Act, 2019 — §35 (Filing a Complaint)",
    text: "A consumer may file a complaint with the District Commission relating to defective goods or deficient services. The complaint should ordinarily be filed within two years from the date on which the cause of action arises. Filing fees are modest and a lawyer is not mandatory.",
  },
  {
    source_id: "es_lau_27",
    jurisdiction: "ES",
    title: "Ley 29/1994 (LAU) — Art. 27.2.a) (Resolución por impago de renta)",
    text: "El impago de la renta o de cualquiera de las obligaciones esenciales del arrendatario faculta al arrendador para resolver el contrato de arrendamiento de vivienda y exigir el desalojo del inmueble mediante demanda de desahucio ante los Juzgados de Primera Instancia.",
  },
  {
    source_id: "es_lec_22",
    jurisdiction: "ES",
    title: "Ley 1/2000 (LEC) — Art. 22.2 (Enervación)",
    text: "En la primera demanda de desahucio por impago, el arrendatario puede enervar la acción — detener el desalojo — pagando al arrendador el total de las cantidades adeudadas dentro de los diez días hábiles siguientes a la notificación de la resolución. No procede la enervación si ha existido una enervación anterior o si el arrendador hubiera requerido el pago con al menos 30 días de antelación sin resultado.",
  },
  {
    source_id: "eu_crd_16",
    jurisdiction: "EU",
    title: "Consumer Rights Directive 2011/83/EU — Art. 16 (Right of Withdrawal)",
    text: "The consumer has the right to withdraw from a distance or off-premises contract within 14 days without giving any reason and without incurring any cost other than those provided for in the Directive.",
  },
  {
    source_id: "uk_ha_s21",
    jurisdiction: "UK",
    title: "Housing Act 1988 — s.21 (Recovery of Possession — Assured Shorthold)",
    text: "A landlord of an assured shorthold tenancy may recover possession by serving at least two months' written notice. Possession proceedings may only begin after the notice period expires, and a valid notice cannot expire before the end of a fixed term. (Subject to ongoing Renters' Rights reforms.)",
  },
];

export function corpusForPrompt(): string {
  return CORPUS.map(
    (c) =>
      `[${c.source_id}] (${c.jurisdiction}) ${c.title}\n${c.text}`
  ).join("\n\n");
}

export function findCitation(sourceId: string): CorpusEntry | undefined {
  return CORPUS.find((c) => c.source_id === sourceId);
}
