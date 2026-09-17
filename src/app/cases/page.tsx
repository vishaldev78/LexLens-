"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock, FileText, ListChecks, Loader2, RotateCcw, Siren, Trash2 } from "lucide-react";
import { useLang } from "@/components/lexlens/language-provider";
import { deleteCase, listCases } from "@/lib/lexlens/run-store";
import { buildCaseView, money } from "@/lib/lexlens/case-engine";
import { todayISO } from "@/lib/lexlens/deadline-engine";
import type { CaseRecord, SeverityLevel } from "@/lib/lexlens/types";

const SEV_DOT: Record<SeverityLevel, string> = { red: "bg-red-500", yellow: "bg-amber-500", green: "bg-emerald-500" };

function CasesInner() {
  const { t, locale } = useLang();
  const tt = t as unknown as Record<string, string>;
  const [cases, setCases] = useState<CaseRecord[] | null>(null);

  useEffect(() => {
    setCases(listCases());
  }, []);

  function remove(id: string) {
    deleteCase(id);
    setCases(listCases());
  }

  if (cases === null) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const today = todayISO();

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-56 bg-gradient-to-b from-indigo-50/80 to-transparent" />
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{t.cs_title}</h1>
            <p className="mt-1.5 text-sm text-slate-500">{t.cs_sub}</p>
          </div>
          <Link href="/analyze" className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-indigo-700">
            <RotateCcw className="h-4 w-4" /> {t.nav_analyze}
          </Link>
        </div>

        {cases.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <FileText className="h-7 w-7" />
            </span>
            <h2 className="mt-4 text-lg font-bold text-slate-900">{t.cs_empty_t}</h2>
            <p className="mt-1.5 text-sm text-slate-500">{t.cs_empty_d}</p>
            <Link href="/analyze" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-indigo-700">
              {t.rs_notfound_cta}
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-3">
            {cases.map((c) => {
              const view = buildCaseView(c.base, c.user, locale, today);
              const calc = view.deadlines.find((d) => d.status === "calculated");
              const amountFact = view.facts.find((f) => f.key === "amount");
              const amount = amountFact?.value ?? (c.base.claims[0]?.amount != null ? money(c.base.claims[0].amount, c.base.claims[0].currency, locale) : null);
              const sev = c.base.severity.level as SeverityLevel;
              const days = calc?.days_left ?? null;
              return (
                <div key={c.id} className="group flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-indigo-200 sm:flex-row sm:items-center">
                  <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${SEV_DOT[sev]}`} aria-label={sev} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[15px] font-bold text-slate-900">{view.type_label}</h2>
                      {c.user.position && (
                        <span className="rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-indigo-600">
                          {tt.cs_position}: {t[`ps_${c.user.position}`]}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{c.label}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-slate-600">
                      {amount && (
                        <span className="inline-flex items-center gap-1 font-bold text-slate-800">
                          <ListChecks className="h-3.5 w-3.5 text-indigo-500" /> {amount}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5 text-indigo-500" />
                        {calc ? (
                          <span className={days !== null && days <= 7 ? "font-bold text-red-600" : ""}>
                            {calc.deadline}
                            {days !== null && (days < 0 ? ` · ${Math.abs(days)} ${tt.cs_overdue}` : ` · ${days} ${t.rs_days_left}`)}
                          </span>
                        ) : (
                          <span className="text-amber-700">{tt.cs_deadline_unknown}</span>
                        )}
                      </span>
                      {view.missing.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-amber-700">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {view.missing.length} {tt.cs_missing}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-slate-400">
                        <Siren className="h-3.5 w-3.5" />
                        {tt.cs_updated}: {new Date(c.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link href={`/result?id=${c.id}`} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700">
                      {t.cs_open}
                    </Link>
                    <button
                      onClick={() => remove(c.id)}
                      className="rounded-lg border border-slate-200 p-2 text-slate-400 opacity-0 transition-opacity hover:border-red-200 hover:text-red-500 group-hover:opacity-100"
                      aria-label={t.cs_remove}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CasesPage() {
  return <CasesInner />;
}
