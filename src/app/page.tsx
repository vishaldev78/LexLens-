"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  FileUp,
  ScanSearch,
  ListChecks,
  BookOpenCheck,
  ShieldCheck,
  Timer,
  Eye,
  Lock,
  Languages as LanguagesIcon,
  Scale,
  Ban,
  Home,
  ShoppingBag,
  Gavel,
  Briefcase,
  Sparkles,
} from "lucide-react";
import { useLang } from "@/components/lexlens/language-provider";
import { UI_LOCALE_META, UI_LOCALES } from "@/lib/lexlens/ui-i18n";

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.5 },
};

export default function HomePage() {
  const { t } = useLang();

  const steps = [
    { icon: FileUp, title: t.how_s1t, desc: t.how_s1d },
    { icon: ScanSearch, title: t.how_s2t, desc: t.how_s2d },
    { icon: ListChecks, title: t.how_s3t, desc: t.how_s3d },
  ];

  const features = [
    { icon: BookOpenCheck, title: t.feat_f1t, desc: t.feat_f1d },
    { icon: ShieldCheck, title: t.feat_f2t, desc: t.feat_f2d },
    { icon: Eye, title: t.feat_f3t, desc: t.feat_f3d },
    { icon: Lock, title: t.feat_f4t, desc: t.feat_f4d },
    { icon: Timer, title: t.feat_f5t, desc: t.feat_f5d },
    { icon: ScanSearch, title: t.feat_f6t, desc: t.feat_f6d },
  ];

  const noticeTypes = [
    { icon: Ban, label: t.types_t1 },
    { icon: Scale, label: t.types_t2 },
    { icon: Home, label: t.types_t3 },
    { icon: ShoppingBag, label: t.types_t4 },
    { icon: Gavel, label: t.types_t5 },
    { icon: Briefcase, label: t.types_t6 },
  ];

  return (
    <div className="overflow-x-clip">
      {/* ───────────────── Hero ───────────────── */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-indigo-100/70 blur-3xl" />
          <div className="absolute top-40 right-[10%] h-48 w-72 rounded-full bg-violet-100/60 blur-3xl" />
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3.5 py-1.5 text-xs font-semibold text-indigo-700">
              <Sparkles className="h-3.5 w-3.5" />
              {t.hero_badge}
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold leading-[1.12] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl"
          >
            {t.hero_title_a}{" "}
            <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 bg-clip-text text-transparent">
              {t.hero_title_b}
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.16 }}
            className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg"
          >
            {t.hero_sub}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.24 }}
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Link
              href="/analyze"
              className="group inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-200/70"
            >
              {t.hero_cta}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="#how"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-700"
            >
              {t.hero_cta2}
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-slate-500"
          >
            <span className="flex items-center gap-1.5">
              <BookOpenCheck className="h-3.5 w-3.5 text-emerald-500" /> {t.hero_b1}
            </span>
            <span className="flex items-center gap-1.5">
              <LanguagesIcon className="h-3.5 w-3.5 text-indigo-500" /> {t.hero_b2}
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-violet-500" /> {t.hero_b3}
            </span>
          </motion.div>

          {/* Mini severity preview */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="mx-auto mt-12 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3"
          >
            {[
              { c: "border-red-200 bg-red-50 text-red-700", dot: "bg-red-500", label: t.sev_red, blurb: t.sev_red_blurb },
              { c: "border-amber-200 bg-amber-50 text-amber-700", dot: "bg-amber-500", label: t.sev_yellow, blurb: t.sev_yellow_blurb },
              { c: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500", label: t.sev_green, blurb: t.sev_green_blurb },
            ].map((s) => (
              <div key={s.label} className={`rounded-xl border ${s.c} p-4 text-left`}>
                <div className="flex items-center gap-2 text-sm font-bold">
                  <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
                  {s.label}
                </div>
                <p className="mt-1.5 text-xs leading-snug opacity-80">{s.blurb}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ───────────────── How it works ───────────────── */}
      <section id="how" className="border-t border-slate-100 bg-white py-20 scroll-mt-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{t.how_title}</h2>
            <p className="mt-3 text-slate-600">{t.how_sub}</p>
          </motion.div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {steps.map((s, i) => (
              <motion.div
                key={s.title}
                {...fadeUp}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="print-card relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="absolute right-5 top-5 text-5xl font-extrabold text-slate-100">{i + 1}</span>
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                  <s.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-bold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────── Features ───────────────── */}
      <section className="border-t border-slate-100 bg-slate-50/60 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{t.feat_title}</h2>
            <p className="mt-3 text-slate-600">{t.feat_sub}</p>
          </motion.div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                {...fadeUp}
                transition={{ duration: 0.45, delay: (i % 3) * 0.08 }}
                className="print-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-50 to-violet-50 text-indigo-600 ring-1 ring-indigo-100">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-3.5 text-sm font-bold text-slate-900">{f.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────── Languages ───────────────── */}
      <section id="languages" className="border-t border-slate-100 bg-white py-20 scroll-mt-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
              <LanguagesIcon className="h-6 w-6" />
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{t.lang_title}</h2>
            <p className="mt-3 text-slate-600">{t.lang_sub}</p>
          </motion.div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {UI_LOCALES.map((loc, i) => (
              <motion.div
                key={loc}
                {...fadeUp}
                transition={{ duration: 0.45, delay: i * 0.07 }}
                className="print-card flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <span className="text-3xl" aria-hidden>{UI_LOCALE_META[loc].flag}</span>
                <div>
                  <div className="text-base font-bold text-slate-900">{UI_LOCALE_META[loc].native}</div>
                  <div className="text-xs font-medium text-slate-500">{UI_LOCALE_META[loc].en}</div>
                </div>
              </motion.div>
            ))}
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-slate-500">{t.lang_note}</p>
        </div>
      </section>

      {/* ───────────────── Notice types ───────────────── */}
      <section id="types" className="border-t border-slate-100 bg-slate-50/60 py-20 scroll-mt-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{t.types_title}</h2>
            <p className="mt-3 text-slate-600">{t.types_sub}</p>
          </motion.div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {noticeTypes.map((n, i) => (
              <motion.div
                key={n.label}
                {...fadeUp}
                transition={{ duration: 0.45, delay: (i % 3) * 0.08 }}
                className="print-card flex items-center gap-3.5 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <n.icon className="h-4.5 w-4.5" />
                </span>
                <span className="text-sm font-semibold text-slate-800">{n.label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────── Final CTA ───────────────── */}
      <section className="border-t border-slate-100 bg-white py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <motion.div
            {...fadeUp}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 px-6 py-14 text-center shadow-xl shadow-indigo-200 sm:px-12"
          >
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-12 h-56 w-56 rounded-full bg-violet-400/20 blur-2xl" />
            <h2 className="relative text-3xl font-bold tracking-tight text-white sm:text-4xl">{t.cta_title}</h2>
            <p className="relative mx-auto mt-3 max-w-xl text-indigo-100">{t.cta_sub}</p>
            <Link
              href="/analyze"
              className="group relative mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-bold text-indigo-700 shadow-lg transition-all hover:bg-indigo-50"
            >
              {t.cta_btn}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
