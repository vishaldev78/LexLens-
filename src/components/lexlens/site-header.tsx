"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Scale, Menu, X, Globe, ChevronDown, Check, Bell } from "lucide-react";
import { useLang } from "./language-provider";
import { UI_LOCALES, UI_LOCALE_META, type UiLocale } from "@/lib/lexlens/ui-i18n";

export function SiteHeader() {
  const { t, locale, setLocale } = useLang();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Unread badge for the notification bell.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/notifications?filter=unread", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { unreadCount?: number } | null) => {
        if (!cancelled && d) setUnread(d.unreadCount ?? 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const links = [
    { href: "/", label: t.nav_home, active: pathname === "/" },
    { href: "/analyze", label: t.nav_analyze, active: pathname === "/analyze" },
    { href: "/dashboard", label: t.nav_dashboard, active: pathname === "/dashboard" },
    { href: "/notices", label: t.nav_notices, active: pathname.startsWith("/notices") },
    { href: "/notifications", label: t.nav_notifications, active: pathname === "/notifications" },
  ];

  return (
    <header className="no-print sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5" aria-label="LexLens home">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-200">
            <Scale className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-900">
            Lex<span className="text-indigo-600">Lens</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                l.active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {/* Language switcher */}
          <div className="relative" ref={langRef}>
            <button
              onClick={() => setLangOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-indigo-200 hover:bg-indigo-50/60"
              aria-label={t.lang_switch}
              aria-expanded={langOpen}
            >
              <Globe className="h-4 w-4 text-indigo-600" />
              <span className="hidden sm:inline">{UI_LOCALE_META[locale].native}</span>
              <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${langOpen ? "rotate-180" : ""}`} />
            </button>
            {langOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-slate-200/60">
                {UI_LOCALES.map((loc: UiLocale) => (
                  <button
                    key={loc}
                    onClick={() => {
                      setLocale(loc);
                      setLangOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-3.5 py-2.5 text-sm transition-colors ${
                      loc === locale ? "bg-indigo-50 font-semibold text-indigo-700" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span aria-hidden>{UI_LOCALE_META[loc].flag}</span>
                      <span>{UI_LOCALE_META[loc].native}</span>
                      <span className="text-xs text-slate-400">{UI_LOCALE_META[loc].en}</span>
                    </span>
                    {loc === locale && <Check className="h-4 w-4" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notification bell */}
          <Link
            href="/notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50/60"
            aria-label={`${t.nav_bell}${unread ? ` (${unread} ${t.nt_unread_count})` : ""}`}
          >
            <Bell className="h-4.5 w-4.5" />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>

          {/* Mobile toggle */}
          <button
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={t.nav_menu}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="border-t border-slate-100 bg-white px-4 pb-4 pt-2 md:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className={`rounded-lg px-3 py-2.5 text-sm font-medium ${
                  l.active ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/settings"
              onClick={() => setMobileOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              {t.nav_settings}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
