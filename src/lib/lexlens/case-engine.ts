// LexLens — case engine (FEATURE 1/2/4/5/6/7/12/13/14/22/26).
// Pure, deterministic assembly of the case view. Runs on the CLIENT so that
// user inputs (receipt date, position, evidence) recalculate deadlines,
// timeline, actions and the brief instantly — never re-running the LLM.

import { calculateDeadline, isValidISO, type DeadlineRule, type FieldValue } from "./deadline-engine";
import {
  ACTION_TEMPLATES,
  DEADLINE_RULES,
  FACT_LABELS,
  POSITION_ACTIONS,
  REQUIRED_FIELDS,
  actionsFor,
  consequencesFor,
  draftFor,
  evidenceFor,
  genericStatedRule,
  questionsFor,
  timelineFor,
} from "./rules";
import {
  NOTICE_TYPE_LABELS,
  emptyUserState,
  type ActionItem,
  type CaseBase,
  type CaseFact,
  type CaseView,
  type ConsequenceStep,
  type DeadlineCalc,
  type EvidenceRow,
  type LawyerQuestion,
  type Locale,
  type MissingField,
  type TimelineEvent,
  type UserCaseState,
  type UserPosition,
} from "./types";

export function money(amount: number, currency: string | null, locale: Locale): string {
  const intl: Record<Locale, string> = { en: "en-US", hi: "en-IN", zh: "zh-CN", fr: "fr-FR" };
  try {
    if (currency === "INR") return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(amount)}`;
    return new Intl.NumberFormat(intl[locale], {
      style: "currency",
      currency: currency ?? "USD",
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency ?? ""} ${amount}`.trim();
  }
}

