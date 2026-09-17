"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Ban,
  BookOpenCheck,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Copy,
  FileText,
  Gavel,
  HandCoins,
  Home,
  Info,
  Printer,
  RotateCcw,
  Scale,
  ShieldAlert,
  ShoppingBag,
  Siren,
  UserRound,
  Receipt,
} from "lucide-react";
import { useLang } from "@/components/lexlens/language-provider";
import { loadResult, type RunResult } from "@/lib/lexlens/run-store";
import { CORPUS } from "@/lib/lexlens/corpus";
import {
  LOCALE_LABELS,
  LANGUAGE_NAMES,
  type Analysis,
  type Locale,
  type LocalizedBlock,
  type NoticeType,
  type SeverityLevel,
} from "@/lib/lexlens/types";

/* ───────────────────────── helpers ───────────────────────── */

const TYPE_ICONS: Record<string, React.ElementType> = {
  debt_collection: HandCoins,
  cheque_bounce: Scale,
  eviction: Home,
  consumer: ShoppingBag,
  tax: Receipt,
  employment: Briefcase,
  court_summons: Gavel,
  other: FileText,
};

const INTL_LOCALES: Record<Locale, string> = { en: "en-US", hi: "hi-IN", zh: "zh-CN", fr: "fr-FR" };

const LANG_CLASSES: Record<Locale, string> = { en: "", hi: "lang-hi", zh: "lang-zh", fr: "" };

function typeLabel(type: string, t: Record<string, string>): string {
  return t[`nt_${type}`] ?? type;
}

function fmtDate(iso: string | null, loc: Locale): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(INTL_LOCALES[loc], { day: "numeric", month: "long", year: "numeric" }).format(
      new Date(`${iso}T00:00:00`)
    );
  } catch {
    return iso;
  }
}

function daysChip(days: number | null, labels: Record<string, string>) {
  if (days === null || Number.isNaN(days))
    return { text: labels.noDate, tone: "border-slate-200 bg-slate-50 text-slate-600" };
  if (days < 0)
    return { text: `${Math.abs(days)} ${labels.overdue}`, tone: "border-red-200 bg-red-50 text-red-700" };
  if (days === 0) return { text: labels.today, tone: "border-red-200 bg-red-50 text-red-700" };
  if (days === 1) return { text: labels.oneLeft, tone: "border-red-200 bg-red-50 text-red-700" };
  if (days <= 7) return { text: `${days} ${labels.daysLeft}`, tone: "border-red-200 bg-red-50 text-red-700" };
  if (days <= 30) return { text: `${days} ${labels.daysLeft}`, tone: "border-amber-200 bg-amber-50 text-amber-700" };
  return { text: `${days} ${labels.daysLeft}`, tone: "border-emerald-200 bg-emerald-50 text-emerald-700" };
}

function money(amount: number | null, currency: string | null): string | null {
  if (amount === null || !Number.isFinite(amount)) return null;
  const whole = Number.isInteger(amount);
  try {
    if (currency === "INR")
      return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: whole ? 0 : 2 }).format(amount)}`;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency ?? "USD",
      maximumFractionDigits: whole ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency ?? ""} ${amount}`.trim();
  }
}

