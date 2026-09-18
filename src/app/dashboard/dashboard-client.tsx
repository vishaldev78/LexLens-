"use client";

// LexLens — personal dashboard (local workspace).
// Countdowns come from the API as stored deadlineDate − today, so the
// dashboard is always current for "today" with no hard-coded numbers.

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  Landmark,
  LayoutDashboard,
  Loader2,
  Plus,
  Settings,
  Siren,
  UploadCloud,
} from "lucide-react";
import { useLang } from "@/components/lexlens/language-provider";
import { fmtDateFor } from "@/components/lexlens/case-ui";

type TT = Record<string, string>;

interface DeadlineCard {
  id: string;
  title: string;
  noticeType: string;
  severity: string;
  claimedAmount: string | null;
  currency: string | null;
  deadlineDate: string | null;
  status: string;
  daysRemaining: number | null;
  hasReport: boolean;
  missingReceipt: boolean;
}

interface RecentNotice {
  id: string;
  title: string;
  noticeType: string;
  severity: string;
  status: string;
  createdAt: string;
  hasReport: boolean;
}

interface DashboardData {
  user: { username: string };
  deadlines: DeadlineCard[];
  recentNotices: RecentNotice[];
  totalNotices: number;
  unreadNotifications: number;
  attention: number;
  today: string;
}

export function DashboardClient() {
  const { t, locale } = useLang();
  const tt = t as unknown as TT;
  const [data, setData] = useState<DashboardData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: DashboardData) => setData(d))
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-4 text-lg font-bold text-slate-900">{tt.cm_error}</h1>
        <p className="mt-2 text-sm text-slate-600">{tt.db_welcome_sub}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
      </div>
    );
  }

  const typeLabel = (nt: string) => tt[`nt_${nt}`] ?? nt;
  const countdown = (d: DeadlineCard) => {
    if (d.status === "DUE_TODAY") return { text: tt.db_due_today, cls: "bg-red-50 text-red-700 border-red-200" };
    if (d.daysRemaining !== null && d.daysRemaining === 1) return { text: tt.db_due_tomorrow, cls: "bg-red-50 text-red-700 border-red-200" };
    if (d.daysRemaining !== null && d.daysRemaining < 0)
      return { text: `${tt.db_overdue} · ${Math.abs(d.daysRemaining)}`, cls: "bg-red-50 text-red-700 border-red-200" };
    if (d.daysRemaining !== null)
      return { text: `${d.daysRemaining} ${tt.db_days_left}`, cls: d.daysRemaining <= 7 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200" };
    return { text: tt.db_unknown_dl, cls: "bg-slate-50 text-slate-500 border-slate-200" };
  };

  const statCards = [
    { icon: FileText, label: tt.nav_notices, value: String(data.totalNotices), href: "/notices" },
    { icon: CalendarClock, label: tt.db_deadlines, value: String(data.deadlines.length), href: "/notices" },
    { icon: Bell, label: tt.nav_notifications, value: String(data.unreadNotifications), href: "/notifications" },
  ];

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-56 bg-gradient-to-b from-indigo-50/80 to-transparent" />
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
        {/* welcome */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              {tt.db_hello} <span className="text-indigo-600">👋</span>
            </h1>
            <p className="mt-1.5 text-sm text-slate-600">{tt.db_welcome_sub}</p>
          </div>
          <Link
            href="/analyze"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm shadow-indigo-200 transition-colors hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> {tt.db_new}
          </Link>
        </div>

        {/* attention banner */}
        <div
          className={`mt-6 flex items-start gap-3.5 rounded-2xl border p-4 ${
            data.attention > 0 ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50/60"
          }`}
        >
          {data.attention > 0 ? (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          )}
          <p className={`text-sm font-semibold ${data.attention > 0 ? "text-amber-800" : "text-emerald-800"}`}>
            {data.attention === 0
              ? tt.db_attention_none
              : data.attention === 1
                ? tt.db_attention_one
                : tt.db_attention_many.replace("{n}", String(data.attention))}
          </p>
        </div>

        {/* stats */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          {statCards.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50/40"
            >
              <s.icon className="h-5 w-5 text-indigo-500" />
              <div className="mt-2 text-2xl font-extrabold text-slate-900">{s.value}</div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 group-hover:text-indigo-600">{s.label}</div>
            </Link>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-5">
          {/* active deadlines */}
          <section className="lg:col-span-3">
            <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
              <CalendarClock className="h-4.5 w-4.5 text-indigo-600" /> {tt.db_deadlines}
            </h2>
            {data.deadlines.length === 0 ? (
              <p className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-5 text-sm leading-relaxed text-slate-500">
                {tt.db_no_deadlines}
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {data.deadlines.map((d) => {
                  const c = countdown(d);
                  return (
                    <div
                      key={d.id}
                      className={`rounded-2xl border bg-white p-4 shadow-sm transition-colors hover:border-indigo-200 ${
                        d.severity === "red" ? "border-red-200" : "border-slate-200"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex min-w-0 items-start gap-3">
                          <span
                            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                              d.severity === "red" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {d.severity === "red" ? <Siren className="h-4.5 w-4.5" /> : <Landmark className="h-4.5 w-4.5" />}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-extrabold text-slate-900">{typeLabel(d.noticeType)}</div>
                            <div className="truncate text-xs text-slate-500">{d.title}</div>
                            {d.claimedAmount && <div className="mt-0.5 text-xs font-bold text-indigo-700">{d.claimedAmount}</div>}
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${c.cls}`}>{c.text}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                        <span className="text-xs text-slate-500">
                          {tt.nl_deadline}: <span className="font-bold text-slate-700">{d.deadlineDate ? fmtDateFor(d.deadlineDate, locale) : "—"}</span>
                        </span>
                        {d.hasReport && (
                          <Link href={`/notices/${d.id}`} className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800">
                            {tt.db_view} <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* recent + quick actions */}
          <div className="space-y-6 lg:col-span-2">
            <section>
              <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
                <ClipboardList className="h-4.5 w-4.5 text-indigo-600" /> {tt.db_recent}
              </h2>
              {data.recentNotices.length === 0 ? (
                <p className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-5 text-sm leading-relaxed text-slate-500">
                  {tt.db_no_notices}
                </p>
              ) : (
                <div className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
                  {data.recentNotices.map((n) => (
                    <Link key={n.id} href={`/notices/${n.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          n.severity === "red" ? "bg-red-500" : n.severity === "yellow" ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-bold text-slate-900">{typeLabel(n.noticeType)}</div>
                        <div className="truncate text-[11px] text-slate-400">{fmtDateFor(n.createdAt.slice(0, 10), locale)}</div>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
                <LayoutDashboard className="h-4.5 w-4.5 text-indigo-600" /> {tt.db_quick}
              </h2>
              <div className="mt-3 grid gap-2.5">
                {[
                  { href: "/analyze", icon: UploadCloud, label: tt.db_qa_analyze },
                  { href: "/notices", icon: FileText, label: tt.db_qa_notices },
                  { href: "/notifications", icon: Bell, label: tt.db_qa_notifications },
                  { href: "/settings", icon: Settings, label: tt.nav_settings },
                ].map((a) => (
                  <Link
                    key={a.href}
                    href={a.href}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-700"
                  >
                    <a.icon className="h-4 w-4 text-indigo-500" />
                    {a.label}
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
