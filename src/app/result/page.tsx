"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  BellPlus,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Copy,
  FileText,
  GitBranch,
  Info,
  ListChecks,
  Loader2,
  MessageSquareText,
  Printer,
  RotateCcw,
  Route,
  Scale,
  ShieldAlert,
  Siren,
  Upload,
  UserRound,
} from "lucide-react";
import { useLang } from "@/components/lexlens/language-provider";
import { ActionCenter, BriefView, TimelineView } from "@/components/lexlens/case-widgets";
import { ConfidenceBar, CitationChip, DeadlineCountdown, SectionCard, SourceChip, StatusBadge, WhyBox, fmtDateFor } from "@/components/lexlens/case-ui";
import { buildBrief, briefToText, buildCaseView, buildIcs, money, templateDraft } from "@/lib/lexlens/case-engine";
import { todayISO } from "@/lib/lexlens/deadline-engine";
import { getCase, loadResult, patchCase, upsertCaseFromResult, type RunResult } from "@/lib/lexlens/run-store";
import { CORPUS } from "@/lib/lexlens/corpus";
import { parseHumanDate } from "@/lib/lexlens/fallback-analyzer";
import {
  LOCALE_LABELS,
  LANGUAGE_NAMES,
  emptyUserState,
  type CaseBase,
  type Locale,
  type LocalizedBlock,
  type UploadedEvidence,
  type UserCaseState,
  type UserPosition,
} from "@/lib/lexlens/types";

type TT = Record<string, string>;

const POSITIONS: UserPosition[] = ["agree", "partial_dispute", "full_dispute", "already_paid", "dont_recognize", "unknown"];

/* ───────────────────────── page ───────────────────────── */

