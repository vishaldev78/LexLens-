"use client";

// LexLens — shared case-view building blocks (clean legal-tech SaaS look).

import { useState } from "react";
import { BookOpenCheck, CalendarClock, CheckCircle2, ChevronDown, HelpCircle, Info, TriangleAlert } from "lucide-react";
import { CORPUS } from "@/lib/lexlens/corpus";
import { fmtISO } from "@/lib/lexlens/case-engine";
import type { Locale, UrgencyLevel } from "@/lib/lexlens/types";

export function SectionCard({
  icon: Icon,
  title,
  sub,
  children,
  tone = "border-slate-200",
  id,
}: {
  icon: React.ElementType;
  title: string;
  sub?: string;
  children: React.ReactNode;
  tone?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`print-card rounded-2xl border ${tone} bg-white shadow-sm`}>
      <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div>
          <h2 className="text-base font-bold tracking-tight text-slate-900">{title}</h2>
          {sub && <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-slate-500">{sub}</p>}
        </div>
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}

/** Deadline urgency — text label + colour, never colour alone (FEATURE 3). */
export function urgencyOf(daysLeft: number | null): { level: UrgencyLevel; chip: string; dot: string } {
  if (daysLeft === null) return { level: "none", chip: "border-slate-200 bg-slate-50 text-slate-600", dot: "bg-slate-400" };
  if (daysLeft < 0) return { level: "critical", chip: "border-red-200 bg-red-50 text-red-700", dot: "bg-red-500" };
  if (daysLeft <= 7) return { level: "critical", chip: "border-red-200 bg-red-50 text-red-700", dot: "bg-red-500" };
  if (daysLeft <= 30) return { level: "urgent", chip: "border-amber-200 bg-amber-50 text-amber-700", dot: "bg-amber-500" };
  return { level: "upcoming", chip: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" };
}

export function urgencyLabel(level: UrgencyLevel, daysLeft: number | null, t: Record<string, string>): string {
  if (daysLeft !== null && daysLeft < 0) return `${Math.abs(daysLeft)} ${t.cs_overdue}`;
  switch (level) {
    case "critical": return daysLeft !== null && daysLeft >= 0 ? `${daysLeft} ${t.rs_days_left}` : t.rdl_urgency_critical;
    case "urgent": return `${daysLeft} ${t.rs_days_left}`;
    case "upcoming": return `${daysLeft} ${t.rs_days_left}`;
    default: return t.rdl_none;
  }
}

export function ConfidenceBar({ value, label }: { value: number; label: string }) {
  const pct = Math.round(value * 100);
  const tone = pct >= 85 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-red-400";
  return (
    <span className="inline-flex items-center gap-1.5" title={label}>
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-100">
        <span className={`block h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="font-mono text-[11px] text-slate-500">{pct}%</span>
    </span>
  );
}

export function SourceChip({ kind, refText, labels }: { kind: string; refText: string | null; labels: Record<string, string> }) {
  const map: Record<string, { label: string; cls: string }> = {
    document: { label: labels.fs_document, cls: "border-slate-200 bg-slate-50 text-slate-600" },
    user_input: { label: labels.fs_user, cls: "border-indigo-200 bg-indigo-50 text-indigo-700" },
    derived: { label: labels.tl_calc, cls: "border-violet-200 bg-violet-50 text-violet-700" },
    legal_corpus: { label: labels.lb_verified, cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    none: { label: "—", cls: "border-slate-200 bg-slate-50 text-slate-400" },
  };
  const meta = map[kind] ?? map.none;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${meta.cls}`}>
      {kind === "user_input" ? "✓" : kind === "derived" ? "=" : "▤"} {meta.label}
      {refText && <span className="font-normal opacity-80">· {refText}</span>}
    </span>
  );
}

export function CitationChip({ sid }: { sid: string }) {
  const entry = CORPUS.find((c) => c.source_id === sid);
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
      <BookOpenCheck className="h-3 w-3 shrink-0" />
      <span className="truncate">{entry ? entry.title : sid}</span>
    </span>
  );
}

/** Expandable "Why?" disclosure — source traceability (FEATURE 5). */
export function WhyBox({ children, label }: { children: React.ReactNode; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1.5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
      >
        <HelpCircle className="h-3.5 w-3.5" />
        {label}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-1.5 rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-[12px] leading-relaxed text-slate-700">
          {children}
        </div>
      )}
    </div>
  );
}

export function StatusBadge({ status, t }: { status: string; t: Record<string, string> }) {
  const map: Record<string, { label: string; cls: string }> = {
    document_verified: { label: t.kt_from_doc, cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    source_verified: { label: t.lb_verified, cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    user_confirmed: { label: t.kt_user, cls: "border-indigo-200 bg-indigo-50 text-indigo-700" },
    inferred: { label: t.fs_inferred, cls: "border-amber-200 bg-amber-50 text-amber-700" },
    unknown: { label: t.kt_missing, cls: "border-slate-200 bg-slate-50 text-slate-500" },
  };
  const m = map[status] ?? map.unknown;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ${m.cls}`}>
      {status === "document_verified" || status === "source_verified" ? <CheckCircle2 className="h-3 w-3" /> : status === "unknown" ? <Info className="h-3 w-3" /> : <TriangleAlert className="h-3 w-3" />}
      {m.label}
    </span>
  );
}

export function TimelineDot({ status }: { status: string }) {
  const cls =
    status === "confirmed" || status === "estimated"
      ? "bg-indigo-500 ring-indigo-100"
      : "bg-amber-400 ring-amber-100";
  return <span className={`mt-1 block h-3 w-3 shrink-0 rounded-full ring-4 ${cls}`} />;
}

export function fmtDateFor(iso: string | null, locale: Locale): string {
  if (!iso) return "—";
  return fmtISO(iso, locale);
}

export function DeadlineCountdown({ daysLeft, t }: { daysLeft: number | null; t: Record<string, string> }) {
  const u = urgencyOf(daysLeft);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-extrabold ${u.chip}`}>
      <CalendarClock className="h-3.5 w-3.5" />
      {urgencyLabel(u.level, daysLeft, t)}
    </span>
  );
}
