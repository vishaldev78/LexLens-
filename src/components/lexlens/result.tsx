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
  UserRound,
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
  danger: "bg-red-500/15 text-red-300 ring-1 ring-red-500/40",
  warn: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/40",
  ok: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40",
  muted: "bg-white/5 text-slate-400 ring-1 ring-white/10",
};

function StatCard({
  icon: Icon,
  label,
  children,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className={`h-3.5 w-3.5 ${accent ?? "text-slate-400"}`} />
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-500">
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
      className="inline-flex items-center gap-1 rounded-md bg-indigo-500/10 px-1.5 py-0.5 font-mono text-[10.5px] text-indigo-300 ring-1 ring-indigo-500/30 cursor-help"
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
      block.next_steps.length ? `\nNext steps:\n${block.next_steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}` : "",
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
    toast({ title: "Structured JSON exported", description: "The exact pipeline output — ready for a lawyer or an API." });
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
          className={`col-span-2 lg:col-span-1 rounded-xl border border-white/10 p-4 ring-1 ${sev.ring} ${sev.bg}`}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <span className={`h-2 w-2 rounded-full ${sev.dot} animate-pulse`} />
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Severity
            </span>
          </div>
          <p className={`text-xl font-bold tracking-tight ${sev.text}`}>{sev.label}</p>
          <p className="mt-1 text-[11px] leading-snug text-slate-400">{sev.blurb}</p>
        </div>

        <StatCard icon={BadgeCheck} label="Confidence" accent="text-indigo-300">
          <p className="font-mono text-xl font-bold text-slate-100">
            {(a.overall_confidence * 100).toFixed(0)}%
          </p>
          <p className="mt-1 text-[11px] leading-snug text-slate-500">
            {lowConfidence ? "Below 75% gate — lawyer banner on" : "Above gating threshold"}
          </p>
        </StatCard>

        <StatCard icon={Tags} label="Notice type" accent="text-indigo-300">
          <p className="text-sm font-semibold text-slate-100 leading-snug">
            {NOTICE_TYPE_LABELS[a.notice_type] ?? a.notice_type}
          </p>
          <p className="mt-1 font-mono text-[11px] text-slate-500">{a.notice_type}</p>
        </StatCard>

        <StatCard icon={Globe2} label="Jurisdiction" accent="text-indigo-300">
          <p className="text-sm font-semibold text-slate-100 leading-snug truncate" title={a.jurisdiction.region}>
            {a.jurisdiction.country}
            {a.jurisdiction.region ? ` · ${a.jurisdiction.region}` : ""}
          </p>
          <p className="mt-1 font-mono text-[11px] text-slate-500">
            match {(a.jurisdiction.confidence * 100).toFixed(0)}%
          </p>
        </StatCard>

        <StatCard icon={Languages} label="Notice language" accent="text-indigo-300">
          <p className="text-sm font-semibold text-slate-100 leading-snug">
            {LANGUAGE_NAMES[a.language_detected] ?? a.language_detected}
          </p>
          <p className="mt-1 font-mono text-[11px] text-slate-500">
            output: EN · हिं · ES
          </p>
        </StatCard>
      </div>

      {/* ── Safety banners ─────────────────────────────────────── */}
      {lowConfidence && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <p className="text-[13px] leading-relaxed text-amber-200">
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
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="flex items-center gap-2 text-[15px] font-semibold text-slate-100">
                <Scale className="h-4 w-4 text-indigo-300" />
                What this notice means
              </h3>
              <div
                role="tablist"
                aria-label="Output language"
                className="flex items-center rounded-lg border border-white/10 bg-black/30 p-1"
              >
                {(Object.keys(LOCALE_LABELS) as Locale[]).map((l) => (
                  <button
                    key={l}
                    role="tab"
                    aria-selected={locale === l}
                    onClick={() => setLocale(l)}
                    className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-all ${
                      locale === l
                        ? "bg-indigo-500/25 text-indigo-200 ring-1 ring-indigo-400/40"
                        : "text-slate-400 hover:text-slate-200"
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
              className={`text-[14.5px] leading-relaxed text-slate-200 ${
                locale === "hi" ? "lang-hi text-[15.5px]" : ""
              }`}
            >
              {block.summary || "—"}
            </motion.p>

            {block.key_risk && (
              <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-500/25 bg-red-500/[0.08] p-3">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <p lang={locale} className={`text-[13px] leading-relaxed text-red-200 ${locale === "hi" ? "lang-hi" : ""}`}>
                  <span className="font-semibold">Key risk: </span>
                  {block.key_risk}
                </p>
              </div>
            )}
          </section>

          {/* Deadlines */}
          {a.deadlines.length > 0 && (
            <section className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-5 sm:p-6">
              <h3 className="flex items-center gap-2 text-[15px] font-semibold text-slate-100 mb-4">
                <Clock3 className="h-4 w-4 text-amber-300" />
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
                      className="rounded-xl border border-white/10 bg-black/25 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-[13.5px] font-semibold text-slate-100">
                          <ArrowRight className="h-3.5 w-3.5 text-indigo-300" />
                          {d.action}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold ${TONE_CLASS[dl.tone]}`}
                        >
                          {dl.text}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-slate-400">
                        {d.date && (
                          <span>
                            target date: <span className="text-slate-200">{formatDate(d.date, locale)}</span>
                          </span>
                        )}
                        {d.legal_basis_source_id && (
                          <CitationChip sourceId={d.legal_basis_source_id} />
                        )}
                      </div>
                      {d.consequence_if_missed && (
                        <p className="mt-2 text-[12.5px] leading-relaxed text-amber-200/90">
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
            <section className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-5 sm:p-6">
              <h3 className="flex items-center gap-2 text-[15px] font-semibold text-slate-100 mb-4">
                <HandCoins className="h-4 w-4 text-emerald-300" />
                What they demand
              </h3>
              <div className="space-y-3">
                {a.demands.map((dm, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-white/10 bg-black/25 p-4"
                  >
                    <p className="text-[13.5px] leading-relaxed text-slate-200 max-w-[65%]">{dm.demand}</p>
                    {dm.amount !== null && (
                      <p className="font-mono text-lg font-bold text-emerald-300">
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
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-5 sm:p-6">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold text-slate-100 mb-3">
              <UserRound className="h-4 w-4 text-indigo-300" />
              Who sent it
            </h3>
            <p className="text-[14px] font-semibold text-slate-100">{a.sender.name}</p>
            <p className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-white/5 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-slate-400 ring-1 ring-white/10">
              <Landmark className="h-3 w-3" />
              {a.sender.type.replace(/_/g, " ")}
            </p>
          </section>

          {/* Rights */}
          {block.rights.length > 0 && (
            <section className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-5 sm:p-6">
              <h3 className="flex items-center gap-2 text-[15px] font-semibold text-slate-100 mb-4">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                Your rights
              </h3>
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1 custom-scroll">
                {block.rights.map((r, i) => (
                  <motion.div
                    key={`${locale}-${i}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    lang={locale}
                    className="rounded-xl border border-white/10 bg-black/25 p-3.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <p className="text-[13px] font-semibold text-slate-100">{r.title}</p>
                      {r.source_id && <CitationChip sourceId={r.source_id} />}
                    </div>
                    <p className={`text-[12.5px] leading-relaxed text-slate-400 ${locale === "hi" ? "lang-hi" : ""}`}>{r.detail}</p>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* Next steps */}
          {block.next_steps.length > 0 && (
            <section className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-5 sm:p-6">
              <h3 className="flex items-center gap-2 text-[15px] font-semibold text-slate-100 mb-4">
                <ArrowRight className="h-4 w-4 text-indigo-300" />
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
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-indigo-500/20 font-mono text-[11px] font-bold text-indigo-300 ring-1 ring-indigo-400/40">
                      {i + 1}
                    </span>
                    <span className={`text-[13px] leading-relaxed text-slate-300 ${locale === "hi" ? "lang-hi" : ""}`}>{s}</span>
                  </motion.li>
                ))}
              </ol>
            </section>
          )}

          {/* Corpus citations */}
          {a.citations.length > 0 && (
            <section className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-5 sm:p-6">
              <h3 className="flex items-center gap-2 text-[15px] font-semibold text-slate-100 mb-1">
                <BookOpenCheck className="h-4 w-4 text-indigo-300" />
                Corpus citations
              </h3>
              <p className="mb-3 font-mono text-[10.5px] uppercase tracking-widest text-slate-500">
                RAG-verified · model may only cite these
              </p>
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1 custom-scroll">
                {a.citations.map((c, i) => {
                  const entry = findCitation(c.source_id);
                  if (!entry) return null;
                  return (
                    <details key={i} className="group rounded-xl border border-white/10 bg-black/25 p-3.5">
                      <summary className="cursor-pointer list-none">
                        <span className="font-mono text-[10.5px] text-indigo-300 ring-1 ring-indigo-500/30 rounded-md bg-indigo-500/10 px-1.5 py-0.5">
                          {c.source_id}
                        </span>
                        <span className="ml-2 text-[12.5px] font-semibold text-slate-200 group-open:text-indigo-200">
                          {entry.title}
                        </span>
                      </summary>
                      <p className="mt-2 border-t border-white/10 pt-2 font-serif text-[12px] leading-relaxed text-slate-400">
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-red-500/30 bg-gradient-to-r from-red-500/15 to-transparent p-5">
          <div className="flex items-start gap-3">
            <Gavel className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
            <div>
              <p className="text-[14px] font-semibold text-red-200">This case looks urgent.</p>
              <p className="text-[12.5px] text-red-200/80">
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
            className="shrink-0 rounded-lg bg-red-500/90 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-red-500"
          >
            Talk to a vetted lawyer
          </button>
        </div>
      )}

      {/* ── Pipeline meta + actions ─────────────────────────────── */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] text-slate-500">
          <span>
            <span className="text-slate-300">{result.processing_ms}</span> ms end-to-end
          </span>
          <span>
            corpus <span className="text-slate-300">{result.pipeline_meta.corpus_size}</span> statutes ·
            versioned
          </span>
          <span>
            engine <span className="text-slate-300">{result.pipeline_meta.model}</span>
          </span>
          {result.pipeline_meta.safety_edits.length > 0 ? (
            <span className="inline-flex items-center gap-1 text-amber-400/90">
              <ShieldCheck className="h-3 w-3" />
              {result.pipeline_meta.safety_edits.length} safety edit
              {result.pipeline_meta.safety_edits.length === 1 ? "" : "s"} applied
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-emerald-400/90">
              <ShieldCheck className="h-3 w-3" />
              safety pass clean
            </span>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <button
            onClick={copySummary}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3.5 py-2 text-[12.5px] font-medium text-slate-200 transition hover:bg-white/10"
          >
            <Copy className="h-3.5 w-3.5" /> Copy summary
          </button>
          <button
            onClick={downloadJson}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3.5 py-2 text-[12.5px] font-medium text-slate-200 transition hover:bg-white/10"
          >
            <Download className="h-3.5 w-3.5" /> Export JSON
          </button>
          <button
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3.5 py-2 text-[12.5px] font-semibold text-white transition hover:bg-indigo-400"
          >
            Analyze another notice
          </button>
        </div>
      </div>

      {/* ── Disclaimer ──────────────────────────────────────────── */}
      <div className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-black/20 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
        <p className="text-[11.5px] leading-relaxed text-slate-500">
          LexLens provides <span className="text-slate-400 font-medium">legal information, not legal
          advice</span>. Analyses are machine-generated from a versioned statute corpus and may be
          incomplete. No attorney-client relationship is created. For decisions with legal
          consequences, consult a qualified lawyer in your jurisdiction.
        </p>
      </div>
    </motion.div>
  );
}

// local alias to avoid extra import noise
function Tags(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
      <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
    </svg>
  );
}