function ResultInner() {
  const params = useSearchParams();
  const { locale, t } = useLang();
  const id = params.get("id");
  const tt = t as unknown as TT;

  const [record, setRecord] = useState<{ id: string | null; label: string; base: CaseBase; user: UserCaseState; noticeText: string | null } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftErr, setDraftErr] = useState("");
  const [showOriginal, setShowOriginal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savedFlash, setSavedFlash] = useState("");

  useEffect(() => {
    const sr: RunResult | null = loadResult();
    if (sr?.base && (!id || sr.draft.id === id)) {
      upsertCaseFromResult(sr);
      setRecord({ id: sr.draft.id, label: sr.draft.label, base: sr.base, user: getCase(sr.draft.id)?.user ?? emptyUserState(), noticeText: sr.draft.text });
      return;
    }
    if (id) {
      const c = getCase(id);
      if (c) {
        setRecord({ id, label: c.label, base: c.base, user: c.user, noticeText: null });
        return;
      }
    }
    setNotFound(true);
  }, [id]);

  const today = todayISO();
  const view = useMemo(
    () => (record ? buildCaseView(record.base, record.user, locale, today) : null),
    [record, locale, today]
  );

  function mutate(patch: Partial<UserCaseState>) {
    setRecord((r) => {
      if (!r) return r;
      const user = { ...r.user, ...patch };
      if (r.id) patchCase(r.id, () => user);
      return { ...r, user };
    });
  }

  function setInput(field: string, kind: "date" | "text" | "number", raw: string) {
    if (!raw.trim()) {
      const inputs = { ...record?.user.inputs };
      delete inputs[field];
      mutate({ inputs });
      return;
    }
    if (kind === "date") {
      const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : parseHumanDate(raw);
      if (!iso) return; // invalid dates are never stored
      mutate({ inputs: { ...record?.user.inputs, [field]: { value: raw, iso, num: null, at: Date.now() } } });
    } else if (kind === "number") {
      const num = Number(raw.replace(/[^\d.]/g, ""));
      mutate({ inputs: { ...record?.user.inputs, [field]: { value: raw, iso: null, num: Number.isFinite(num) ? num : null, at: Date.now() } } });
    } else {
      mutate({ inputs: { ...record?.user.inputs, [field]: { value: raw, iso: null, num: null, at: Date.now() } } });
    }
    setSavedFlash(field);
    setTimeout(() => setSavedFlash(""), 2500);
  }

  function addEvidence(files: FileList | null) {
    if (!files?.length) return;
    const ups: UploadedEvidence[] = Array.from(files).map((f, i) => ({
      id: `${Date.now()}_${i}`,
      name: f.name,
      size: f.size,
      type: f.type || "file",
      addedAt: Date.now(),
    }));
    mutate({ evidence: [...(record?.user.evidence ?? []), ...ups] });
  }

  async function generateDraft() {
    if (!record) return;
    setDraftBusy(true);
    setDraftErr("");
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notice_text: record.noticeText ?? "",
          notice_type: record.base.notice_type,
          locale,
          position: record.user.position,
          missing: view?.missing.map((m) => m.field) ?? [],
          deadline_line: view?.deadlines.find((d) => d.status === "calculated")
            ? `${view.deadlines[0].label}: ${view.deadlines[0].deadline}`
            : null,
          facts: view?.facts.filter((f) => f.value).map((f) => ({ key: f.key, value: f.value })),
        }),
      });
      const data = (await res.json()) as { draft?: string; source?: "ai" | "template"; error?: string };
      if (!data.draft) throw new Error(data.error ?? "draft failed");
      mutate({ draft: { text: data.draft, source: data.source ?? "template", at: Date.now() } });
    } catch (err) {
      const fallback = view ? templateDraft(view, locale) : "";
      if (fallback) mutate({ draft: { text: fallback, source: "template", at: Date.now() } });
      else setDraftErr(err instanceof Error ? err.message : String(err));
    } finally {
      setDraftBusy(false);
    }
  }

  function download(name: string, content: string, mime = "text/plain") {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printBrief() {
    document.body.classList.add("brief-print");
    setTimeout(() => {
      window.print();
      setTimeout(() => document.body.classList.remove("brief-print"), 400);
    }, 60);
  }

  async function copySummary() {
    if (!view) return;
    const b = record!.base.localized[locale] ?? record!.base.localized.en;
    const dl = view.deadlines.find((d) => d.status === "calculated");
    const lines = [
      "LexLens — Case summary",
      "──────────────────────────",
      b.summary,
      "",
      `${tt.ac_deadline_exact}: ${dl ? `${dl.deadline} (${dl.label})` : tt.ac_cannot_calc}`,
      "",
      `${tt.ac_next}:`,
      ...view.actions.map((a, i) => `${i + 1}. ${a.title}`),
      "",
      tt.rs_disclaimer,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  /* ── loading / not-found states ── */
  if (notFound || (!record && notFound)) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <FileText className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-xl font-bold text-slate-900">{t.rs_notfound_t}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{t.rs_notfound_d}</p>
        <Link href="/analyze" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-indigo-700">
          <RotateCcw className="h-4 w-4" /> {t.rs_notfound_cta}
        </Link>
      </div>
    );
  }
  if (!record || !view) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
      </div>
    );
  }

  const base = record.base;
  const sev = base.severity.level;
  const meta = view.deadlines.find((d) => d.status === "calculated");
  const brief = buildBrief(view, locale);
  const dlLabels = { noDate: t.rs_no_date, overdue: t.rs_overdue, today: t.rs_today, oneLeft: t.rs_1_day_left, daysLeft: t.rs_days_left, cs_overdue: t.cs_overdue, rdl_urgency_critical: t.rdl_urgency_critical, rdl_none: t.rdl_none, rs_days_left: t.rs_days_left };
  const typeI18n = { fs_document: t.fs_document, fs_user: t.fs_user, lb_verified: t.lb_verified, tl_calc: t.tl_calc };
  const sevMeta =
    sev === "red"
      ? { label: t.sev_red, cls: "border-red-200 bg-red-50", text: "text-red-700", dot: "bg-red-500" }
      : sev === "yellow"
        ? { label: t.sev_yellow, cls: "border-amber-200 bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" }
        : { label: t.sev_green, cls: "border-emerald-200 bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" };

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-indigo-50/80 to-transparent" />
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        {/* header */}
        <div className="case-nobrief flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-indigo-700">
              <ClipboardList className="h-3 w-3" /> {t.rs_kicker}
            </span>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{view.type_label}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {record.label} · {view.jurisdiction_label}
            </p>
          </div>
          <div className="no-print flex flex-wrap gap-2">
            <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700">
              <Printer className="h-3.5 w-3.5" /> {t.rs_print}
            </button>
            <button onClick={() => void copySummary()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700">
              <Copy className="h-3.5 w-3.5" /> {copied ? t.rs_copied : t.rs_copy}
            </button>
            <Link href="/analyze" className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700">
              <RotateCcw className="h-3.5 w-3.5" /> {t.rs_new}
            </Link>
          </div>
        </div>

        {/* status strip */}
        <div className="case-nobrief mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Strip icon={Siren} label={t.rs_card_sev} value={sevMeta.label} dot={sevMeta.dot} tone={sevMeta.text} />
          <Strip icon={CalendarClock} label={t.rs_deadlines_t} value={meta ? meta.deadline! : t.ac_cannot_calc} tone={meta ? "text-slate-900" : "text-amber-700"} />
          <Strip icon={ListChecks} label={t.ms_title} value={`${view.missing.length}`} sub={view.missing.length ? t.ms_sub : t.ms_none} tone={view.missing.length ? "text-amber-700" : "text-emerald-700"} />
          <Strip icon={ShieldAlert} label={t.rs_card_conf} value={`${Math.round(base.overall_confidence * 100)}%`} sub={t.rs_engine} tone={base.overall_confidence < 0.75 ? "text-amber-700" : "text-slate-900"} />
        </div>

        {/* banners */}
        <div className="case-nobrief mt-4 space-y-3">
          {base.overall_confidence < 0.75 && (
            <div className="flex items-start gap-3.5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <div className="text-sm font-extrabold text-amber-800">{t.rs_lowconf_t}</div>
                <p className="mt-1 text-sm leading-relaxed text-amber-800/90">{t.rs_lowconf_d}</p>
              </div>
            </div>
          )}
          {record.base && (
            <SafetyEditsNote base={record.base} tt={tt} />
          )}
        </div>

        {/* 1 · ACTION CENTER */}
        <div className="case-nobrief mt-6">
          <ActionCenter view={view} t={tt} locale={locale} />
        </div>

        {/* 2 · DEADLINE */}
        <div className="case-nobrief mt-5">
          <SectionCard icon={CalendarClock} title={t.rdl_title} sub={t.rdl_sub}>
            <div className="grid gap-4">
              {view.deadlines.map((d, i) => {
                const u = d.status === "calculated" ? d.days_left : null;
                return (
                  <div key={i} className={`rounded-xl border p-4 ${d.status === "calculated" ? "border-slate-200" : "border-amber-200 bg-amber-50/50"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide ${d.status === "calculated" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-300 bg-amber-50 text-amber-700"}`}>
                        {d.status === "calculated" ? `✓ ${t.rdl_calculated}` : `⚠ ${t.rdl_missing}`}
                      </span>
                      {d.status === "calculated" && <DeadlineCountdown daysLeft={u} t={dlLabels} />}
                    </div>
                    <p className="mt-2.5 text-sm font-bold text-slate-900">{d.label}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{d.description}</p>

                    {d.status === "calculated" ? (
                      <>
                        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <span className="font-mono text-2xl font-extrabold text-slate-900">{fmtDateFor(d.deadline, locale)}</span>
                          <span className="text-xs font-semibold text-slate-500">
                            {d.anchor_source === "user_input" ? t.rdl_from_user : t.rdl_from_doc}
                          </span>
                        </div>
                        <WhyBox label={t.ac_why}>
                          <span className="font-semibold">{t.rdl_method}</span>
                          <br />
                          {d.anchor_field
                            ? `${fmtDateFor(d.anchor_date, locale)} (${d.anchor_source === "user_input" ? t.tl_user : t.tl_doc}) + ${d.period_days} ${d.business_days ? "business" : ""} days`
                            : ""}
                          {d.rule_source_id && (
                            <span className="mt-1.5 block"><CitationChip sid={d.rule_source_id} /></span>
                          )}
                        </WhyBox>
                        {d.days_left !== null && d.days_left > 1 && (
                          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                            <BellPlus className="h-4 w-4 text-slate-400" />
                            <span className="text-[11px] font-semibold text-slate-500">{t.ev_upload !== undefined ? "" : ""}{t.rs_basis !== undefined ? "" : ""}</span>
                            {[7, 3, 1].map((n) => (
                              <button
                                key={n}
                                onClick={() => download(`lexlens-reminder-${n}d.ics`, buildIcs(d.deadline!, d.label, n), "text/calendar")}
                                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
                              >
                                −{n} {locale === "en" ? (n === 1 ? "day" : "days") : locale === "hi" ? "दिन" : locale === "zh" ? "天" : "jour(s)"}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="mt-3">
                        <p className="text-[13px] font-medium leading-relaxed text-amber-800">{d.missing_reason}</p>
                        {d.anchor_field && d.anchor_field !== "explicit" && (
                          <div className="mt-2.5 flex flex-wrap items-center gap-2">
                            <input
                              type="date"
                              value={record.user.inputs[d.anchor_field]?.iso ?? ""}
                              onChange={(e) => setInput(d.anchor_field!, "date", e.target.value)}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                            />
                            <span className={`text-[11px] font-bold text-emerald-600 ${savedFlash === d.anchor_field ? "opacity-100" : "opacity-0"} transition-opacity`}>
                              {t.ms_added}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {view.deadlines.length === 0 && (
                <p className="flex items-start gap-2 text-sm text-slate-500">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /> {t.rdl_none}
                </p>
              )}
            </div>
          </SectionCard>
        </div>

        {/* 3 · TIMELINE */}
        <div className="case-nobrief mt-5">
          <SectionCard icon={GitBranch} title={t.tl_title} sub={t.tl_input_required + " → " + t.ms_add}>
            <TimelineView view={view} t={tt} locale={locale} />
          </SectionCard>
        </div>

        {/* 4 · KEY FACTS */}
        <div className="case-nobrief mt-5">
          <SectionCard icon={ListChecks} title={t.kt_title} sub={t.kt_sub}>
            <div className="grid gap-2.5">
              {view.facts.map((f) => (
                <div key={f.key} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{f.label}</span>
                      {f.feeds_deadline && (
                        <span className="rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-indigo-600">{t.kt_feeds}</span>
                      )}
                    </div>
                    <StatusBadge status={f.status} t={tt} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                    <span className={`text-[15px] font-extrabold ${f.value ? (f.kind === "money" ? "text-indigo-700" : "text-slate-900") : "text-slate-400"}`}>
                      {f.kind === "date" && f.value ? fmtDateFor(f.value, locale) : f.value || t.kt_missing}
                    </span>
                    {f.confidence !== null && <ConfidenceBar value={f.confidence} label={t.kt_conf_med} />}
                  </div>
                  <WhyBox label={t.kt_show_why}>
                    <span className="font-semibold">{t.ac_source}:</span>{" "}
                    {f.source.kind === "user_input" ? t.fs_user : f.source.ref ?? "—"}
                    {f.confidence !== null && (
                      <span className="block text-slate-500">
                        {t.rs_card_conf}: {Math.round(f.confidence * 100)}%
                      </span>
                    )}
                  </WhyBox>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* 5 · MISSING INFORMATION */}
        <div className="case-nobrief mt-5">
          <SectionCard
            icon={AlertTriangle}
            title={t.ms_title}
            sub={t.ms_sub}
            tone={view.missing.length ? "border-amber-200" : "border-emerald-200"}
          >
            {view.missing.length === 0 ? (
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="h-4.5 w-4.5" /> {t.ms_none}
              </p>
            ) : (
              <div className="grid gap-3">
                {view.missing.map((m) => (
                  <div key={m.field} className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-900">⚠ {m.label}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide ${
                        m.importance === "critical"
                          ? "border-red-200 bg-red-50 text-red-700"
                          : m.importance === "high"
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-slate-200 bg-slate-50 text-slate-500"
                      }`}>
                        {m.importance === "critical" ? t.ms_critical : m.importance === "high" ? t.ms_high : t.ms_medium}
                      </span>
                    </div>
                    <div className="mt-2">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{t.ms_why}</span>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-slate-700">{m.why}</p>
                      {m.source_id && <div className="mt-1.5"><CitationChip sid={m.source_id} /></div>}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {m.input === "date" ? (
                        <input
                          type="date"
                          placeholder={t.ms_date_ph}
                          value={record.user.inputs[m.field]?.iso ?? ""}
                          onChange={(e) => setInput(m.field, "date", e.target.value)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                        />
                      ) : (
                        <input
                          type={m.input === "number" ? "number" : "text"}
                          placeholder={m.input === "number" ? "0" : t.ms_text_ph}
                          value={record.user.inputs[m.field]?.value ?? ""}
                          onChange={(e) => setInput(m.field, m.input, e.target.value)}
                          className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                        />
                      )}
                      <span className={`text-[11px] font-bold text-emerald-600 transition-opacity ${savedFlash === m.field ? "opacity-100" : "opacity-0"}`}>
                        {t.ms_added}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* 6 · EVIDENCE */}
        <div className="case-nobrief mt-5">
          <SectionCard icon={FileText} title={t.ev_title} sub={t.ev_sub}>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {view.evidence.map((e) => (
                <div key={e.key} className={`rounded-xl border p-3.5 ${e.have ? "border-emerald-200 bg-emerald-50/40" : "border-dashed border-amber-300 bg-amber-50/30"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[13px] font-bold text-slate-900">{e.have ? "✓" : "⚠"} {e.label}</span>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${e.have ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                      {e.have ? t.ev_have : t.ev_missing}
                    </span>
                  </div>
                  {e.claim_link && <p className="mt-1 text-[12px] leading-relaxed text-slate-600"><span className="font-semibold">{t.ev_supports}</span> {e.claim_link}</p>}
                  {!e.from_upload && !e.have && (
                    <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-800">
                      <Upload className="h-3.5 w-3.5" /> {t.ev_upload}
                      <input type="file" className="hidden" onChange={(ev) => addEvidence(ev.target.files)} />
                    </label>
                  )}
                </div>
              ))}
            </div>
            {record.user.evidence.length > 0 && (
              <p className="mt-3 text-[11px] leading-relaxed text-slate-400">{t.ev_meta_note}</p>
            )}
          </SectionCard>
        </div>

        {/* 7 · LEGAL BASIS */}
        <div className="case-nobrief mt-5">
          <SectionCard icon={BookOpenCheck} title={t.lb_title} sub={t.lb_sub}>
            {base.citations.length === 0 ? (
              <p className="flex items-start gap-2 text-sm text-slate-500">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /> {t.lb_none}
              </p>
            ) : (
              <div className="grid gap-2.5">
                {base.citations.map((c, i) => {
                  const entry = CORPUS.find((x) => x.source_id === c.source_id);
                  return (
                    <details key={i} className="group rounded-xl border border-slate-200 open:bg-indigo-50/30">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3.5">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-indigo-800">
                            <BookOpenCheck className="h-4 w-4 shrink-0" />
                            {entry?.title ?? c.source_id}
                            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-700">{t.lb_verified}</span>
                          </div>
                          <p className="mt-0.5 text-[13px] text-slate-600">{c.relevance}</p>
                        </div>
                        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
                      </summary>
                      {entry && <p className="border-t border-indigo-100 px-4 py-3 text-[13px] leading-relaxed text-slate-600">{entry.text}</p>}
                    </details>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        {/* 8 · WHAT HAPPENS NEXT */}
        <div className="case-nobrief mt-5">
          <SectionCard icon={Route} title={t.wn_title} sub={t.wn_sub}>
            <ol className="relative space-y-4">
              {view.consequences.map((c, i) => (
                <li key={c.key} className="relative flex gap-3.5 pb-1 last:pb-0">
                  {i < view.consequences.length - 1 && <span className="absolute left-[11px] top-6 h-[calc(100%-1.5rem)] w-0.5 bg-slate-200" aria-hidden />}
                  <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white ${
                    c.tone === "danger" ? "bg-red-500" : c.tone === "warning" ? "bg-amber-500" : "bg-slate-400"
                  }`}>
                    {i + 1}
                  </span>
                  <p className="text-[13.5px] leading-relaxed text-slate-700">{c.text}</p>
                </li>
              ))}
            </ol>
          </SectionCard>
        </div>

        {/* 9 · YOUR POSITION */}
        <div className="case-nobrief mt-5">
          <SectionCard icon={UserRound} title={t.ps_title} sub={t.ps_sub}>
            <div className="grid gap-2 sm:grid-cols-2">
              {POSITIONS.map((p) => {
                const active = record.user.position === p;
                return (
                  <button
                    key={p}
                    onClick={() => mutate({ position: p })}
                    className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left text-sm font-semibold transition-colors ${
                      active ? "border-indigo-400 bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200" : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/40"
                    }`}
                    aria-pressed={active}
                  >
                    <span className={`flex h-4.5 w-4.5 items-center justify-center rounded-full border-2 ${active ? "border-indigo-600" : "border-slate-300"}`}>
                      {active && <span className="h-2 w-2 rounded-full bg-indigo-600" />}
                    </span>
                    {t[`ps_${p}`]}
                  </button>
                );
              })}
            </div>
            {record.user.position && <p className="mt-3 text-[12px] font-bold text-emerald-600">✓ {t.ps_saved}</p>}
          </SectionCard>
        </div>

        {/* 10 · RESPONSE DRAFT */}
        <div className="case-nobrief mt-5">
          <SectionCard icon={MessageSquareText} title={t.rd_title} sub={t.rd_sub}>
            {!record.user.draft ? (
              <button
                onClick={() => void generateDraft()}
                disabled={draftBusy}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-60"
              >
                {draftBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquareText className="h-4 w-4" />}
                {draftBusy ? t.rd_generating : t.rd_generate}
              </button>
            ) : (
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                    {record.user.draft.source === "ai" ? t.rd_ai : t.rd_template}
                  </span>
                  <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">⚠ {t.rd_tag}</span>
                  <button onClick={() => void generateDraft()} disabled={draftBusy} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-60">
                    {draftBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                    {t.rd_regenerate}
                  </button>
                  <button
                    onClick={() => void navigator.clipboard.writeText(record.user.draft!.text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {})}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
                  >
                    <Copy className="h-3.5 w-3.5" /> {copied ? t.rd_copied : t.rd_copy}
                  </button>
                  <button onClick={() => download("lexlens-response-draft.txt", record.user.draft!.text)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-700">
                    <FileText className="h-3.5 w-3.5" /> {t.rd_download}
                  </button>
                </div>
                <DraftText text={record.user.draft.text} />
              </div>
            )}
            {draftErr && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">{draftErr}</p>}
          </SectionCard>
        </div>

        {/* 11 · LAWYER BRIEF */}
        <div className="case-nobrief mt-5">
          <SectionCard icon={Scale} title={t.br_title} sub={t.br_sub}>
            {!briefOpen ? (
              <button
                onClick={() => setBriefOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-800"
              >
                <Scale className="h-4 w-4" /> {t.br_prepare}
              </button>
            ) : (
              <div>
                <div className="no-print mb-3 flex justify-end">
                  <button onClick={() => setBriefOpen(false)} className="text-[11px] font-bold text-slate-500 hover:text-slate-800">
                    {t.br_hide}
                  </button>
                </div>
                <BriefView
                  brief={brief}
                  t={tt}
                  locale={locale}
                  onPrint={printBrief}
                  onDownload={() => download("lexlens-case-brief.txt", briefToText(brief, locale))}
                />
              </div>
            )}
          </SectionCard>
        </div>

        {/* 12 · PLAIN-LANGUAGE EXPLANATION */}
        <div className="case-nobrief mt-5">
          <PlainLanguageCard base={base} locale={locale} tt={tt} />
        </div>

        {/* red CTA */}
        {sev === "red" && (
          <div className="case-nobrief print-card mt-5 rounded-2xl border-2 border-red-300 bg-gradient-to-br from-red-50 to-white p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
                <Siren className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-extrabold text-red-800">{t.rs_red_t}</h3>
                <p className="mt-1 text-sm leading-relaxed text-red-700">{t.rs_red_d}</p>
              </div>
            </div>
          </div>
        )}

        {/* report details */}
        <div className="case-nobrief mt-5">
          <ReportDetails record={record} tt={tt} locale={locale} showOriginal={showOriginal} setShowOriginal={setShowOriginal} />
        </div>

        {/* disclaimer */}
        <div className="case-nobrief print-card mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-5 text-center">
          <p className="mx-auto max-w-2xl text-xs leading-relaxed text-slate-500">{t.rs_disclaimer}</p>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── sub-components ───────────────────────── */

function Strip({ icon: Icon, label, value, sub, dot, tone = "text-slate-900" }: { icon: React.ElementType; label: string; value: string; sub?: string; dot?: string; tone?: string }) {
  return (
    <div className="print-card rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
        <Icon className="h-3.5 w-3.5 text-indigo-500" />
        {label}
      </div>
      <div className={`mt-1 flex items-center gap-1.5 text-[13px] font-extrabold ${tone}`}>
        {dot && <span className={`h-2 w-2 rounded-full ${dot}`} />}
        <span className="truncate">{value}</span>
      </div>
      {sub && <div className="mt-0.5 truncate text-[10.5px] text-slate-400">{sub}</div>}
    </div>
  );
}

function SafetyEditsNote({ base, tt }: { base: CaseBase; tt: TT }) {
  const meta = loadMeta();
  const edits = meta?.safety_edits ?? [];
  if (!edits.length) return null;
  return (
    <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <summary className="cursor-pointer list-none text-[13px] font-bold text-slate-700">
        🛡 {tt.rs_safety} — {edits.length}
      </summary>
      <ul className="mt-2 space-y-1">
        {edits.map((e: string, i: number) => (
          <li key={i} className="font-mono text-[11px] text-slate-500">✓ {e}</li>
        ))}
      </ul>
    </details>
  );
}

function loadMeta(): { safety_edits: string[]; model: string } | null {
  const sr = loadResult();
  if (sr) return { safety_edits: sr.pipeline_meta?.safety_edits ?? [], model: sr.pipeline_meta?.model ?? "" };
  return null;
}

function DraftText({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]\n]{8,90}\])/g);
  return (
    <div className="custom-scroll max-h-[480px] overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50/70 p-4 font-legal text-[13.5px] leading-relaxed text-slate-800">
      {parts.map((p, i) =>
        /^\[[^\]\n]{8,90}\]$/.test(p) ? (
          <mark key={i} className="rounded bg-amber-100 px-1 font-sans text-[12px] font-bold text-amber-900 ring-1 ring-amber-200">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </div>
  );
}

function PlainLanguageCard({ base, locale, tt }: { base: CaseBase; locale: Locale; tt: TT }) {
  const [viewL, setViewL] = useState<Locale>(locale);
  const block: LocalizedBlock = base.localized[viewL] ?? base.localized.en;
  const langCls = viewL === "hi" ? "lang-hi" : viewL === "zh" ? "lang-zh" : "";
  return (
    <SectionCard icon={ClipboardList} title={tt.rs_summary_t} sub={tt.rs_summary_hint}>
      <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Explanation language">
        {(["en", "hi", "zh", "fr"] as Locale[]).map((l) => (
          <button
            key={l}
            role="tab"
            aria-selected={viewL === l}
            onClick={() => setViewL(l)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
              viewL === l ? "bg-indigo-600 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
            }`}
          >
            {LOCALE_LABELS[l].native}
          </button>
        ))}
      </div>
      <p className={`text-[15px] leading-relaxed text-slate-700 ${langCls}`}>{block.summary}</p>
      {block.key_risk && (
        <div className={`mt-5 rounded-xl border border-red-200 bg-red-50/70 p-4 ${langCls}`}>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-red-700">
            <Siren className="h-4 w-4" />
            {tt.rs_keyrisk_t}
          </div>
          <p className="mt-1.5 text-sm font-semibold leading-relaxed text-red-800">{block.key_risk}</p>
        </div>
      )}
      {block.rights.length > 0 && (
        <div className="mt-6">
          <h3 className={`text-sm font-bold text-slate-900 ${langCls}`}>{tt.rs_rights_t}</h3>
          <ul className={`mt-3 space-y-3 ${langCls}`}>
            {block.rights.map((r, i) => (
              <li key={i} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
                <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-emerald-500" />
                <div>
                  <span className="text-sm font-bold text-slate-800">{r.title}</span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-slate-600">{r.detail}</span>
                  {r.source_id && <div className="mt-1.5"><CitationChip sid={r.source_id} /></div>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {block.next_steps.length > 0 && (
        <div className="mt-6">
          <h3 className={`text-sm font-bold text-slate-900 ${langCls}`}>
            {tt.rs_steps_t}
            <span className="ml-2 font-medium text-slate-400">{tt.rs_steps_sub}</span>
          </h3>
          <ol className="mt-3 space-y-0">
            {block.next_steps.map((s, i) => (
              <li key={i} className={`relative flex gap-3.5 pb-4 last:pb-0 ${langCls}`}>
                {i < block.next_steps.length - 1 && <span className="absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-0.5 bg-indigo-100" aria-hidden />}
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">{i + 1}</span>
                <p className="pt-1 text-sm leading-relaxed text-slate-700">{s}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </SectionCard>
  );
}

function ReportDetails({
  record,
  tt,
  locale,
  showOriginal,
  setShowOriginal,
}: {
  record: { id: string | null; label: string; base: CaseBase; noticeText: string | null };
  tt: TT;
  locale: Locale;
  showOriginal: boolean;
  setShowOriginal: (v: boolean) => void;
}) {
  const meta = loadMeta();
  return (
    <SectionCard icon={FileText} title={tt.rs_details_t}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
        {[
          [tt.rs_engine, meta?.model ?? "—"],
          [tt.rs_card_lang, LANGUAGE_NAMES[record.base.language_detected] ?? record.base.language_detected],
          [tt.rs_chars, meta ? String(Math.max(record.noticeText?.length ?? 0, 0)) : "—"],
          [tt.rs_corpus, String(CORPUS.length)],
          [tt.rs_safety, meta?.safety_edits?.length ? `${meta.safety_edits.length} ✓` : tt.rs_safety_none],
          [tt.rs_card_from, `${record.base.sender.name} (${record.base.sender.type})`],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{k}</dt>
            <dd className="mt-0.5 truncate font-medium text-slate-800" title={String(v)}>{v}</dd>
          </div>
        ))}
      </dl>

      {record.noticeText && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <button onClick={() => setShowOriginal(!showOriginal)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700 hover:text-indigo-800">
            <ChevronDown className={`h-4 w-4 transition-transform ${showOriginal ? "rotate-180" : ""}`} />
            {tt.rs_original}
          </button>
          {showOriginal && (
            <div className="mt-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{tt.rs_original_t}</div>
              <pre className="font-legal custom-scroll max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-[13.5px] leading-relaxed text-slate-800">
                {record.noticeText}
              </pre>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

export default function ResultPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      }
    >
      <ResultInner />
    </Suspense>
  );
}