export function fmtISO(iso: string, locale: Locale): string {
  const intl: Record<Locale, string> = { en: "en-GB", hi: "en-IN", zh: "zh-CN", fr: "fr-FR" };
  try {
    return new Intl.DateTimeFormat(intl[locale], { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
      new Date(`${iso}T00:00:00Z`)
    );
  } catch {
    return iso;
  }
}

const label = (l: Record<Locale, string>, locale: Locale) => l[locale] ?? l.en;

/* ───────────────────────── field resolution ───────────────────────── */

interface ResolvedFields {
  fields: Record<string, FieldValue>;
  userFilled: Set<string>;
}

function resolveFields(base: CaseBase, user: UserCaseState): ResolvedFields {
  const fields: Record<string, FieldValue> = {};
  for (const f of base.facts) {
    if (!f.key) continue;
    if (fields[f.key]) continue; // first occurrence wins
    fields[f.key] = {
      value: f.value,
      iso: f.kind === "date" ? f.iso : null,
      num: f.kind === "money" || f.kind === "number" ? f.num : null,
      source: "document",
      confidence: f.confidence,
      source_ref: f.source_ref ?? null,
    };
  }
  const userFilled = new Set<string>();
  for (const [key, v] of Object.entries(user.inputs ?? {})) {
    userFilled.add(key);
    fields[key] = { value: v.value, iso: v.iso, num: v.num, source: "user_input", confidence: null, source_ref: null };
  }
  return { fields, userFilled };
}

/* ───────────────────────── deadline rules per case ───────────────────────── */

function rulesForCase(base: CaseBase): { rules: DeadlineRule[]; origin: "statute_rule" | "notice_stated" } {
  const packed = DEADLINE_RULES[base.notice_type];
  if (packed && packed.length) return { rules: packed, origin: "statute_rule" };
  const stated = base.stated_deadlines?.[0];
  if (stated) {
    const rule = genericStatedRule();
    rule.period_days = stated.period_days ?? null;
    rule.anchor_field = stated.anchor === "notice" ? "notice_date" : stated.anchor === "explicit" ? "explicit" : "receipt_date";
    return { rules: [rule], origin: "notice_stated" };
  }
  return { rules: [], origin: "notice_stated" };
}

const MISSING_DEADLINE_REASON: Record<Locale, (anchorLabel: string) => string> = {
  en: (a) => `Exact deadline cannot be calculated because ${a} is unknown. Add it below and LexLens will recalculate instantly.`,
  hi: (a) => `${a} ज्ञात न होने के कारण सटीक समा-सीमा की गणना नहीं की जा सकती। नीचे जोड़ें — LexLens तुरंत दोबारा गणना करेगा।`,
  zh: (a) => `由于尚不知道${a}，无法计算确切截止日。请在下方补充，LexLens 将立即重新计算。`,
  fr: (a) => `Le délai exact ne peut être calculé car ${a} est inconnu. Ajoutez-le ci-dessous et LexLens recalculera instantanément.`,
};

function anchorLabelFor(field: string | null, locale: Locale): string {
  if (field && FACT_LABELS[field]) return label(FACT_LABELS[field], locale).toLowerCase();
  return { en: "the required date", hi: "आवश्यक तिथि", zh: "所需日期", fr: "la date requise" }[locale];
}

/* ───────────────────────── main assembly ───────────────────────── */

export function buildCaseView(
  base: CaseBase,
  user: UserCaseState | null,
  locale: Locale,
  today: string,
): CaseView {
  const u = user ?? emptyUserState();
  const { fields, userFilled } = resolveFields(base, u);
  const required = REQUIRED_FIELDS[base.notice_type] ?? [];
  const typeLabel = NOTICE_TYPE_LABELS[base.notice_type] ?? NOTICE_TYPE_LABELS.other;

  /* ── facts table (document facts + required fields + user inputs) ── */
  const facts: CaseFact[] = [];
  const seen = new Set<string>();
  const pushFact = (
    key: string,
    fv: FieldValue,
    opts: { importance: "critical" | "high" | "medium"; feeds: boolean; userConfirmed: boolean },
  ) => {
    if (seen.has(key)) return;
    seen.add(key);
    const fl = FACT_LABELS[key];
    facts.push({
      key,
      label: fl ? label(fl, locale) : key,
      value: fv.value || null,
      kind: fv.iso ? "date" : fv.num !== null ? "money" : "text",
      currency: base.facts.find((f) => f.key === key)?.currency ?? null,
      status: opts.userConfirmed ? "user_confirmed" : fv.source === "document" ? "document_verified" : "unknown",
      confidence: fv.source === "document" ? fv.confidence : null,
      source:
        fv.source === "document"
          ? { kind: "document", ref: fv.source_ref ? `Notice · ${fv.source_ref}` : "Notice" }
          : { kind: "user_input", ref: locale === "en" ? "User input" : null },
      importance: opts.importance,
      feeds_deadline: opts.feeds,
    });
  };

  for (const rf of required) {
    const fv = fields[rf.field];
    if (fv) pushFact(rf.field, fv, { importance: rf.importance, feeds: rf.feeds_deadline, userConfirmed: userFilled.has(rf.field) });
  }
  for (const f of base.facts) {
    if (!f.key || seen.has(f.key)) continue;
    pushFact(
      f.key,
      { value: f.value, iso: f.iso, num: f.num, source: "document", confidence: f.confidence, source_ref: f.source_ref ?? null },
      { importance: "medium", feeds: false, userConfirmed: false },
    );
  }

  /* ── missing information (FEATURE 2) — deterministic, never invented ── */
  const missing: MissingField[] = [];
  for (const rf of required) {
    const fv = fields[rf.field];
    const hasValue = fv && (fv.iso || fv.value?.trim() || fv.num !== null);
    if (!hasValue) {
      missing.push({
        field: rf.field,
        label: FACT_LABELS[rf.field] ? label(FACT_LABELS[rf.field], locale) : rf.field,
        importance: rf.importance,
        why: label(rf.why, locale),
        input: rf.input,
        feeds_deadline: rf.feeds_deadline,
        source_id: rf.source_id,
      });
    }
  }
  // generic notices: anchor of the stated deadline is missing?
  if (!REQUIRED_FIELDS[base.notice_type]) {
    const stated = base.stated_deadlines?.[0];
    if (stated && stated.anchor !== "explicit" && !stated.explicit_date) {
      const anchorField = stated.anchor === "notice" ? "notice_date" : "receipt_date";
      if (!fields[anchorField]?.iso) {
        missing.push({
          field: anchorField,
          label: FACT_LABELS[anchorField] ? label(FACT_LABELS[anchorField], locale) : anchorField,
          importance: "critical",
          why: label(
            {
              en: "The notice states a response period from this date — without it no exact deadline can be calculated.",
              hi: "नोटिस इस तिथि से जवाबी अवधि बताता है — इसके बिना सटीक समा-सीमा नहीं निकल सकती।",
              zh: "通知载明的答复期限自该日期起算——没有它就无法计算确切截止日。",
              fr: "Le constat fixe un délai à compter de cette date — sans elle, aucun calcul possible.",
            },
            locale,
          ),
          input: "date",
          feeds_deadline: true,
          source_id: null,
        });
      }
    }
  }

  /* ── deadlines via the deterministic engine (FEATURE 3) ── */
  const { rules, origin } = rulesForCase(base);
  const statedPeriod = base.stated_deadlines?.[0]?.period_days ?? null;
  const statedExplicit = base.stated_deadlines?.find((d) => isValidISO(d.explicit_date))?.explicit_date ?? null;
  const deadlines: DeadlineCalc[] = rules.map((rule) => {
    const res = calculateDeadline({
      rule,
      fields,
      stated_period_days: statedPeriod,
      stated_explicit_date: statedExplicit,
      missing_reason: "",
      today,
    });
    return {
      event_key: res.event_key,
      label: label(rule.label, locale),
      description: label(rule.description, locale),
      rule_source_id: res.rule_source_id,
      anchor_field: res.anchor_field,
      anchor_date: res.anchor_date,
      anchor_source: res.anchor_source,
      period_days: res.period_days,
      business_days: res.business_days,
      deadline: res.deadline,
      days_left: res.days_left,
      status: res.status,
      calculation_method: "deterministic",
      origin,
      missing_reason:
        res.status === "missing_input" ? MISSING_DEADLINE_REASON[locale](anchorLabelFor(res.anchor_field, locale)) : null,
      source_ref:
        res.status === "calculated" && res.anchor_date
          ? {
              kind: res.anchor_source === "user_input" ? "user_input" : "document",
              ref:
                res.anchor_source === "user_input"
                  ? null
                  : `Notice · ${fields[res.anchor_field ?? ""]?.source_ref ?? ""}`.trim(),
            }
          : null,
    };
  });

  /* ── timeline (FEATURE 4) — dates only from document/user, never fabricated ── */
  const timeline: TimelineEvent[] = timelineFor(base.notice_type).map((tpl) => {
    if (tpl.field === "derived") {
      const dl = deadlines.find((d) => d.status === "calculated");
      return {
        key: tpl.key,
        label: label(tpl.label, locale),
        date: dl?.deadline ?? null,
        status: dl ? "estimated" : "requires_input",
        source: dl
          ? {
              kind: "derived",
              ref:
                dl.anchor_source === "user_input"
                  ? { en: "Calculated from user-provided receipt date + statutory period", hi: "उपयोगकर्ता-प्रदत्त प्राप्ति तिथि + वैधानिक अवधि से गणना", zh: "由用户提供的签收日期+法定期限计算得出", fr: "Calculé depuis la date de réception fournie + délai légal" }[locale]
                  : { en: "Calculated from document date + statutory period", hi: "दस्तावेज़ तिथि + वैधानिक अवधि से गणना", zh: "由文件日期+法定期限计算得出", fr: "Calculé depuis la date du document + délai légal" }[locale],
            }
          : { kind: "none", ref: null },
        confidence: null,
        order: tpl.order,
      };
    }
    const fv = fields[tpl.field];
    const hasDate = fv?.iso && isValidISO(fv.iso);
    return {
      key: tpl.key,
      label: label(tpl.label, locale),
      date: hasDate ? fv!.iso : null,
      status: hasDate ? (userFilled.has(tpl.field) ? "confirmed" : "confirmed") : fv?.value ? "estimated" : "requires_input",
      source:
        hasDate && userFilled.has(tpl.field)
          ? { kind: "user_input", ref: null }
          : hasDate
            ? { kind: "document", ref: fv!.source_ref ? `Notice · ${fv!.source_ref}` : "Notice" }
            : fv?.value
              ? { kind: "document", ref: `Notice · ${fv.value}` }
              : { kind: "none", ref: null },
      confidence: hasDate && !userFilled.has(tpl.field) ? (fv!.confidence ?? null) : null,
      order: tpl.order,
    };
  });
  timeline.sort((a, b) => a.order - b.order);

  /* ── evidence (FEATURE 6) ── */
  const evidence: EvidenceRow[] = evidenceFor(base.notice_type).map((tpl) => ({
    key: tpl.key,
    label: label(tpl.label, locale),
    have: tpl.have,
    from_upload: false,
    claim_link: tpl.claim_link ? label(tpl.claim_link, locale) : null,
    uploads: [],
  }));
  for (const up of u.evidence ?? []) {
    evidence.push({
      key: `upload_${up.id}`,
      label: up.name,
      have: true,
      from_upload: true,
      claim_link: null,
      uploads: [up],
    });
  }

  /* ── action center (FEATURE 1) ── */
  const deadlineCalculated = deadlines.some((d) => d.status === "calculated");
  const daysLefts = deadlines.filter((d) => d.status === "calculated" && d.days_left !== null).map((d) => d.days_left as number);
  const minDaysLeft = daysLefts.length ? Math.min(...daysLefts) : null;
  const ctx = {
    type: base.notice_type,
    severity: base.severity.level,
    missing: missing.map((m) => m.field),
    deadline_calculated: deadlineCalculated,
    min_days_left: minDaysLeft,
    has_amount: base.facts.some((f) => f.key === "amount" && f.num !== null),
    position: u.position,
  };
  const templates = [...actionsFor(base.notice_type)];
  if (u.position) {
    const posAction = POSITION_ACTIONS[u.position];
    if (posAction) templates.push(posAction);
  }
  const actions: ActionItem[] = templates
    .filter((t) => t.when(ctx))
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 7)
    .map((t) => ({
      key: t.key,
      title: label(t.title, locale),
      reason: label(t.reason, locale),
      priority: Math.round(t.priority),
      source: { kind: t.source_id ? "legal_corpus" : "none", ref: null, source_id: t.source_id ?? null },
    }));

  /* ── what happens next (FEATURE 11) ── */
  const consequences: ConsequenceStep[] = consequencesFor(base.notice_type).map((c) => ({
    key: c.key,
    text: label(c.text, locale),
    tone: c.tone,
  }));

  /* ── lawyer questions (FEATURE 12/13) ── */
  const questions: LawyerQuestion[] = questionsFor(base.notice_type)
    .filter((q) => !q.when || q.when(ctx))
    .map((q) => ({ key: q.key, text: label(q.text, locale) }));

  return {
    base,
    user: u,
    type_label: typeLabel,
    jurisdiction_label: `${base.jurisdiction.country}${base.jurisdiction.region ? " · " + base.jurisdiction.region : ""}`,
    facts,
    missing,
    deadlines,
    timeline,
    evidence,
    actions,
    consequences,
    questions,
    position: u.position ?? null,
  };
}

