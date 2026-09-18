"use client";

// LexLens — settings: notification preferences for the local workspace.
// Each reminder fires once per deadline (deduplicated server-side).

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, BellRing, CalendarClock, Check, Loader2, Save, Siren } from "lucide-react";
import { useLang } from "@/components/lexlens/language-provider";

type TT = Record<string, string>;

interface Prefs {
  enabled: boolean;
  days7: boolean;
  days3: boolean;
  days1: boolean;
  dueDate: boolean;
  overdue: boolean;
}

const DEFAULTS: Prefs = { enabled: true, days7: true, days3: true, days1: true, dueDate: true, overdue: true };

export default function SettingsPage() {
  const { t } = useLang();
  const tt = t as unknown as TT;
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/profile", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { profile: { notifications: Prefs } }) => setPrefs({ ...DEFAULTS, ...d.profile.notifications }))
      .catch(() => setFailed(true));
  }, []);

  async function save() {
    if (!prefs) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifications: prefs }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } finally {
      setSaving(false);
    }
  }

  const rows: { key: keyof Omit<Prefs, "enabled">; icon: React.ElementType; label: string; desc: string }[] = [
    { key: "days7", icon: CalendarClock, label: tt.st_7, desc: tt.st_7d },
    { key: "days3", icon: CalendarClock, label: tt.st_3, desc: tt.st_3d },
    { key: "days1", icon: CalendarClock, label: tt.st_1, desc: tt.st_1d },
    { key: "dueDate", icon: BellRing, label: tt.st_due, desc: tt.st_dued },
    { key: "overdue", icon: Siren, label: tt.st_overdue, desc: tt.st_overdued },
  ];

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-56 bg-gradient-to-b from-indigo-50/80 to-transparent" />
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-12">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{tt.st_title}</h1>
        <p className="mt-1.5 text-sm text-slate-600">{tt.st_sub}</p>

        {failed && <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-medium text-amber-800">{tt.cm_error}</div>}
        {!prefs && !failed && (
          <div className="flex min-h-[40vh] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          </div>
        )}

        {prefs && (
          <div className="mt-8 space-y-4">
            {/* master switch */}
            <button
              onClick={() => setPrefs({ ...prefs, enabled: !prefs.enabled })}
              className={`flex w-full items-center justify-between gap-4 rounded-2xl border p-5 text-left shadow-sm transition-colors ${
                prefs.enabled ? "border-indigo-200 bg-indigo-50/50" : "border-slate-200 bg-white"
              }`}
              aria-pressed={prefs.enabled}
            >
              <span className="flex items-start gap-3.5">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${prefs.enabled ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400"}`}>
                  <Bell className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-extrabold text-slate-900">{tt.st_enabled}</span>
                  <span className="mt-0.5 block text-[13px] leading-relaxed text-slate-500">{tt.st_enabled_d}</span>
                </span>
              </span>
              <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${prefs.enabled ? "bg-indigo-600" : "bg-slate-300"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${prefs.enabled ? "left-[22px]" : "left-0.5"}`} />
              </span>
            </button>

            {/* per-reminder switches */}
            <div className={`divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm ${prefs.enabled ? "" : "opacity-50"}`}>
              {rows.map((r) => {
                const on = prefs[r.key];
                return (
                  <button
                    key={r.key}
                    onClick={() => prefs.enabled && setPrefs({ ...prefs, [r.key]: !on })}
                    disabled={!prefs.enabled}
                    className="flex w-full items-center justify-between gap-4 p-4.5 px-5 py-4 text-left transition-colors hover:bg-slate-50/70"
                    aria-pressed={on}
                  >
                    <span className="flex items-start gap-3.5">
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${on ? "bg-indigo-50 text-indigo-600" : "bg-slate-50 text-slate-400"}`}>
                        <r.icon className="h-4 w-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-bold text-slate-900">{r.label}</span>
                        <span className="mt-0.5 block text-[12.5px] leading-relaxed text-slate-500">{r.desc}</span>
                      </span>
                    </span>
                    <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-indigo-600" : "bg-slate-300"}`}>
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
                    </span>
                  </button>
                );
              })}
            </div>

            {/* save */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => void save()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm shadow-indigo-200 transition-colors hover:bg-indigo-700 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {saved ? tt.st_saved : tt.st_save}
              </button>
              <Link href="/dashboard" className="text-sm font-semibold text-slate-500 hover:text-slate-800">
                ← {tt.nav_dashboard}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
