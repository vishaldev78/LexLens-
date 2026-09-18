"use client";

// LexLens — notification center.
// Deadline reminders and report updates for the local workspace.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, BellOff, CalendarClock, CheckCheck, CheckCircle2, FileText, Loader2, Siren } from "lucide-react";
import { useLang } from "@/components/lexlens/language-provider";

type TT = Record<string, string>;

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  noticeId: string | null;
  noticeTitle: string | null;
}

function iconFor(type: string): { Icon: React.ElementType; cls: string } {
  if (type.startsWith("deadline_overdue")) return { Icon: Siren, cls: "bg-red-100 text-red-600" };
  if (type.startsWith("deadline")) return { Icon: CalendarClock, cls: "bg-amber-100 text-amber-700" };
  if (type === "report_ready") return { Icon: CheckCircle2, cls: "bg-emerald-100 text-emerald-600" };
  if (type === "analysis_failed") return { Icon: AlertTriangle, cls: "bg-red-100 text-red-600" };
  if (type === "missing_info") return { Icon: FileText, cls: "bg-indigo-100 text-indigo-600" };
  return { Icon: Bell, cls: "bg-slate-100 text-slate-500" };
}

export default function NotificationsPage() {
  const { t } = useLang();
  const tt = t as unknown as TT;
  const [items, setItems] = useState<NotificationRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    fetch("/api/notifications", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { notifications: NotificationRow[] }) => setItems(d.notifications))
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(body: Record<string, unknown>, key: string) {
    setBusy(key);
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setItems((list) => list?.map((n) => (body.action === "mark_all_read" || n.id === body.id ? { ...n, isRead: true } : n)) ?? null);
    } finally {
      setBusy(null);
    }
  }

  const unread = items?.filter((n) => !n.isRead).length ?? 0;

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-56 bg-gradient-to-b from-indigo-50/80 to-transparent" />
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
        {/* header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              <Bell className="h-6 w-6 text-indigo-600" /> {tt.nt_title}
              {unread > 0 && (
                <span className="rounded-full bg-red-500 px-2.5 py-0.5 text-[11px] font-extrabold text-white">{unread} {tt.nt_unread_count}</span>
              )}
            </h1>
            <p className="mt-1.5 text-sm text-slate-600">{tt.nt_sub}</p>
          </div>
          {unread > 0 && (
            <button
              onClick={() => void act({ action: "mark_all_read" }, "all")}
              disabled={busy === "all"}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-60"
            >
              {busy === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
              {tt.nt_mark_all}
            </button>
          )}
        </div>

        {/* states */}
        {failed && <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-medium text-amber-800">{tt.cm_error}</div>}
        {items === null && !failed && (
          <div className="flex min-h-[40vh] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          </div>
        )}
        {items !== null && items.length === 0 && !failed && (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-14 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500">
              <BellOff className="h-7 w-7" />
            </span>
            <h2 className="mt-4 text-lg font-bold text-slate-900">{tt.nt_empty_t}</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">{tt.nt_empty_d}</p>
          </div>
        )}

        {/* list */}
        {items !== null && items.length > 0 && (
          <div className="mt-6 space-y-2.5">
            {items.map((n) => {
              const { Icon, cls } = iconFor(n.type);
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-3.5 rounded-2xl border p-4 shadow-sm transition-colors ${
                    n.isRead ? "border-slate-200 bg-white" : "border-indigo-200 bg-indigo-50/40"
                  }`}
                >
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cls}`}>
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-extrabold text-slate-900">{n.title}</span>
                      {!n.isRead && <span className="h-2 w-2 rounded-full bg-indigo-500" aria-label={tt.nt_unread_count} />}
                    </div>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-slate-600">{n.message}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="text-[11px] text-slate-400">
                        {new Date(n.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                      </span>
                      {n.noticeId && (
                        <Link href={`/notices/${n.noticeId}`} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800">
                          {tt.nt_view} →
                        </Link>
                      )}
                    </div>
                  </div>
                  {!n.isRead && (
                    <button
                      onClick={() => void act({ action: "mark_read", id: n.id }, n.id)}
                      disabled={busy === n.id}
                      className="no-print shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-500 transition-colors hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-50"
                      title={tt.nt_mark_all}
                    >
                      {busy === n.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
