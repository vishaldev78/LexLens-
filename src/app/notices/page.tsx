"use client";

// LexLens — My Notices: the local workspace library of analyzed notices.
// Every row is loaded from the workspace's own data (API is scoped per user).

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  Download,
  FileText,
  FolderOpen,
  Landmark,
  Loader2,
  Plus,
  RotateCcw,
  Siren,
  Trash2,
} from "lucide-react";
import { useLang } from "@/components/lexlens/language-provider";
import { fmtDateFor } from "@/components/lexlens/case-ui";

type TT = Record<string, string>;

interface NoticeSummary {
  id: string;
  title: string;
  sourceLabel: string;
  fileType: string;
  noticeType: string;
  jurisdiction: string;
  severity: string;
  noticeLanguage: string;
  claimedAmount: string | null;
  noticeDate: string | null;
  receiptDate: string | null;
  deadlineDate: string | null;
  status: string;
  daysRemaining: number | null;
  completed: boolean;
  analysisStatus: string;
  hasReport: boolean;
  missingReceipt: boolean;
  createdAt: string;
}

const STATUS_KEY: Record<string, string> = {
  ACTIVE: "nl_status_active",
  DUE_SOON: "nl_status_due_soon",
  DUE_TODAY: "nl_status_due_today",
  OVERDUE: "nl_status_overdue",
  COMPLETED: "nl_status_completed",
  NO_DEADLINE: "nl_status_no_deadline",
  UNKNOWN_DEADLINE: "nl_status_unknown",
};

function statusCls(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "DUE_SOON":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "DUE_TODAY":
    case "OVERDUE":
      return "border-red-200 bg-red-50 text-red-700";
    case "COMPLETED":
      return "border-slate-200 bg-slate-100 text-slate-600";
    default:
      return "border-slate-200 bg-slate-50 text-slate-500";
  }
}

type Filter = "all" | "attention" | "completed";

export default function NoticesPage() {
  const { t, locale } = useLang();
  const tt = t as unknown as TT;
  const [items, setItems] = useState<NoticeSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    fetch("/api/notices", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { notices: NoticeSummary[] }) => setItems(d.notices))
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!items) return [];
    if (filter === "completed") return items.filter((n) => n.completed);
    if (filter === "attention")
      return items.filter(
        (n) => !n.completed && (n.status === "DUE_SOON" || n.status === "DUE_TODAY" || n.status === "OVERDUE" || n.analysisStatus === "FAILED"),
      );
    return items;
  }, [items, filter]);

  async function remove(id: string) {
    if (!window.confirm(tt.nl_confirm)) return;
    setDeleting(id);
    try {
      await fetch(`/api/notices/${id}`, { method: "DELETE" });
      setItems((list) => list?.filter((n) => n.id !== id) ?? null);
    } finally {
      setDeleting(null);
    }
  }

  const typeLabel = (nt: string) => tt[`nt_${nt}`] ?? nt;

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-56 bg-gradient-to-b from-indigo-50/80 to-transparent" />
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
        {/* header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{tt.nl_title}</h1>
            <p className="mt-1.5 text-sm text-slate-600">{tt.nl_sub}</p>
          </div>
          <Link
            href="/analyze"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm shadow-indigo-200 transition-colors hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> {tt.nl_new}
          </Link>
        </div>

        {/* filters */}
        {items && items.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {([
              ["all", tt.nav_notices],
              ["attention", tt.db_attention_t],
              ["completed", tt.nl_status_completed],
            ] as [Filter, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                  filter === key ? "bg-indigo-600 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* states */}
        {failed && (
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-medium text-amber-800">{tt.cm_error}</div>
        )}
        {items === null && !failed && (
          <div className="flex min-h-[40vh] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          </div>
        )}
        {items !== null && filtered.length === 0 && !failed && (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-14 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500">
              <FolderOpen className="h-7 w-7" />
            </span>
            <h2 className="mt-4 text-lg font-bold text-slate-900">{tt.nl_empty_t}</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">{tt.nl_empty_d}</p>
            <Link
              href="/analyze"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" /> {tt.nl_new}
            </Link>
          </div>
        )}

        {/* list */}
        {filtered.length > 0 && (
          <div className="mt-6 space-y-3">
            {filtered.map((n) => (
              <div
                key={n.id}
                className={`rounded-2xl border bg-white p-4 shadow-sm transition-colors hover:border-indigo-200 sm:p-5 ${
                  n.severity === "red" && !n.completed ? "border-red-200" : "border-slate-200"
                }`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  {/* main */}
                  <div className="flex min-w-0 flex-1 items-start gap-3.5">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        n.severity === "red" ? "bg-red-100 text-red-600" : n.severity === "yellow" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-600"
                      }`}
                    >
                      {n.severity === "red" ? <Siren className="h-5 w-5" /> : <Landmark className="h-5 w-5" />}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-extrabold text-slate-900">{typeLabel(n.noticeType)}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${statusCls(n.status)}`}>
                          {tt[STATUS_KEY[n.status] ?? "nl_status_unknown"]}
                        </span>
                        {n.analysisStatus === "FAILED" && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700">
                            <AlertTriangle className="h-3 w-3" /> {tt.nl_failed}
                          </span>
                        )}
                        {n.missingReceipt && !n.completed && n.analysisStatus === "READY" && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                            <CalendarClock className="h-3 w-3" /> {tt.nl_receipt_missing}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-slate-500">{n.title}</div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-slate-500">
                        <span>
                          {tt.nl_analyzed}: <span className="font-semibold text-slate-700">{fmtDateFor(n.createdAt.slice(0, 10), locale)}</span>
                        </span>
                        {n.deadlineDate && (
                          <span>
                            {tt.nl_deadline}: <span className="font-semibold text-slate-700">{fmtDateFor(n.deadlineDate, locale)}</span>
                            {n.daysRemaining !== null && !n.completed && (
                              <span
                                className={`ml-1.5 font-bold ${
                                  n.daysRemaining < 0 ? "text-red-600" : n.daysRemaining <= 7 ? "text-amber-600" : "text-emerald-600"
                                }`}
                              >
                                ·{" "}
                                {n.daysRemaining < 0
                                  ? tt.db_overdue
                                  : n.daysRemaining === 0
                                    ? tt.db_due_today
                                    : `${n.daysRemaining} ${tt.db_days_left}`}
                              </span>
                            )}
                          </span>
                        )}
                        {n.claimedAmount && <span className="font-bold text-indigo-700">{n.claimedAmount}</span>}
                      </div>
                    </div>
                  </div>

                  {/* actions */}
                  <div className="no-print flex flex-wrap items-center gap-2 lg:shrink-0">
                    {n.hasReport ? (
                      <Link
                        href={`/notices/${n.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700"
                      >
                        <FileText className="h-3.5 w-3.5" /> {tt.nl_view_report}
                      </Link>
                    ) : n.analysisStatus === "FAILED" ? (
                      <Link
                        href={`/notices/${n.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> {tt.nl_retry}
                      </Link>
                    ) : (
                      <Link
                        href={`/notices/${n.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
                      >
                        {tt.nl_open}
                      </Link>
                    )}
                    {n.hasReport && (
                      <a
                        href={`/api/notices/${n.id}/pdf`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-700"
                      >
                        <Download className="h-3.5 w-3.5" /> {tt.nl_pdf}
                      </a>
                    )}
                    <button
                      onClick={() => void remove(n.id)}
                      disabled={deleting === n.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-red-600 transition-colors hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
                      aria-label={tt.nl_delete}
                    >
                      {deleting === n.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