/* ───────────────────────── lawyer brief (FEATURE 12) ───────────────────────── */

export interface Brief {
  matter: string;
  jurisdiction: string;
  claimant: string;
  recipient: string | null;
  amount: string | null;
  important_dates: { label: string; value: string; source: string }[];
  provisions: { title: string; relevance: string }[];
  deadline: string;
  verified_facts: string[];
  unverified_facts: string[];
  evidence_available: string[];
  evidence_missing: string[];
  questions: string[];
  position: UserPosition | null;
  warning: Record<Locale, string>;
}

export function buildBrief(view: CaseView, locale: Locale): Brief {
  const { base, facts, missing, deadlines, evidence, questions } = view;
  const t = (s: string) => s;

  const dateFacts = facts.filter((f) => f.kind === "date" && f.value);
  const important_dates = dateFacts.map((f) => ({
    label: f.label,
    value: fmtISO(f.value as string, locale),
    source: f.source.kind === "user_input" ? "User input" : f.source.ref ?? "Notice",
  }));

  const dl = deadlines.find((d) => d.status === "calculated");
  const dlMissing = deadlines.find((d) => d.status !== "calculated");
  const deadline = dl
    ? `${fmtISO(dl.deadline as string, locale)} — ${dl.label}${dl.anchor_source === "user_input" ? " (calculated from user-provided receipt date)" : ""}`
    : dlMissing
      ? "Unknown — cannot be calculated until the anchor date is provided"
      : "Unknown";

  const amountFact = facts.find((f) => f.key === "amount");
  const amount =
    amountFact?.value ??
    (base.claims.find((c) => c.amount !== null)
      ? money(base.claims.find((c) => c.amount !== null)!.amount as number, base.claims.find((c) => c.amount !== null)!.currency, locale)
      : null);

  const verified = facts.filter((f) => f.status === "document_verified" && f.value);
  const unverified = [
    ...missing.map((m) => `${m.label} (missing${m.importance === "critical" ? ", critical" : ""})`),
    ...facts.filter((f) => f.status === "inferred" && f.value).map((f) => `${f.label} (inferred)`),
  ];

  return {
    matter: view.type_label,
    jurisdiction: view.jurisdiction_label,
    claimant: base.sender.name,
    recipient: base.recipient?.name ?? null,
    amount,
    important_dates,
    provisions: base.citations.map((c) => ({
      title: c.source_id,
      relevance: c.relevance,
    })),
    deadline,
    verified_facts: verified.map((f) => `${f.label}: ${f.value}`),
    unverified_facts: unverified.length ? unverified.map(t) : [],
    evidence_available: evidence.filter((e) => e.have).map((e) => e.label),
    evidence_missing: evidence.filter((e) => !e.have).map((e) => e.label),
    questions: questions.map((q) => q.text),
    position: view.position,
    warning: {
      en: "This is an AI-generated factual summary for lawyer review and is not legal advice.",
      hi: "यह वकील की समीक्षा के लिए AI-निर्मित तथ्यात्मक सारांश है और कानूनी सलाह नहीं है।",
      zh: "这是供律师审阅的 AI 生成事实摘要，不构成法律意见。",
      fr: "Résumé factuel généré par IA pour examen par un avocat — ne constitue pas un avis juridique.",
    },
  };
}

