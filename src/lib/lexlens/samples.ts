// LexLens — preloaded demo notices. FICTIONAL documents written to mirror
// real-world formats for the hackathon demo (no real personal data).
// Dates are generated RELATIVE TO TODAY so every demo run shows live
// countdown chips ("26 days left") instead of stale "overdue" states.

export interface SampleNotice {
  id: string;
  title: string;
  jurisdiction_label: string;
  stat_hint: string;
  words: number;
  text: string;
}

/** ISO date offset by N days from today, in YYYY-MM-DD. */
function d(offsetDays: number): string {
  const t = new Date();
  t.setDate(t.getDate() + offsetDays);
  return t.toISOString().slice(0, 10);
}

/** Human date like "September 13, 2026" (en-US). */
function dUS(offsetDays: number): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${d(offsetDays)}T00:00:00Z`));
}

/** Human date like "13 September 2026" (en-IN style). */
function dIN(offsetDays: number): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${d(offsetDays)}T00:00:00Z`));
}

/** Spanish long date: "13 de septiembre de 2026". */
function dES(offsetDays: number): string {
  const s = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${d(offsetDays)}T00:00:00Z`));
  return s.replace(/ de (\d)/, " de $1").replace("de 20", "de 20");
}

/** Spanish month+year like "julio de 2026" for rent months. */
function monthES(offsetMonths: number): string {
  const t = new Date();
  t.setMonth(t.getMonth() + offsetMonths);
  return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" }).format(t);
}

const US_DEBT = `ALLIED RECOVERY SYSTEMS LLC
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

const INDIA_CHEQUE = `BY REGISTERED A.D. / SPEED POST
Ref. No.: SV/CL/2025-114

Date: ${dIN(-3)}

To,
Mr. Rohan Mehta,
A-704, Sunrise Residency, Powai,
Mumbai – 400076.

SUB: LEGAL NOTICE UNDER SECTION 138 OF THE NEGOTIABLE INSTRUMENTS ACT, 1881 — DEMAND OF PAYMENT OF Rs. 4,50,000/- (RUPEES FOUR LAKH FIFTY THOUSAND ONLY)

Under instructions from and on behalf of my client, M/s Sharma Traders Pvt. Ltd., having its registered office at 2nd Floor, Kanakia Spaces, Andheri East, Mumbai – 400093, I hereby serve upon you the following legal notice:

1. That my client states that you had business dealings with my client and, towards payment for goods supplied vide Invoice No. ST/24-25/0917 dated ${dIN(-70)} amounting to Rs. 4,50,000/-, you issued a cheque bearing Cheque No. 004512 dated ${dIN(-38)} for Rs. 4,50,000/- drawn on HDFC Bank Ltd., Powai Branch, in favour of my client.

2. That the said cheque, on presentment before the drawee bank on ${dIN(-35)}, was returned dishonoured vide Return Memo dated ${dIN(-35)} with the remarks "FUNDS INSUFFICIENT".

3. That despite repeated verbal demands and written reminders dated ${dIN(-28)} and ${dIN(-21)}, you have failed and neglected to pay the said amount.

I, therefore, call upon you to pay the said sum of Rs. 4,50,000/- (Rupees Four Lakh Fifty Thousand Only) together with interest at 18% per annum within FIFTEEN (15) DAYS from the receipt of this notice, failing which my client shall be constrained to initiate criminal proceedings against you under Section 138 read with Section 142 of the Negotiable Instruments Act, 1881 before the learned Magistrate Court at Mumbai, wherein you shall be liable to be punished with imprisonment which may extend to two years, or with fine which may extend to twice the amount of the cheque, or with both, besides costs.

A copy of this notice is retained in my office for record and further necessary action.

(Amit V. Shenoy)
Advocate — Enrolment No. MAH/14526/2011
Shenoy & Associates, Advocates, Mumbai`;

const SPAIN_EVICTION = `REQUERIMIENTO NOTARIAL — Nº 2025/0344

D. Fernando López Ortega, Notario del Ilustre Colegio Notarial de Madrid,

HACE SABER: Que en el día de la fecha se ha personado en esta Notaría D.ª Carmen Villalba Ruiz, en calidad de arrendadora, requiriendo a D.ª María González Prieto, arrendataria del inmueble sito en Calle Alcalá 142, 3º B, 28009 Madrid, para que:

PRIMERO.- PAGUE la cantidad de 2.750,00 €, correspondiente a las rentas devengadas y no abonadas correspondientes a los meses de ${monthES(-4)}, ${monthES(-3)} y ${monthES(-2)}, conforme al contrato de arrendamiento de fecha 15 de septiembre de 2023, en el que consta una renta mensual de 950,00 €, más 45,00 € de gastos de comunidad, más el IBI prorrateado.

SEGUNDO.- DESHAGA EL IMPAGO dentro del plazo señalado, advirtiéndole de que, conforme al artículo 27.2.a) de la Ley 29/1994, de 24 de noviembre, de Arrendamientos Urbanos (LAU), el impago de la renta faculta a la arrendadora para resolver el contrato de arrendamiento y exigir el desalojo del inmueble mediante la interposición de la correspondiente demanda de desahucio por impago ante los Juzgados de Primera Instancia de Madrid, pudiendo reclamar además las cantidades adeudadas y los intereses legales.

TERCERO.- Se le advierte igualmente que, de dirigirse contra usted la indicada demanda de desahucio, podrá ENERVAR la acción pagando al arrendador todas las cantidades adeudadas dentro de los diez días hábiles siguientes a la notificación de la resolución, conforme al artículo 22.2 de la Ley 1/2000, de Enjuiciamiento Civil, tratándose esta de la primera vez en que se ejercita dicha acción.

Madrid, ${dES(-5)}.`;

export const SAMPLES: SampleNotice[] = [
  {
    id: "in-cheque",
    title: "Cheque bounce legal notice",
    jurisdiction_label: "India · Maharashtra",
    stat_hint: "NI Act, 1881 · §138",
    words: 350,
    text: INDIA_CHEQUE,
  },
  {
    id: "us-debt",
    title: "Debt collection letter",
    jurisdiction_label: "United States · New York",
    stat_hint: "FDCPA · 15 U.S.C. §1692g",
    words: 280,
    text: US_DEBT,
  },
  {
    id: "es-eviction",
    title: "Eviction payment demand",
    jurisdiction_label: "Spain · Madrid",
    stat_hint: "LAU 29/1994 · Art. 27.2.a)",
    words: 300,
    text: SPAIN_EVICTION,
  },
];
