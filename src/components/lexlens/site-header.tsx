"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Scale, Menu, X, Globe, ChevronDown, Check, Bell, LayoutDashboard, FileText, Settings, UserRound, LogOut } from "lucide-react";
import { useLang } from "./language-provider";
import { UI_LOCALES, UI_LOCALE_META, type UiLocale } from "@/lib/lexlens/ui-i18n";
import { signOut, useUser } from "@/hooks/use-user";

export function SiteHeader() {
  const { t, locale, setLocale } = useLang();
  const pathname = usePathname();
  const { user } = useUser();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const langRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Unread badge for signed-in users.
  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
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
  }, [user, pathname]);

  const links = [
    ...(user
      ? [
          { href: "/dashboard", label: t.nav_dashboard, active: pathname === "/dashboard" },
          { href: "/notices", label: t.nav_notices, active: pathname.startsWith("/notices") },
        ]
      : [
          { href: "/", label: t.nav_home, active: pathname === "/" },
          { href: "/#how", label: t.nav_how, active: false },
        ]),
  ];

  return (
    <header className="no-print sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* Brand */}
        <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2.5" aria-label="LexLens home">
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
          {user && (
            <Link
              href="/notifications"
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                pathname === "/notifications" ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {t.nav_notifications}
            </Link>
          )}
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

          {user ? (
            <>
              {/* Notification bell */}
              <div className="relative" ref={bellRef}>
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
              </div>

              {/* Account menu */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-indigo-200 hover:bg-indigo-50/60"
                  aria-expanded={menuOpen}
                  aria-label={t.nav_profile}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-extrabold uppercase text-indigo-700">
                    {user.username.slice(0, 1)}
                  </span>
                  <span className="hidden max-w-24 truncate sm:inline">{user.username}</span>
                  <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-slate-200/60">
                    <div className="border-b border-slate-100 px-3.5 py-2.5">
                      <div className="truncate text-sm font-bold text-slate-900">{user.username}</div>
                      <div className="truncate text-xs text-slate-400">{user.email ?? "LexLens"}</div>
                    </div>
                    {[
                      { href: "/dashboard", icon: LayoutDashboard, label: t.nav_dashboard },
                      { href: "/notices", icon: FileText, label: t.nav_notices },
                      { href: "/notifications", icon: Bell, label: t.nav_notifications },
                      { href: "/profile", icon: UserRound, label: t.nav_profile },
                      { href: "/settings", icon: Settings, label: t.nav_settings },
                    ].map((it) => (
                      <Link
                        key={it.href}
                        href={it.href}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <it.icon className="h-4 w-4 text-slate-400" />
                        {it.label}
                      </Link>
                    ))}
                    <button
                      onClick={() => void signOut()}
                      className="flex w-full items-center gap-2.5 border-t border-slate-100 px-3.5 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" />
                      {t.nav_signout}
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-700 sm:inline-flex"
              >
                {t.nav_login}
              </Link>
              <Link
                href="/signup"
                className="hidden rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition-all hover:bg-indigo-700 hover:shadow md:inline-flex"
              >
                {t.nav_signup}
              </Link>
            </>
          )}

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
            {user ? (
              <>
                <Link href="/notifications" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
                  {t.nav_notifications} {unread > 0 && <span className="ml-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">{unread}</span>}
                </Link>
                <Link href="/profile" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
                  {t.nav_profile}
                </Link>
                <Link href="/settings" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
                  {t.nav_settings}
                </Link>
                <button onClick={() => void signOut()} className="mt-1 rounded-lg border border-red-200 px-3 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50">
                  {t.nav_signout}
                </button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
                  {t.nav_login}
                </Link>
                <Link href="/signup" onClick={() => setMobileOpen(false)} className="mt-1 rounded-lg bg-indigo-600 px-3 py-2.5 text-center text-sm font-semibold text-white hover:bg-indigo-700">
                  {t.nav_signup}
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