/* ───────────────────────── small building blocks ───────────────────────── */

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = "text-slate-800",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="print-card rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        <Icon className="h-3.5 w-3.5 text-indigo-500" />
        {label}
      </div>
      <div className={`mt-1.5 text-sm font-bold leading-snug ${accent}`}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  sub,
  children,
  tone = "border-slate-200",
}: {
  icon: React.ElementType;
  title: string;
  sub?: string;
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <section className={`print-card rounded-2xl border ${tone} bg-white shadow-sm`}>
      <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div>
          <h2 className="text-base font-bold tracking-tight text-slate-900">{title}</h2>
          {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
        </div>
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}

/* ───────────────────────── plain-language block (4-language tabs) ───────────────────────── */

function PlainLanguageCard({ analysis }: { analysis: Analysis }) {
  const { locale, t } = useLang();
  const [view, setView] = useState<Locale>(locale);
  const block: LocalizedBlock = analysis.localized[view] ?? analysis.localized.en;
  const langCls = LANG_CLASSES[view];

  const tabs: Locale[] = ["en", "hi", "zh", "fr"];

  return (
    <SectionCard icon={ClipboardList} title={t.rs_summary_t} sub={t.rs_summary_hint}>
      {/* Language tabs */}
      <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Explanation language">
        {tabs.map((l) => (
          <button
            key={l}
            role="tab"
            aria-selected={view === l}
            onClick={() => setView(l)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
              view === l
                ? "bg-indigo-600 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
            }`}
          >
            {LOCALE_LABELS[l].native}
          </button>
        ))}
      </div>

      <p className={`text-[15px] leading-relaxed text-slate-700 ${langCls}`}>{block.summary}</p>

      {block.key_risk && (
        <div className={`mt-5 rounded-xl border border-red-200 bg-red-50/70 p-4 ${langCls}`}>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-red-700">
            <Siren className="h-4 w-4" />
            {t.rs_keyrisk_t}
          </div>
          <p className="mt-1.5 text-sm font-semibold leading-relaxed text-red-800">{block.key_risk}</p>
        </div>
      )}

      {/* Rights */}
      {block.rights.length > 0 && (
        <div className="mt-6">
          <h3 className={`text-sm font-bold text-slate-900 ${langCls}`}>{t.rs_rights_t}</h3>
          <ul className={`mt-3 space-y-3 ${langCls}`}>
            {block.rights.map((r, i) => (
              <li key={i} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
                <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-emerald-500" />
                <div>
                  <span className="text-sm font-bold text-slate-800">{r.title}</span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-slate-600">{r.detail}</span>
                  {r.source_id && <CitationChip sid={r.source_id} />}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next steps */}
      {block.next_steps.length > 0 && (
        <div className="mt-6">
          <h3 className={`text-sm font-bold text-slate-900 ${langCls}`}>
            {t.rs_steps_t}
            <span className="ml-2 font-medium text-slate-400">{t.rs_steps_sub}</span>
          </h3>
          <ol className="mt-3 space-y-0">
            {block.next_steps.map((s, i) => (
              <li key={i} className={`relative flex gap-3.5 pb-4 last:pb-0 ${langCls}`}>
                {i < block.next_steps.length - 1 && (
                  <span className="absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-0.5 bg-indigo-100" aria-hidden />
                )}
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <p className="pt-1 text-sm leading-relaxed text-slate-700">{s}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </SectionCard>
  );
}

function CitationChip({ sid }: { sid: string }) {
  const entry = CORPUS.find((c) => c.source_id === sid);
  return (
    <span className="mt-2 inline-flex max-w-full items-center gap-1 rounded-md border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
      <BookOpenCheck className="h-3 w-3 shrink-0" />
      <span className="truncate">{entry ? entry.title : sid}</span>
    </span>
  );
}

/* ───────────────────────── the page ───────────────────────── */

function ResultInner() {
  const params = useSearchParams();
  const { locale, t } = useLang();
  const [copied, setCopied] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  const result = useMemo(() => loadResult(), [params]);

  if (!result || !result.analysis) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <FileText className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-xl font-bold text-slate-900">{t.rs_notfound_t}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{t.rs_notfound_d}</p>
        <Link
          href="/analyze"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-indigo-700"
        >
          <RotateCcw className="h-4 w-4" /> {t.rs_notfound_cta}
        </Link>
      </div>
    );
  }

  const a = result.analysis;
  const tt = t as unknown as Record<string, string>;
  const TypeIcon = TYPE_ICONS[a.notice_type] ?? FileText;
  const sev = a.severity.level as SeverityLevel;
  const confPct = Math.round(a.overall_confidence * 100);
  const confLow = a.overall_confidence < 0.75;
  const dlLabels = { noDate: t.rs_no_date, overdue: t.rs_overdue, today: t.rs_today, oneLeft: t.rs_1_day_left, daysLeft: t.rs_days_left };
  const sevMeta =
    sev === "red"
      ? { label: t.sev_red, blurb: t.sev_red_blurb, cls: "border-red-200 bg-red-50", text: "text-red-700", dot: "bg-red-500", icon: Siren }
      : sev === "yellow"
        ? { label: t.sev_yellow, blurb: t.sev_yellow_blurb, cls: "border-amber-200 bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", icon: AlertTriangle }
        : { label: t.sev_green, blurb: t.sev_green_blurb, cls: "border-emerald-200 bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", icon: CheckCircle2 };

  async function copySummary() {
    const b = a.localized[locale] ?? a.localized.en;
    const lines = [
      "LexLens — Legal notice summary",
      "──────────────────────────",
      b.summary,
      "",
      `${t.rs_keyrisk_t}: ${b.key_risk}`,
      "",
      ...(a.deadlines.length
        ? [`${t.rs_deadlines_t}:`, ...a.deadlines.map((d) => `• ${d.action}${d.date ? ` — ${d.date}` : ""}`), ""]
        : []),
      `${t.rs_steps_t}:`,
      ...b.next_steps.map((s, i) => `${i + 1}. ${s}`),
      "",
      t.rs_disclaimer,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-indigo-50/80 to-transparent" />

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        {/* ── Header + actions ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-indigo-700">
              <ClipboardList className="h-3 w-3" /> {t.rs_kicker}
            </span>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{t.rs_title}</h1>
            <p className="mt-1.5 text-sm text-slate-500">{t.rs_sub}</p>
          </div>
          <div className="no-print flex flex-wrap gap-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-700"
            >
              <Printer className="h-3.5 w-3.5" /> {t.rs_print}
            </button>
            <button
              onClick={() => void copySummary()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-700"
            >
              <Copy className="h-3.5 w-3.5" /> {copied ? t.rs_copied : t.rs_copy}
            </button>
            <Link
              href="/analyze"
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-indigo-700"
            >
              <RotateCcw className="h-3.5 w-3.5" /> {t.rs_new}
            </Link>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard icon={TypeIcon} label={t.rs_card_type} value={typeLabel(a.notice_type, tt)} />
          <StatCard
            icon={sevMeta.icon}
            label={t.rs_card_sev}
            value={sevMeta.label}
            accent={sevMeta.text}
            sub={undefined}
          />
          <StatCard
            icon={ShieldAlert}
            label={t.rs_card_conf}
            value={`${confPct}%`}
            accent={confLow ? "text-amber-700" : "text-emerald-700"}
          />
          <StatCard
            icon={Gavel}
            label={t.rs_card_jur}
            value={`${a.jurisdiction.country}${a.jurisdiction.region ? " · " + a.jurisdiction.region : ""}`}
          />
          <StatCard icon={FileText} label={t.rs_card_lang} value={LANGUAGE_NAMES[a.language_detected] ?? a.language_detected} />
          <StatCard icon={UserRound} label={t.rs_card_from} value={a.sender.name} sub={a.sender.type} />
        </div>

        {/* ── Severity banner ── */}
        <div className={`mt-5 flex items-start gap-3.5 rounded-2xl border p-5 ${sevMeta.cls}`}>
          <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/70 ${sevMeta.text}`}>
            <sevMeta.icon className="h-5 w-5" />
          </span>
          <div>
            <div className={`flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide ${sevMeta.text}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${sevMeta.dot}`} />
              {sevMeta.label}
            </div>
            <p className={`mt-1 text-sm leading-relaxed ${sevMeta.text} opacity-90`}>{sevMeta.blurb}</p>
          </div>
        </div>

        {/* ── Low confidence banner ── */}
        {confLow && (
          <div className="mt-3 flex items-start gap-3.5 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <div className="text-sm font-extrabold text-amber-800">{t.rs_lowconf_t}</div>
              <p className="mt-1 text-sm leading-relaxed text-amber-800/90">{t.rs_lowconf_d}</p>
            </div>
          </div>
        )}

        {/* ── Offline engine tip ── */}
        {result.pipeline_meta?.fallback && (
          <div className="no-print mt-3 flex items-start gap-3.5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
            <div>
              <span className="rounded-md bg-slate-200 px-1.5 py-0.5 text-[11px] font-bold uppercase text-slate-600">
                {t.pr_fallback_badge}
              </span>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{t.pr_fallback_tip}</p>
            </div>
          </div>
        )}

        {/* ── Main content ── */}
        <div className="mt-6 space-y-5">
          <PlainLanguageCard analysis={a} />

          {/* Deadlines */}
          <SectionCard
            icon={CalendarClock}
            title={t.rs_deadlines_t}
            sub={t.rs_deadlines_sub}
            tone={a.deadlines.length ? "border-slate-200" : "border-slate-200"}
          >
            {a.deadlines.length === 0 ? (
              <p className="flex items-start gap-2 text-sm text-slate-500">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /> {t.rs_no_deadlines}
              </p>
            ) : (
              <div className="grid gap-3">
                {a.deadlines.map((d, i) => {
                  const chip = daysChip(d.days_from_today, dlLabels);
                  return (
                    <div key={i} className="rounded-xl border border-slate-200 p-4 transition-colors hover:border-indigo-200">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-extrabold ${chip.tone}`}>
                          <CalendarClock className="h-3.5 w-3.5" />
                          {chip.text}
                        </span>
                        {d.date && (
                          <span className="text-xs font-medium text-slate-500">
                            {t.rs_due}: {fmtDate(d.date, locale)}
                          </span>
                        )}
                      </div>
                      <p className="mt-2.5 text-sm font-bold leading-snug text-slate-900">{d.action}</p>
                      {d.consequence_if_missed && (
                        <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
                          <span className="font-semibold text-red-600">{t.rs_consequence}: </span>
                          {d.consequence_if_missed}
                        </p>
                      )}
                      {d.legal_basis_source_id && <CitationChip sid={d.legal_basis_source_id} />}
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          {/* Demands */}
          <SectionCard icon={HandCoins} title={t.rs_demands_t}>
            {a.demands.length === 0 ? (
              <p className="flex items-start gap-2 text-sm text-slate-500">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /> {t.rs_no_demands}
              </p>
            ) : (
              <ul className="grid gap-2.5">
                {a.demands.map((dm, i) => {
                  const amt = money(dm.amount, dm.currency);
                  return (
                    <li key={i} className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
                      <p className="text-sm leading-relaxed text-slate-700">{dm.demand}</p>
                      {amt && (
                        <span className="shrink-0 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-extrabold text-white">{amt}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          {/* Citations */}
          {a.citations.length > 0 && (
            <SectionCard icon={BookOpenCheck} title={t.rs_citations_t} sub={t.rs_citations_sub}>
              <div className="grid gap-2.5">
                {a.citations.map((c, i) => {
                  const entry = CORPUS.find((x) => x.source_id === c.source_id);
                  return (
                    <details key={i} className="group rounded-xl border border-slate-200 open:bg-indigo-50/30">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3.5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-sm font-bold text-indigo-800">
                            <BookOpenCheck className="h-4 w-4 shrink-0" />
                            {entry?.title ?? c.source_id}
                          </div>
                          <p className="mt-0.5 truncate text-[13px] text-slate-600">{c.relevance}</p>
                        </div>
                        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
                      </summary>
                      {entry && <p className="border-t border-indigo-100 px-4 py-3 text-[13px] leading-relaxed text-slate-600">{entry.text}</p>}
                    </details>
                  );
                })}
              </div>
            </SectionCard>
          )}

          {/* Report details */}
          <SectionCard icon={FileText} title={t.rs_details_t}>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              {[
                [t.rs_engine, result.pipeline_meta?.model ?? "—"],
                [t.rs_took, `${(result.processing_ms / 1000).toFixed(1)} ${t.rs_seconds}`],
                [t.rs_chars, result.pipeline_meta?.notice_chars?.toLocaleString() ?? "—"],
                [t.rs_corpus, `${result.pipeline_meta?.corpus_size ?? 0}`],
                [
                  t.rs_safety,
                  result.pipeline_meta?.safety_edits?.length
                    ? `${result.pipeline_meta.safety_edits.length} ✓`
                    : t.rs_safety_none,
                ],
                [t.rs_card_from, `${a.sender.name} (${a.sender.type})`],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{k}</dt>
                  <dd className="mt-0.5 truncate font-medium text-slate-800" title={String(v)}>{v}</dd>
                </div>
              ))}
            </dl>
            {result.pipeline_meta?.safety_edits && result.pipeline_meta.safety_edits.length > 0 && (
              <ul className="mt-4 space-y-1 rounded-lg bg-slate-50 p-3">
                {result.pipeline_meta.safety_edits.map((e, i) => (
                  <li key={i} className="font-mono text-[11px] text-slate-500">✓ {e}</li>
                ))}
              </ul>
            )}

            {/* Original notice */}
            <div className="mt-5 border-t border-slate-100 pt-4">
              <button
                onClick={() => setShowOriginal((v) => !v)}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700 hover:text-indigo-800"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${showOriginal ? "rotate-180" : ""}`} />
                {t.rs_original}
              </button>
              {showOriginal && (
                <div className="mt-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{t.rs_original_t}</div>
                  <pre className="font-legal custom-scroll max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-[13.5px] leading-relaxed text-slate-800">
                    {result.draft.text}
                  </pre>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Red-severity lawyer CTA */}
          {sev === "red" && (
            <div className="print-card rounded-2xl border-2 border-red-300 bg-gradient-to-br from-red-50 to-white p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
                  <Siren className="h-6 w-6" />
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-red-800">{t.rs_red_t}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-red-700">{t.rs_red_d}</p>
                </div>
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="print-card rounded-2xl border border-slate-200 bg-slate-50/80 p-5 text-center">
            <p className="mx-auto max-w-2xl text-xs leading-relaxed text-slate-500">{t.rs_disclaimer}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResultPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
        </div>
      }
    >
      <ResultInner />
    </Suspense>
  );
}