export function briefToText(b: Brief, locale: Locale): string {
  const L = {
    en: { h: "LEXLENS CASE BRIEF", matter: "Matter", jur: "Jurisdiction", claimant: "Claimant / Sender", recipient: "Recipient", amount: "Amount", dates: "Important dates", prov: "Applicable legal provisions", deadline: "Current deadline", facts: "Verified facts", unv: "Unverified / missing facts", evA: "Available evidence", evM: "Missing evidence", q: "Questions for lawyer", pos: "Recipient's stated position" },
    hi: { h: "LEXLENS केस ब्रीफ", matter: "विषय", jur: "क्षेत्राधिकार", claimant: "दावेदार / प्रेषक", recipient: "प्राप्तकर्ता", amount: "राशि", dates: "महत्वपूर्ण तिथियाँ", prov: "लागू कानूनी प्रावधान", deadline: "वर्तमान समा-सीमा", facts: "सत्यापित तथ्य", unv: "असत्यापित / अनुपलब्ध तथ्य", evA: "उपलब्ध साक्ष्य", evM: "अनुपलब्ध साक्ष्य", q: "वकील के लिए प्रश्न", pos: "प्राप्तकर्ता की बताई गई स्थिति" },
    zh: { h: "LEXLENS 案件简报", matter: "事项", jur: "管辖区", claimant: "索赔方/发件方", recipient: "收件人", amount: "金额", dates: "重要日期", prov: "适用法律条款", deadline: "当前截止日", facts: "已核实事实", unv: "未核实/缺失事实", evA: "现有证据", evM: "缺失证据", q: "请律师解答的问题", pos: "收件人所述立场" },
    fr: { h: "SYNTHÈSE LEXLENS", matter: "Affaire", jur: "Juridiction", claimant: "Réclamant / Expéditeur", recipient: "Destinataire", amount: "Montant", dates: "Dates importantes", prov: "Dispositions applicables", deadline: "Échéance actuelle", facts: "Faits vérifiés", unv: "Faits non vérifiés / manquants", evA: "Preuves disponibles", evM: "Preuves manquantes", q: "Questions pour l'avocat", pos: "Position indiquée par le destinataire" },
  }[locale];

  const lines: string[] = [L.h, "=".repeat(40), ""];
  lines.push(`${L.matter}: ${b.matter}`);
  lines.push(`${L.jur}: ${b.jurisdiction}`);
  lines.push(`${L.claimant}: ${b.claimant}`);
  if (b.recipient) lines.push(`${L.recipient}: ${b.recipient}`);
  if (b.amount) lines.push(`${L.amount}: ${b.amount}`);
  lines.push("", `${L.dates}:`);
  for (const d of b.important_dates) lines.push(`  - ${d.label}: ${d.value} (${d.source})`);
  lines.push("", `${L.prov}:`);
  for (const p of b.provisions) lines.push(`  - ${p.title} — ${p.relevance}`);
  lines.push("", `${L.deadline}: ${b.deadline}`);
  lines.push("", `${L.facts}:`);
  for (const f of b.verified_facts) lines.push(`  ✓ ${f}`);
  if (b.unverified_facts.length) {
    lines.push("", `${L.unv}:`);
    for (const f of b.unverified_facts) lines.push(`  ⚠ ${f}`);
  }
  lines.push("", `${L.evA}:`);
  for (const e of b.evidence_available) lines.push(`  ✓ ${e}`);
  if (b.evidence_missing.length) {
    lines.push("", `${L.evM}:`);
    for (const e of b.evidence_missing) lines.push(`  ⚠ ${e}`);
  }
  if (b.position) lines.push("", `${L.pos}: ${b.position}`);
  lines.push("", `${L.q}:`);
  b.questions.forEach((q, i) => lines.push(`  ${i + 1}. ${q}`));
  lines.push("", b.warning[locale]);
  return lines.join("\n");
}

