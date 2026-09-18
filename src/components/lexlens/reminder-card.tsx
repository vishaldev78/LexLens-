"use client";

// LexLens — deadline reminder UI (reminder system).
//
// The reminder is ALWAYS anchored to the deterministically calculated deadline
// (view.deadlines → deadline-engine). The user only picks WHEN to be reminded
// (date/time or a quick preset like "1 day before"); the legal date itself is
// never editable here and never AI-generated. Reminders are temporary and
// session-scoped: they live only inside the current anonymous analysis session
// and are delivered as browser/local notifications — no login, no accounts.

import { useEffect, useMemo, useState } from "react";
import { AlarmClock, BellPlus, BellRing, CalendarClock, Loader2, PencilLine, ShieldCheck, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { fmtISO } from "@/lib/lexlens/case-engine";
import { todayISO } from "@/lib/lexlens/deadline-engine";
import type { Locale, ReminderDTO } from "@/lib/lexlens/types";

type TT = Record<string, string>;

function addDaysLocal(iso: string, days: number): Date {
  const d = new Date(`${iso}T09:00:00`); // local midnight-ish anchor
  d.setDate(d.getDate() + days);
  return d;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toLocalInput(d: Date): { date: string; time: string } {
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function fmtDateTime(ms: number, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleString();
  }
}

export function ReminderSection({
  noticeId,
  deadlineISO,
  deadlineLabel,
  reminder,
  tt,
  locale,
  onChanged,
}: {
  noticeId: string;
  deadlineISO: string; // deterministic deadline (status === "calculated" guard upstream)
  deadlineLabel: string;
  reminder: ReminderDTO | null;
  tt: TT;
  locale: Locale;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [dateInput, setDateInput] = useState("");
  const [timeInput, setTimeInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [notifPerm, setNotifPerm] = useState<"unsupported" | "default" | "granted" | "denied">("unsupported");

  // Read permission only while the dialog is open (avoids SSR mismatch).
  useEffect(() => {
    if (!open) return;
    setNotifPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, [open]);

  // Opening the dialog pre-fills the current reminder (edit) or a sensible default.
  useEffect(() => {
    if (!open) return;
    setErr("");
    if (reminder) {
      const p = toLocalInput(new Date(reminder.remindAtMs));
      setDateInput(p.date);
      setTimeInput(p.time);
    } else {
      const p = toLocalInput(addDaysLocal(deadlineISO, -1)); // 1 day before, 09:00
      setDateInput(p.date);
      setTimeInput(p.time);
    }
  }, [open, reminder, deadlineISO]);

  const minDate = useMemo(() => todayISO(), []);
  const maxDate = deadlineISO; // a reminder cannot legally sit after the deadline

  async function enableBrowserNotifications() {
    if (typeof Notification === "undefined") return;
    try {
      const res = await Notification.requestPermission(); // user-gesture context
      setNotifPerm(res);
    } catch {
      setNotifPerm("denied");
    }
  }

  function applyPreset(daysBefore: number) {
    const p = toLocalInput(addDaysLocal(deadlineISO, -daysBefore));
    setDateInput(p.date);
    setTimeInput(p.time);
    setErr("");
  }

  async function confirmReminder() {
    if (!dateInput || !timeInput) {
      setErr(tt.rem_err_pick);
      return;
    }
    const ms = new Date(`${dateInput}T${timeInput}`).getTime();
    if (!Number.isFinite(ms)) {
      setErr(tt.rem_err_pick);
      return;
    }
    if (ms <= Date.now() - 60_000) {
      setErr(tt.rem_err_past);
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/notices/${noticeId}/reminder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remindAt: ms, deadline: deadlineISO }),
      });
      const data = (await res.json().catch(() => ({}))) as { reminder?: ReminderDTO; error?: string };
      if (!res.ok || !data.reminder) {
        setErr(data.error ?? tt.rem_generic_err);
        return;
      }
      const editing = !!reminder;
      setOpen(false);
      onChanged();
      toast({ description: editing ? tt.rem_updated : tt.rem_ok });
    } catch {
      setErr(tt.rem_generic_err);
    } finally {
      setBusy(false);
    }
  }

  async function cancelReminder() {
    setBusy(true);
    try {
      const res = await fetch(`/api/notices/${noticeId}/reminder`, { method: "DELETE" });
      if (res.ok) {
        onChanged();
        toast({ description: tt.rem_cancel_ok });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="no-print mt-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5">
      {!reminder ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <BellPlus className="mt-0.5 h-4.5 w-4.5 shrink-0 text-indigo-600" />
            <div>
              <p className="text-[13px] font-bold text-slate-900">{tt.rem_set}</p>
              <p className="text-[12px] leading-relaxed text-slate-600">{tt.rem_browser_note}</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            <BellPlus className="h-4 w-4" /> {tt.rem_set}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <BellRing className="mt-0.5 h-4.5 w-4.5 shrink-0 text-indigo-600" />
            <div>
              <p className="text-[13px] font-bold text-slate-900">
                <span className="mr-1.5 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700">✓ {tt.rem_active_chip}</span>
              </p>
              <p className="mt-1 text-[13px] font-semibold text-indigo-800">{fmtDateTime(reminder.remindAtMs, locale)}</p>
              <p className="text-[12px] text-slate-600">
                {tt.ac_deadline_exact}: {fmtISO(reminder.deadlineDate, locale)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-white px-3.5 py-2 text-xs font-bold text-indigo-700 transition-colors hover:bg-indigo-50"
            >
              <PencilLine className="h-3.5 w-3.5" /> {tt.rem_edit}
            </button>
            <button
              onClick={() => void cancelReminder()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-red-600 transition-colors hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" /> {tt.rem_cancel}
            </button>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
              <AlarmClock className="h-5 w-5 text-indigo-600" /> {tt.rem_dialog_t}
            </DialogTitle>
            <DialogDescription className="text-[13px] leading-relaxed text-slate-600">
              {tt.rem_dialog_sub}
            </DialogDescription>
          </DialogHeader>

          {/* the deterministic anchor — shown, never editable */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5">
            <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" /> {tt.rem_deadline_label}
            </div>
            <p className="mt-1 text-sm font-extrabold text-slate-900">{fmtISO(deadlineISO, locale)}</p>
            <p className="text-[12px] leading-relaxed text-slate-600">{deadlineLabel}</p>
          </div>

          <div className="grid gap-3">
            <div>
              <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">{tt.rem_presets}</div>
              <div className="flex flex-wrap gap-1.5">
                {[0, 1, 3].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => applyPreset(n)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11.5px] font-bold text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-700"
                  >
                    {n === 0 ? tt.rem_preset_0 : n === 1 ? tt.rem_preset_1 : tt.rem_preset_3}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wide text-slate-500" htmlFor="rem-date">
                {tt.rem_when}
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="rem-date"
                  type="date"
                  value={dateInput}
                  min={minDate}
                  max={maxDate}
                  onChange={(e) => {
                    setDateInput(e.target.value);
                    setErr("");
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
                <input
                  aria-label={tt.rem_time_label}
                  type="time"
                  value={timeInput}
                  onChange={(e) => {
                    setTimeInput(e.target.value);
                    setErr("");
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>

            {/* browser notification permission — requested on user gesture */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              {notifPerm === "granted" ? (
                <p className="flex items-center gap-2 text-[12px] font-bold text-emerald-700">
                  <BellRing className="h-3.5 w-3.5 shrink-0" /> {tt.rem_browser_on}
                </p>
              ) : notifPerm === "denied" ? (
                <p className="text-[12px] font-medium leading-relaxed text-amber-700">{tt.rem_browser_blocked}</p>
              ) : notifPerm === "unsupported" ? (
                <p className="text-[12px] font-medium leading-relaxed text-slate-600">{tt.rem_browser_note}</p>
              ) : (
                <button
                  type="button"
                  onClick={() => void enableBrowserNotifications()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-[11.5px] font-bold text-indigo-700 transition-colors hover:bg-indigo-50"
                >
                  <BellRing className="h-3.5 w-3.5" /> {tt.rem_enable_browser}
                </button>
              )}
            </div>

            <p className="text-[11.5px] leading-relaxed text-slate-500">{tt.rem_session_note}</p>
            {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">{err}</p>}
          </div>

          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <CalendarClock className="mr-1.5 inline h-3.5 w-3.5" />
              {tt.rem_cancel}
            </button>
            <button
              type="button"
              onClick={() => void confirmReminder()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellPlus className="h-4 w-4" />}
              {busy ? tt.rem_saving : tt.rem_save}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
