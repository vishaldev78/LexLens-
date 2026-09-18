"use client";

// LexLens — reminder watcher (reminder system).
//
// Mounted once in the root layout. While any LexLens tab is open it polls the
// session-scoped reminder list and, when a reminder comes due, fires a
// BROWSER/LOCAL notification (Web Notifications API — no login, no signup,
// no push service) plus an in-app toast fallback. Each reminder is
// acknowledged exactly once; the reminder time is user-chosen but its legal
// anchor is always the deterministic deadline computed by the deadline engine.

import { useCallback, useEffect, useRef } from "react";
import { toast } from "@/hooks/use-toast";
import { useLang } from "@/components/lexlens/language-provider";
import { fmtISO } from "@/lib/lexlens/case-engine";
import type { Locale, ReminderDTO } from "@/lib/lexlens/types";

const POLL_MS = 20_000;

export function ReminderWatcher() {
  const { t, locale } = useLang();
  const tt = t as unknown as Record<string, string>;
  const firedRef = useRef<Set<string>>(new Set());
  const localeRef = useRef<Locale>(locale);
  const ttRef = useRef<Record<string, string>>(tt);
  useEffect(() => {
    localeRef.current = locale;
    ttRef.current = tt;
  }, [locale, tt]);

  const notify = useCallback((r: ReminderDTO) => {
    const cur = ttRef.current;
    const when = fmtISO(r.deadlineDate, localeRef.current);
    const body = `${r.noticeTitle}\n${(cur.rem_fired_body ?? "Deadline: {date}").replace("{date}", when).replace("{label}", r.noticeTitle)}`;

    // 1. Browser/local notification (primary channel).
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        const n = new Notification(cur.rem_fired_t ?? "LexLens — deadline reminder", {
          body,
          tag: `lexlens-reminder-${r.id}`,
          icon: "/icon.svg",
        });
        n.onclick = () => {
          window.focus();
          window.location.href = `/notices/${r.noticeId}`;
        };
      } catch {
        /* some browsers restrict constructors — toast still fires */
      }
    }

    // 2. In-app toast (always — covers permission-denied and unsupported).
    toast({ title: cur.rem_toast_t ?? "Deadline reminder", description: body });
  }, []);

  const check = useCallback(async () => {
    let due: ReminderDTO[] = [];
    try {
      const res = await fetch("/api/reminders", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { reminders?: ReminderDTO[] };
      const now = Date.now();
      due = (data.reminders ?? []).filter((r) => r.status === "ACTIVE" && r.remindAtMs <= now && !firedRef.current.has(r.id));
    } catch {
      return; // offline — try again on the next tick
    }
    if (due.length === 0) return;

    due.forEach((r) => firedRef.current.add(r.id));
    due.forEach((r) => notify(r));
    void fetch("/api/reminders/ack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: due.map((r) => r.id) }),
    }).catch(() => {});
  }, [notify]);

  useEffect(() => {
    void check();
    const iv = setInterval(() => void check(), POLL_MS);
    const onWake = () => void check();
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);
    return () => {
      clearInterval(iv);
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onWake);
    };
  }, [check]);

  return null; // invisible — delivers reminders only
}
