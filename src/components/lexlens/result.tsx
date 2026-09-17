"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Clock3,
  Copy,
  Download,
  Gavel,
  Globe2,
  HandCoins,
  Info,
  Landmark,
  Languages,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Tags,
  UserRound,
  WifiOff,
} from "lucide-react";
import {
  LANGUAGE_NAMES,
  LOCALE_LABELS,
  NOTICE_TYPE_LABELS,
  SEVERITY_META,
  type Analysis,
  type AnalyzeResponse,
  type Locale,
} from "@/lib/lexlens/types";
import { findCitation } from "@/lib/lexlens/corpus";
import { useToast } from "@/hooks/use-toast";

const INTL_LOCALE: Record<Locale, string> = { en: "en-US", hi: "en-IN", es: "es-ES" };

function formatAmount(amount: number, currency: string | null, locale: Locale): string {
  try {
    if (currency && ["USD", "INR", "EUR", "GBP"].includes(currency)) {
      return new Intl.NumberFormat(INTL_LOCALE[locale], {
        style: "currency",
        currency,
        maximumFractionDigits: currency === "INR" ? 0 : 2,
      }).format(amount);
    }
    return new Intl.NumberFormat(INTL_LOCALE[locale], { maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency ?? ""} ${amount}`.trim();
  }
}

function formatDate(iso: string, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${iso}T00:00:00Z`));
  } catch {
    return iso;
  }
}

function daysLabel(days: number | null): { text: string; tone: "danger" | "warn" | "ok" | "muted" } {
  if (days === null) return { text: "date unstated", tone: "muted" };
  if (days < 0) return { text: `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`, tone: "danger" };
  if (days === 0) return { text: "due today", tone: "danger" };
  if (days <= 7) return { text: `${days} day${days === 1 ? "" : "s"} left`, tone: "warn" };
  return { text: `${days} days left`, tone: "ok" };
}

const TONE_CLASS: Record<string, string> = {
  danger: "bg-red-50 text-red-700 ring-1 ring-red-200",
  warn: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  ok: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  muted: "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
};

