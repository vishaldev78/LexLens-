"use client";

import Link from "next/link";
import { Scale, ShieldAlert, ShieldCheck } from "lucide-react";
import { useLang } from "./language-provider";

export function SiteFooter() {
  const { t } = useLang();
  return (
    <footer className="no-print border-t border-slate-200 bg-slate-50/80">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
                <Scale className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <span className="text-lg font-bold tracking-tight text-slate-900">
                Lex<span className="text-indigo-600">Lens</span>
              </span>
            </div>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-600">{t.ft_tagline}</p>
            <div className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              <span>{t.ft_trust}</span>
            </div>
          </div>

          {/* Product links */}
          <div>
            <h4 className="text-sm font-semibold text-slate-900">{t.ft_product}</h4>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li><Link href="/analyze" className="transition-colors hover:text-indigo-600">{t.nav_analyze}</Link></li>
              <li><Link href="/#how" className="transition-colors hover:text-indigo-600">{t.nav_how}</Link></li>
              <li><Link href="/#languages" className="transition-colors hover:text-indigo-600">{t.nav_languages}</Link></li>
              <li><Link href="/#types" className="transition-colors hover:text-indigo-600">{t.types_title}</Link></li>
            </ul>
          </div>

          {/* Disclaimer */}
          <div>
            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              {t.ft_note_t}
            </h4>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{t.ft_note_d}</p>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-200 pt-6 text-xs leading-relaxed text-slate-500">
          {t.rs_disclaimer}
        </div>
        <div className="mt-3 text-xs text-slate-400">{t.ft_copyright}</div>
      </div>
    </footer>
  );
}