/* ───────────────────────── template draft (offline fallback, FEATURE 14) ───────────────────────── */

export function templateDraft(view: CaseView, locale: Locale): string {
  const fn = draftFor(view.base.notice_type);
  const amountFact = view.facts.find((f) => f.key === "amount");
  const ctx = {
    recipient: view.base.recipient?.name ?? null,
    sender: view.base.sender.name,
    amount: amountFact?.value ?? null,
    noticeDate: view.facts.find((f) => f.key === "notice_date")?.value ?? null,
    position: view.position,
    missing: view.missing.map((m) => m.field),
    deadlineText: view.facts.find((f) => f.key === "receipt_date")?.value ?? null,
  };
  return fn(ctx)[locale];
}

/* ───────────────────────── deadline reminders (FEATURE 16, .ics) ───────────────────────── */

export function buildIcs(deadlineISO: string, title: string, daysBefore: number): string {
  const dt = (d: string) => d.replace(/-/g, "");
  const remind = new Date(`${deadlineISO}T00:00:00Z`);
  remind.setUTCDate(remind.getUTCDate() - daysBefore);
  const rISO = remind.toISOString().slice(0, 10);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LexLens//Deadline Reminder//EN",
    "BEGIN:VEVENT",
    `UID:lexlens-${deadlineISO}-${daysBefore}@lexlens.demo`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
    `DTSTART;VALUE=DATE:${dt(rISO)}`,
    `DTEND;VALUE=DATE:${dt(deadlineISO)}`,
    `SUMMARY:${title} (${daysBefore}-day reminder)`,
    "DESCRIPTION:Reminder generated by LexLens from a deterministically calculated deadline. Information only — not legal advice.",
    "BEGIN:VALARM",
    "TRIGGER:-PT9H",
    "ACTION:DISPLAY",
    "DESCRIPTION:LexLens deadline reminder",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