function StatCard({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-indigo-500" />
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function CitationChip({ sourceId }: { sourceId: string }) {
  const entry = findCitation(sourceId);
  return (
    <span
      title={entry ? `${entry.title} — ${entry.text}` : sourceId}
      className="inline-flex cursor-help items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-indigo-700"
    >
      <BookOpenCheck className="h-3 w-3" />
      {sourceId}
    </span>
  );
}

export function ResultDashboard({
  result,
  onReset,
}: {
  result: AnalyzeResponse;
  onReset: () => void;
}) {
  const { toast } = useToast();
  const a = result.analysis!;
  const [locale, setLocale] = useState<Locale>("en");
  const block = a.localized[locale];
  const sev = SEVERITY_META[a.severity.level];
  const lowConfidence = a.overall_confidence < 0.75;

  const copySummary = async () => {
    const text = [
      `LexLens — plain-language summary (${LOCALE_LABELS[locale].label})`,
      "",
      block.summary,
      block.key_risk ? `\nKey risk: ${block.key_risk}` : "",
      block.next_steps.length
        ? `\nNext steps:\n${block.next_steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
        : "",
      "",
      "LexLens provides legal information, not legal advice.",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Summary copied", description: "Paste it anywhere — WhatsApp, email, your lawyer." });
    } catch {
      toast({ title: "Copy failed", description: "Your browser blocked clipboard access." });
    }
  };

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lexlens-analysis-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Structured JSON exported",
      description: "The exact pipeline output — ready for a lawyer or an API.",
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="space-y-4"
    >
      {/* ── Stat strip ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div
          className={`col-span-2 rounded-xl border p-4 shadow-sm lg:col-span-1 ${sev.border} ${sev.bg}`}
        >
          <div className="mb-2 flex items-center gap-1.5">
            <span className={`h-2 w-2 animate-pulse rounded-full ${sev.dot}`} />
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Severity
            </span>
          </div>
          <p className={`text-xl font-bold tracking-tight ${sev.text}`}>{sev.label}</p>
          <p className="mt-1 text-[11px] leading-snug text-slate-500">{sev.blurb}</p>
        </div>

        <StatCard icon={BadgeCheck} label="Confidence">
          <p className="font-mono text-xl font-bold text-slate-900">
            {(a.overall_confidence * 100).toFixed(0)}%
          </p>
          <p className="mt-1 text-[11px] leading-snug text-slate-500">
            {lowConfidence ? "Below 75% gate — lawyer banner on" : "Above gating threshold"}
          </p>
        </StatCard>

        <StatCard icon={Tags} label="Notice type">
          <p className="text-sm font-semibold leading-snug text-slate-900">
            {NOTICE_TYPE_LABELS[a.notice_type] ?? a.notice_type}
          </p>
          <p className="mt-1 font-mono text-[11px] text-slate-400">{a.notice_type}</p>
        </StatCard>

        <StatCard icon={Globe2} label="Jurisdiction">
          <p
            className="truncate text-sm font-semibold leading-snug text-slate-900"
            title={a.jurisdiction.region}
          >
            {a.jurisdiction.country}
            {a.jurisdiction.region ? ` · ${a.jurisdiction.region}` : ""}
          </p>
          <p className="mt-1 font-mono text-[11px] text-slate-400">
            match {(a.jurisdiction.confidence * 100).toFixed(0)}%
          </p>
        </StatCard>

        <StatCard icon={Languages} label="Notice language">
          <p className="text-sm font-semibold leading-snug text-slate-900">
            {LANGUAGE_NAMES[a.language_detected] ?? a.language_detected}
          </p>
          <p className="mt-1 font-mono text-[11px] text-slate-400">output: EN · हिं · ES</p>
        </StatCard>
      </div>

      {/* ── Safety banners ─────────────────────────────────────── */}
      {lowConfidence && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-[13px] leading-relaxed text-amber-800">
            <span className="font-semibold">AI is uncertain about this document.</span> Confidence
            fell below the 75% gate, so the auto-drafted response is disabled. Please consult a
            qualified lawyer before acting.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* ── Left column ──────────────────────────────────────── */}
        <div className="space-y-4 lg:col-span-7">
          {/* Summary with language switcher */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
                <Scale className="h-4 w-4 text-indigo-500" />
                What this notice means
              </h3>
              <div
                role="tablist"
                aria-label="Output language"
                className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1"
              >
                {(Object.keys(LOCALE_LABELS) as Locale[]).map((l) => (
                  <button
                    key={l}
                    role="tab"
                    aria-selected={locale === l}
                    onClick={() => setLocale(l)}
                    className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-all ${
                      locale === l
                        ? "bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-200"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {LOCALE_LABELS[l].label}
                  </button>
                ))}
              </div>
            </div>

            <motion.p
              key={locale}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              lang={locale}
              className={`text-[14.5px] leading-relaxed text-slate-700 ${
                locale === "hi" ? "lang-hi text-[15.5px]" : ""
              }`}
            >
              {block.summary || "—"}
            </motion.p>

            {block.key_risk && (
              <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <p
                  lang={locale}
                  className={`text-[13px] leading-relaxed text-red-800 ${locale === "hi" ? "lang-hi" : ""}`}
                >
                  <span className="font-semibold">Key risk: </span>
                  {block.key_risk}
                </p>
              </div>
            )}
          </section>

          {/* Deadlines */}
          {a.deadlines.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-900">
                <Clock3 className="h-4 w-4 text-amber-500" />
                Deadlines & consequences
              </h3>
              <div className="space-y-3">
                {a.deadlines.map((d, i) => {
                  const dl = daysLabel(d.days_from_today);
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-[13.5px] font-semibold text-slate-900">
                          <ArrowRight className="h-3.5 w-3.5 text-indigo-500" />
                          {d.action}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold ${TONE_CLASS[dl.tone]}`}
                        >
                          {dl.text}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-slate-500">
                        {d.date && (
                          <span>
                            target date: <span className="font-medium text-slate-700">{formatDate(d.date, locale)}</span>
                          </span>
                        )}
                        {d.legal_basis_source_id && <CitationChip sourceId={d.legal_basis_source_id} />}
                      </div>
                      {d.consequence_if_missed && (
                        <p className="mt-2 text-[12.5px] leading-relaxed text-amber-800">
                          <span className="font-semibold">If missed: </span>
                          {d.consequence_if_missed}
                        </p>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Demands */}
          {a.demands.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-900">
                <HandCoins className="h-4 w-4 text-emerald-500" />
                What they demand
              </h3>
              <div className="space-y-3">
                {a.demands.map((dm, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <p className="max-w-[65%] text-[13.5px] leading-relaxed text-slate-700">{dm.demand}</p>
                    {dm.amount !== null && (
                      <p className="font-mono text-lg font-bold text-emerald-700">
                        {formatAmount(dm.amount, dm.currency, locale)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ── Right column ─────────────────────────────────────── */}
        <div className="space-y-4 lg:col-span-5">
          {/* Sender */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h3 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-slate-900">
              <UserRound className="h-4 w-4 text-indigo-500" />
              Who sent it
            </h3>
            <p className="text-[14px] font-semibold text-slate-900">{a.sender.name}</p>
            <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-slate-500">
              <Landmark className="h-3 w-3" />
              {a.sender.type.replace(/_/g, " ")}
            </p>
          </section>

          {/* Rights */}
          {block.rights.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-900">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Your rights
              </h3>
              <div className="custom-scroll max-h-72 space-y-3 overflow-y-auto pr-1">
                {block.rights.map((r, i) => (
                  <motion.div
                    key={`${locale}-${i}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    lang={locale}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3.5"
                  >
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <p className={`text-[13px] font-semibold text-slate-900 ${locale === "hi" ? "lang-hi" : ""}`}>{r.title}</p>
                      {r.source_id && <CitationChip sourceId={r.source_id} />}
                    </div>
                    <p className={`text-[12.5px] leading-relaxed text-slate-600 ${locale === "hi" ? "lang-hi" : ""}`}>{r.detail}</p>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* Next steps */}
          {block.next_steps.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-900">
                <ArrowRight className="h-4 w-4 text-indigo-500" />
                Your action plan
              </h3>
              <ol className="space-y-2.5">
                {block.next_steps.map((s, i) => (
                  <motion.li
                    key={`${locale}-${i}`}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    lang={locale}
                    className="flex items-start gap-3"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-indigo-50 font-mono text-[11px] font-bold text-indigo-700 ring-1 ring-indigo-200">
                      {i + 1}
                    </span>
                    <span className={`text-[13px] leading-relaxed text-slate-700 ${locale === "hi" ? "lang-hi" : ""}`}>{s}</span>
                  </motion.li>
                ))}
              </ol>
            </section>
          )}

          {/* Corpus citations */}
          {a.citations.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
                <BookOpenCheck className="h-4 w-4 text-indigo-500" />
                Corpus citations
              </h3>
              <p className="mb-3 font-mono text-[10.5px] uppercase tracking-widest text-slate-400">
                RAG-verified · model may only cite these
              </p>
              <div className="custom-scroll max-h-64 space-y-3 overflow-y-auto pr-1">
                {a.citations.map((c, i) => {
                  const entry = findCitation(c.source_id);
                  if (!entry) return null;
                  return (
                    <details key={i} className="group rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                      <summary className="cursor-pointer list-none">
                        <span className="rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-indigo-700">
                          {c.source_id}
                        </span>
                        <span className="ml-2 text-[12.5px] font-semibold text-slate-800 group-open:text-indigo-700">
                          {entry.title}
                        </span>
                      </summary>
                      <p className="mt-2 border-t border-slate-200 pt-2 font-serif text-[12px] leading-relaxed text-slate-600">
                        {entry.text}
                      </p>
                      <p className="mt-1.5 text-[11.5px] italic text-slate-500">Why it applies: {c.relevance}</p>
                    </details>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* ── Lawyer CTA (red severity) ───────────────────────────── */}
      {a.severity.level === "red" && (
        <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <Gavel className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <p className="text-[14px] font-semibold text-red-800">This case looks urgent.</p>
              <p className="text-[12.5px] text-red-700">
                LexLens never suggests ignoring a critical notice — hand off to a vetted lawyer
                (marketplace ships in P1).
              </p>
            </div>
          </div>
          <button
            onClick={() =>
              toast({
                title: "Lawyer handoff — P1 preview",
                description: "Vetted-lawyer marketplace with commission split lands one month post-launch.",
              })
            }
            className="shrink-0 rounded-lg bg-red-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-red-700"
          >
            Talk to a vetted lawyer
          </button>
        </div>
      )}

      {/* ── Pipeline meta + actions ─────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] text-slate-500">
          <span>
            <span className="font-semibold text-slate-700">{result.processing_ms}</span> ms end-to-end
          </span>
          <span>
            corpus <span className="font-semibold text-slate-700">{result.pipeline_meta.corpus_size}</span> statutes · versioned
          </span>
          <span>
            engine <span className="font-semibold text-slate-700">{result.pipeline_meta.model}</span>
          </span>
          {result.pipeline_meta.fallback ? (
            <span className="inline-flex items-center gap-1 text-amber-600" title="LLM backend unreachable — offline rule engine used. Full accuracy returns when the API is reachable.">
              <WifiOff className="h-3 w-3" />
              offline engine (LLM unreachable)
            </span>
          ) : result.pipeline_meta.safety_edits.length > 0 ? (
            <span className="inline-flex items-center gap-1 text-amber-600">
              <ShieldCheck className="h-3 w-3" />
              {result.pipeline_meta.safety_edits.length} safety edit
              {result.pipeline_meta.safety_edits.length === 1 ? "" : "s"} applied
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-emerald-600">
              <ShieldCheck className="h-3 w-3" />
              safety pass clean
            </span>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <button
            onClick={copySummary}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-[12.5px] font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <Copy className="h-3.5 w-3.5" /> Copy summary
          </button>
          <button
            onClick={downloadJson}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-[12.5px] font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" /> Export JSON
          </button>
          <button
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            Analyze another notice
          </button>
        </div>
      </div>

      {/* ── Disclaimer ──────────────────────────────────────────── */}
      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <p className="text-[11.5px] leading-relaxed text-slate-500">
          LexLens provides <span className="font-medium text-slate-600">legal information, not legal
          advice</span>. Analyses are machine-generated from a versioned statute corpus and may be
          incomplete. No attorney-client relationship is created. For decisions with legal
          consequences, consult a qualified lawyer in your jurisdiction.
        </p>
      </div>
    </motion.div>
  );
}
