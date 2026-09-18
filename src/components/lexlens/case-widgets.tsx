"use client";

// LexLens — case view widgets: Action Center, Timeline, Lawyer Brief, Draft.

import { CalendarClock, ChevronRight, Download, Gavel, HandCoins, ListChecks, Printer, Route, Scale, Siren, UserRound } from "lucide-react";
import { CitationChip, DeadlineCountdown, SectionCard, TimelineDot, WhyBox } from "@/components/lexlens/case-ui";
import { money } from "@/lib/lexlens/case-engine";
import type { Brief } from "@/lib/lexlens/case-engine";
import { CORPUS } from "@/lib/lexlens/corpus";
import type { CaseView, Locale, ActionItem } from "@/lib/lexlens/types";

type TT = Record<string, string>;

/* ───────────────────────── ACTION CENTER (FEATURE 1) ───────────────────────── */

export function ActionCenter({
  view,
  t,
  locale,
}: {
  view: CaseView;
  t: TT;
  locale: Locale;
}) {
  const { base, deadlines, actions, facts, missing } = view;
  const amountFact = facts.find((f) => f.key === "amount");
  const amount = amountFact?.value ?? (base.claims[0]?.amount !== undefined && base.claims[0]?.amount !== null ? money(base.claims[0].amount, base.claims[0].currency, locale) : null);
  const calc = deadlines.find((d) => d.status === "calculated");
  const blocked = deadlines.find((d) => d.status === "missing_input");
  const stated = base.stated_deadlines[0];
  const sev = base.severity.level;
  const receiptMissing = missing.some((m) => m.field === "receipt_date");

  return (
    <div className="print-card overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className={`flex items-center gap-2 border-b px-5 py-4 sm:px-6 ${sev === "red" ? "border-red-100 bg-red-50/70" : "border-slate-100 bg-slate-50/70"}`}>
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ring-1 ${sev === "red" ? "bg-red-100 text-red-600 ring-red-200" : "bg-amber-100 text-amber-700 ring-amber-200"}`}>
          <Siren className="h-5 w-5" />
        </span>
        <div>
          <h2 className={`text-base font-extrabold tracking-tight ${sev === "red" ? "text-red-800" : "text-slate-900"}`}>{t.ac_title}</h2>
          <p className="text-xs text-slate-500">{t.ac_sub}</p>
        </div>
        {sev === "red" && (
          <span className="ml-auto hidden items-center gap-1.5 rounded-full border border-red-200 bg-white px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-red-700 sm:inline-flex">
            <span className="h-2 w-2 rounded-full bg-red-500" /> {t.sev_red}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 divide-slate-100 border-b border-slate-100 sm:grid-cols-4 sm:divide-x">
        <div className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t.ac_amount}</div>
          <div className="mt-1 flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <HandCoins className="h-4 w-4 text-indigo-500" />
            {amount ?? t.ac_not_provided}
          </div>
        </div>
        <div className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t.rs_card_type}</div>
          <div className="mt-1 flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <Scale className="h-4 w-4 text-indigo-500" />
            {view.type_label}
          </div>
        </div>
        <div className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t.ac_receipt}</div>
          <div className={`mt-1 text-sm font-bold ${receiptMissing ? "text-amber-700" : "text-slate-900"}`}>
            {receiptMissing ? `⚠ ${t.ac_not_provided}` : "✓ " + (facts.find((f) => f.key === "receipt_date")?.value ?? "")}
          </div>
        </div>
        <div className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t.ac_deadline_exact}</div>
          <div className={`mt-1 text-sm font-bold ${calc ? "text-slate-900" : "text-amber-700"}`}>
            {calc ? `✓ ${calc.deadline}` : `⚠ ${t.ac_cannot_calc}`}
          </div>
        </div>
      </div>

      <div className="px-5 py-5 sm:px-6">
        {/* response period line */}
        {(stated || blocked) && (
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-[13px] leading-relaxed text-slate-700">
            <span className="font-bold text-slate-900">{t.ac_period}: </span>
            {calc ? calc.description : blocked?.missing_reason ?? stated?.description}
          </div>
        )}

        <h3 className="text-sm font-bold text-slate-900">{t.ac_next}</h3>
        <ol className="mt-3 space-y-0">
          {actions.map((a, i) => (
            <ActionRow key={a.key} action={a} index={i} last={i === actions.length - 1} t={t} />
          ))}
        </ol>
      </div>
    </div>
  );
}

function ActionRow({ action: a, index, last, t }: { action: ActionItem; index: number; last: boolean; t: TT }) {
  return (
    <li className="relative flex gap-3.5 pb-4 last:pb-0">
      {!last && <span className="absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-0.5 bg-indigo-100" aria-hidden />}
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">{index + 1}</span>
      <div className="min-w-0 pt-0.5">
        <p className="text-sm font-bold leading-snug text-slate-900">{a.title}</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-slate-600">{a.reason}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-400">{t.ac_source}:</span>
          {a.source.source_id ? (
            <CitationChip sid={a.source.source_id} />
          ) : (
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">LexLens rule pack</span>
          )}
        </div>
      </div>
    </li>
  );
}

/* ───────────────────────── TIMELINE (FEATURE 4) ───────────────────────── */

export function TimelineView({ view, t, locale }: { view: CaseView; t: TT; locale: Locale }) {
  return (
    <ol className="relative space-y-0">
      {view.timeline.map((e, i) => {
        const last = i === view.timeline.length - 1;
        return (
          <li key={e.key} className="relative flex gap-4 pb-5 last:pb-0">
            {!last && <span className="absolute left-[5.5px] top-5 h-[calc(100%-1.25rem)] w-0.5 bg-slate-200" aria-hidden />}
            <TimelineDot status={e.status} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="text-[13px] font-bold uppercase tracking-wide text-slate-700">{e.label}</span>
                {e.date ? (
                  <span className="font-mono text-[13px] font-bold text-slate-900">{e.date}</span>
                ) : (
                  <span className="text-[13px] font-semibold text-amber-700">⚠ {t.tl_unknown}</span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                {e.status === "requires_input" && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 font-bold text-amber-700">
                    <UserRound className="h-3 w-3" /> {t.tl_input_required}
                  </span>
                )}
                {e.status !== "requires_input" && (
                  <span className={`rounded-md border px-2 py-0.5 font-semibold ${
                    e.source.kind === "user_input"
                      ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                      : e.source.kind === "derived"
                        ? "border-violet-200 bg-violet-50 text-violet-700"
                        : "border-slate-200 bg-slate-50 text-slate-600"
                  }`}>
                    {e.source.kind === "user_input" ? t.tl_user : e.source.kind === "derived" ? t.tl_calc : t.tl_doc}
                    {e.source.ref ? ` · ${e.source.ref}` : ""}
                  </span>
                )}
                {e.status === "confirmed" && <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">✓ {t.tl_confirmed}</span>}
                {e.status === "estimated" && <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-semibold text-slate-500">{t.tl_estimated}</span>}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ───────────────────────── LAWYER BRIEF (FEATURE 12) ───────────────────────── */

export function BriefView({
  brief,
  t,
  locale,
  onPrint,
  onDownload,
}: {
  brief: Brief;
  t: TT;
  locale: Locale;
  onPrint: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="rounded-xl border-2 border-indigo-100 bg-white p-5 sm:p-7">
      <div className="border-b-2 border-slate-900 pb-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-slate-900">
            <Gavel className="h-5 w-5 text-indigo-600" /> {t.br_title}
          </h3>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-400">LexLens</span>
        </div>
      </div>

      <div className="mt-3 divide-y divide-slate-100">
        <BriefRow k={t.br_matter} v={brief.matter} />
        <BriefRow k={t.br_jur} v={brief.jurisdiction} />
        <BriefRow k={t.br_claimant} v={brief.claimant} />
        {brief.recipient && <BriefRow k={t.br_recipient} v={brief.recipient} />}
        <BriefRow k={t.br_amount} v={brief.amount ?? "—"} />
        <BriefRow
          k={t.br_dates}
          v={
            brief.important_dates.length ? (
              <ul className="space-y-0.5">
                {brief.important_dates.map((d, i) => (
                  <li key={i}>
                    {d.label}: <span className="font-mono">{d.value}</span>{" "}
                    <span className="text-[11px] text-slate-400">({d.source})</span>
                  </li>
                ))}
              </ul>
            ) : (
              "—"
            )
          }
        />
        <BriefRow
          k={t.br_prov}
          v={
            brief.provisions.length ? (
              <div className="flex flex-wrap gap-1.5">
                {brief.provisions.map((p, i) => (
                  <CitationChip key={i} sid={p.title} />
                ))}
              </div>
            ) : (
              "—"
            )
          }
        />
        <BriefRow k={t.br_deadline} v={brief.deadline} />
        <BriefRow k={t.br_position} v={brief.position ?? "—"} />
      </div>

      <div className="mt-4 grid gap-5 border-t border-slate-100 pt-4 sm:grid-cols-2">
        <div>
          <h4 className="text-xs font-extrabold uppercase tracking-wide text-emerald-700">{t.br_facts_v}</h4>
          <div className="mt-2"><BriefList items={brief.verified_facts} mark="ok" /></div>
        </div>
        <div>
          <h4 className="text-xs font-extrabold uppercase tracking-wide text-amber-700">{t.br_facts_u}</h4>
          <div className="mt-2"><BriefList items={brief.unverified_facts} mark="warn" /></div>
        </div>
        <div>
          <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-700">{t.br_ev_a}</h4>
          <div className="mt-2"><BriefList items={brief.evidence_available} mark="ok" /></div>
        </div>
        <div>
          <h4 className="text-xs font-extrabold uppercase tracking-wide text-amber-700">{t.br_ev_m}</h4>
          <div className="mt-2"><BriefList items={brief.evidence_missing} mark="warn" /></div>
        </div>
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-700">{t.br_questions}</h4>
        <ol className="mt-2 space-y-1.5">
          {brief.questions.map((q, i) => (
            <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-slate-800">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">{i + 1}</span>
              {q}
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-5 rounded-lg bg-amber-50 px-3.5 py-2.5 text-[12px] font-medium leading-relaxed text-amber-800 ring-1 ring-amber-200">
        ⚠ {brief.warning[locale]}
      </div>

      <div className="no-print mt-4 flex flex-wrap gap-2">
        <button onClick={onPrint} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700">
          <Printer className="h-3.5 w-3.5" /> {t.br_print}
        </button>
        <button onClick={onDownload} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700">
          <Download className="h-3.5 w-3.5" /> {t.br_download}
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────── brief sub-components (module scope) ───────────────────────── */

function BriefRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(120px,160px)_1fr] gap-3 py-1.5 text-[13px]">
      <span className="font-semibold text-slate-500">{k}</span>
      <span className="font-medium text-slate-900">{v}</span>
    </div>
  );
}

function BriefList({ items, mark }: { items: string[]; mark: "ok" | "warn" }) {
  if (!items.length) return <p className="text-[13px] text-slate-400">—</p>;
  return (
    <ul className="space-y-1">
      {items.map((x, i) => (
        <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-slate-700">
          <span className={mark === "ok" ? "text-emerald-600" : "text-amber-500"}>{mark === "ok" ? "✓" : "⚠"}</span>
          {x}
        </li>
      ))}
    </ul>
  );
}

/* ───────────────────────── helpers used by the page ───────────────────────── */

export { SectionCard, CalendarClock, ChevronRight, ListChecks, Route };
