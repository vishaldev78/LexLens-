"use client";

// LexLens — notice report page (DB-backed).
// Loads the stored analysis report for this notice; every mutation is saved to
// the workspace via the API so reports can be reopened any time.

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  BellPlus,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Copy,
  Download,
  FileText,
  GitBranch,
  Info,
  ListChecks as ListChecksIcon,
  Loader2,
  MessageSquareText,
  Printer,
  RotateCcw,
  Route,
  Scale,
  ShieldAlert,
  Siren,
  Trash2,
  Upload,
  UserRound,
  Languages,
} from "lucide-react";
import { useLang } from "@/components/lexlens/language-provider";
import { ActionCenter, BriefView, TimelineView } from "@/components/lexlens/case-widgets";
import { ReminderSection } from "@/components/lexlens/reminder-card";
import { ConfidenceBar, CitationChip, DeadlineCountdown, SectionCard, StatusBadge, WhyBox, fmtDateFor } from "@/components/lexlens/case-ui";
import { buildBrief, briefToText, buildCaseView, buildIcs, templateDraft } from "@/lib/lexlens/case-engine";
import { todayISO } from "@/lib/lexlens/deadline-engine";
import { parseHumanDate } from "@/lib/lexlens/fallback-analyzer";
import { CORPUS } from "@/lib/lexlens/corpus";
import {
  OUTPUT_LOCALES,
  LANGUAGE_NAMES,
  LOCALE_LABELS,
  type CaseBase,
  type LocalizedBlock,
  type Locale,
  type ReminderDTO,
  type UserCaseState,
  type UserPosition,
} from "@/lib/lexlens/types";

type TT = Record<string, string>;

const POSITIONS: UserPosition[] = ["agree", "partial_dispute", "full_dispute", "already_paid", "dont_recognize", "unknown"];

const STATUS_KEY: Record<string, string> = {
  ACTIVE: "nl_status_active",
  DUE_SOON: "nl_status_due_soon",
  DUE_TODAY: "nl_status_due_today",
  OVERDUE: "nl_status_overdue",
  COMPLETED: "nl_status_completed",
  NO_DEADLINE: "nl_status_no_deadline",
  UNKNOWN_DEADLINE: "nl_status_unknown",
};

interface NoticeSummary {
  id: string;
  title: string;
  noticeType: string;
  severity: string;
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

interface Detail {
  notice: NoticeSummary;
  base: CaseBase | null;
  userState: UserCaseState;
  hasBrief: boolean;
  reminder: ReminderDTO | null;
  evidenceRows: { id: string; name: string; size: number; mimeType: string; createdAt: string }[];
  noticeText: string | null;
}

/* ───────────────────────── page ───────────────────────── */

function ReportInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useLang();
  const tt = t as unknown as TT;

  const [detail, setDetail] = useState<Detail | null>(null);
  const [failed, setFailed] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [savedFlash, setSavedFlash] = useState("");
  const [receiptInput, setReceiptInput] = useState("");
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [retryBusy, setRetryBusy] = useState(false);
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftErr, setDraftErr] = useState("");
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [copied, setCopied] = useState(false);

  const inputTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/notices/${id}`, { cache: "no-store" });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      setDetail((await res.json()) as Detail);
    } catch {
      setFailed(true);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const today = todayISO();
  const view = useMemo(
    () => (detail?.base ? buildCaseView(detail.base, detail.userState, locale, today) : null),
    [detail, locale, today],
  );

  function flash(key: string) {
    setSavedFlash(key);
    setTimeout(() => setSavedFlash(""), 2500);
  }

  /** Patch the workspace record, then refresh the server-computed summary. */
  async function patchNotice(body: Record<string, unknown>): Promise<boolean> {
    try {
      const res = await fetch(`/api/notices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return false;
      await load();
      return true;
    } catch {
      return false;
    }
  }

  function saveReceipt(raw: string) {
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : parseHumanDate(raw);
    if (!iso) return;
    setReceiptBusy(true);
    void patchNotice({ receiptDate: iso }).then((ok) => {
      setReceiptBusy(false);
      if (ok) {
        setReceiptInput("");
        flash("receipt_saved");
      }
    });
  }

  function setInput(field: string, kind: "date" | "text" | "number", raw: string) {
    if (!detail) return;
    const inputs = { ...detail.userState.inputs };
    if (!raw.trim()) {
      delete inputs[field];
      setDetail({ ...detail, userState: { ...detail.userState, inputs } });
    } else if (kind === "date") {
      const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : parseHumanDate(raw);
      if (!iso) return; // invalid dates are never stored
      inputs[field] = { value: raw, iso, num: null, at: Date.now() };
      setDetail({ ...detail, userState: { ...detail.userState, inputs } });
    } else if (kind === "number") {
      const num = Number(raw.replace(/[^\d.]/g, ""));
      inputs[field] = { value: raw, iso: null, num: Number.isFinite(num) ? num : null, at: Date.now() };
      setDetail({ ...detail, userState: { ...detail.userState, inputs } });
    } else {
      inputs[field] = { value: raw, iso: null, num: null, at: Date.now() };
      setDetail({ ...detail, userState: { ...detail.userState, inputs } });
    }
    flash(field);
    clearTimeout(inputTimers.current[field]);
    inputTimers.current[field] = setTimeout(() => {
      void patchNotice({ inputs: detail.userState.inputs });
    }, 600);
  }

  function setPosition(p: UserPosition) {
    if (!detail) return;
    setDetail({ ...detail, userState: { ...detail.userState, position: p } });
    void patchNotice({ position: p });
  }

  async function addEvidence(files: FileList | null) {
    if (!files?.length || !detail) return;
    setEvidenceBusy(true);
    try {
      const form = new FormData();
      Array.from(files)
        .slice(0, 6)
        .forEach((f) => form.append("files", f));
      const res = await fetch(`/api/notices/${id}/evidence`, { method: "POST", body: form });
      if (res.ok) {
        await load();
        flash("evidence");
      }
    } finally {
      setEvidenceBusy(false);
    }
  }

  async function generateDraft() {
    if (!detail || !view) return;
    setDraftBusy(true);
    setDraftErr("");
    try {
      const res = await fetch(`/api/notices/${id}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      const data = (await res.json()) as { draft?: string; source?: "ai" | "template"; error?: string };
      if (!data.draft) throw new Error(data.error ?? "draft failed");
      setDetail({ ...detail, userState: { ...detail.userState, draft: { text: data.draft, source: data.source ?? "template", at: Date.now() } } });
    } catch {
      const fallback = templateDraft(view, locale);
      if (fallback) {
        setDetail({ ...detail, userState: { ...detail.userState, draft: { text: fallback, source: "template", at: Date.now() } } });
      } else {
        setDraftErr(tt.rd_error ?? "Could not prepare the draft. Please try again.");
      }
    } finally {
      setDraftBusy(false);
    }
  }

  const brief = useMemo(() => (view ? buildBrief(view, locale) : null), [view, locale]);

  function openBrief() {
    setBriefOpen(true);
    // Persist the brief for future sessions (fire-and-forget).
    void fetch(`/api/notices/${id}/brief`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    }).catch(() => {});
  }

  async function retryAnalysis() {
    setRetryBusy(true);
    try {
      const res = await fetch(`/api/notices/${id}/analyze`, { method: "POST" });
      if (res.ok) await load();
    } finally {
      setRetryBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(tt.nl_confirm)) return;
    const res = await fetch(`/api/notices/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/analyze");
  }

  function downloadFile(name: string, content: string, mime = "text/plain") {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copySummary() {
    if (!view || !detail?.base) return;
    const b = detail.base.localized[locale] ?? detail.base.localized.en;
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

  /* ── states ── */
  if (notFound) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <FileText className="mx-auto h-10 w-10 text-slate-300" />
        <h1 className="mt-4 text-xl font-bold text-slate-900">{tt.rs_notfound_t}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{tt.rs_notfound_d}</p>
        <Link href="/analyze" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-indigo-700">
          {tt.nav_analyze}
        </Link>
      </div>
    );
  }
  if (failed) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-4 text-lg font-bold text-slate-900">{tt.cm_error}</h1>
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
      </div>
    );
  }

  const n = detail.notice;
  const base = detail.base;
  const hasReport = !!base && (n.analysisStatus === "READY" || !!base);

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-indigo-50/80 to-transparent" />
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        {!hasReport ? (
          <PendingCard n={n} tt={tt} retryBusy={retryBusy} onRetry={() => void retryAnalysis()} onRemove={() => void remove()} />
        ) : (
          <>
            <ReportBody
              detail={detail}
              view={view!}
              tt={tt}
              locale={locale}
              brief={brief!}
              flags={{
                savedFlash,
                receiptInput,
                setReceiptInput,
                receiptBusy,
                retryBusy,
                draftBusy,
                draftErr,
                evidenceBusy,
                briefOpen,
                setBriefOpen,
                showOriginal,
                setShowOriginal,
                copied,
              }}
              actions={{
                saveReceipt,
                refresh: () => void load(),
                setInput,
                setPosition,
                addEvidence,
                generateDraft,
                openBrief,
                retryAnalysis: () => void retryAnalysis(),
                remove: () => void remove(),
                patchNotice,
                downloadFile,
                copySummary: () => void copySummary(),
                printBrief: () => {
                  document.body.classList.add("brief-print");
                  setTimeout(() => {
                    window.print();
                    setTimeout(() => document.body.classList.remove("brief-print"), 400);
                  }, 60);
                },
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── pending / failed card ───────────────────────── */

function PendingCard({
  n,
  tt,
  retryBusy,
  onRetry,
  onRemove,
}: {
  n: NoticeSummary;
  tt: TT;
  retryBusy: boolean;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const failed = n.analysisStatus === "FAILED";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <span
        className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${
          failed ? "bg-red-50 text-red-500" : "bg-indigo-50 text-indigo-500"
        }`}
      >
        {failed ? <AlertTriangle className="h-7 w-7" /> : <Loader2 className="h-7 w-7 animate-spin" />}
      </span>
      <h1 className="mt-4 text-xl font-extrabold text-slate-900">{failed ? tt.rp_status_failed : tt.rp_status}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">{failed ? tt.nl_retry : tt.nl_empty_d}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
        <button
          onClick={onRetry}
          disabled={retryBusy}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
        >
          {retryBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          {failed ? tt.nl_retry : tt.rp_retry}
        </button>
        <button
          onClick={onRemove}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-red-600 hover:border-red-300 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" /> {tt.rp_del}
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────── report body ───────────────────────── */

interface Flags {
  savedFlash: string;
  receiptInput: string;
  setReceiptInput: (v: string) => void;
  receiptBusy: boolean;
  retryBusy: boolean;
  draftBusy: boolean;
  draftErr: string;
  evidenceBusy: boolean;
  briefOpen: boolean;
  setBriefOpen: (v: boolean) => void;
  showOriginal: boolean;
  setShowOriginal: (v: boolean) => void;
  copied: boolean;
}

interface Actions {
  saveReceipt: (raw: string) => void;
  refresh: () => void;
  setInput: (field: string, kind: "date" | "text" | "number", raw: string) => void;
  setPosition: (p: UserPosition) => void;
  addEvidence: (files: FileList | null) => Promise<void>;
  generateDraft: () => Promise<void>;
  openBrief: () => void;
  retryAnalysis: () => void;
  remove: () => void;
  patchNotice: (body: Record<string, unknown>) => Promise<boolean>;
  downloadFile: (name: string, content: string, mime?: string) => void;
  copySummary: () => void;
  printBrief: () => void;
}

function ReportBody({
  detail,
  view,
  tt,
  locale,
  brief,
  flags,
  actions,
}: {
  detail: Detail;
  view: NonNullable<ReturnType<typeof buildCaseView>>;
  tt: TT;
  locale: Locale;
  brief: ReturnType<typeof buildBrief>;
  flags: Flags;
  actions: Actions;
}) {
  const { notice: n } = detail;
  const base = detail.base!;
  const sev = base.severity.level;
  const meta = view.deadlines.find((d) => d.status === "calculated");
  // The reminder UI attaches to the PRIMARY calculated deadline only — there is
  // at most one ACTIVE reminder per notice (the deterministic deadline anchor).
  const primaryDeadlineIdx = view.deadlines.findIndex((d) => d.status === "calculated");
  const dlLabels = { noDate: tt.rs_no_date, overdue: tt.rs_overdue, today: tt.rs_today, oneLeft: tt.rs_1_day_left, daysLeft: tt.rs_days_left, cs_overdue: tt.cs_overdue, rdl_urgency_critical: tt.rdl_urgency_critical, rdl_none: tt.rdl_none, rs_days_left: tt.rs_days_left };

  const [completedBusy, setCompletedBusy] = useState(false);

  async function toggleCompleted() {
    setCompletedBusy(true);
    await actions.patchNotice({ completed: !n.completed });
    setCompletedBusy(false);
  }

  return (
    <>
      {/* header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-indigo-700">
            <ClipboardList className="h-3 w-3" /> {tt.rs_kicker}
          </span>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{view.type_label}</h1>
          <p className="mt-1 truncate text-sm text-slate-500">
            {n.title} · {view.jurisdiction_label}
          </p>
          {/* PRD §14 — deterministic classification (never "debt collection" for a §138 notice) */}
          <p className="mt-1.5 text-[13px] font-medium text-slate-600">
            {tt.cls_primary}: <span className="font-bold text-slate-800">{view.classification.primary}</span>
            {view.classification.subcategory && (
              <>
                {" · "}{tt.cls_sub}: <span className="font-bold text-slate-800">{view.classification.subcategory}</span>
              </>
            )}
            {view.classification.secondary && (
              <>
                {" · "}{tt.cls_secondary}: <span className="text-slate-600">{view.classification.secondary}</span>
              </>
            )}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide ${
              n.status === "COMPLETED"
                ? "border-slate-200 bg-slate-100 text-slate-600"
                : n.status === "ACTIVE"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : n.status === "DUE_SOON"
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-red-200 bg-red-50 text-red-700"
            }`}>
              {tt[STATUS_KEY[n.status] ?? "nl_status_unknown"]}
            </span>
            {n.claimedAmount && <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[10.5px] font-extrabold text-indigo-700">{n.claimedAmount}</span>}
          </div>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <a
            href={`/api/notices/${n.id}/pdf`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700"
          >
            <Download className="h-3.5 w-3.5" /> {tt.rp_download_pdf}
          </a>
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700">
            <Printer className="h-3.5 w-3.5" /> {tt.rs_print}
          </button>
          <button onClick={actions.copySummary} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700">
            <Copy className="h-3.5 w-3.5" /> {flags.copied ? tt.rs_copied : tt.rs_copy}
          </button>
          <button
            onClick={() => void toggleCompleted()}
            disabled={completedBusy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-60"
          >
            {completedBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {n.completed ? tt.nl_reopen : tt.nl_completed}
          </button>
          <button onClick={actions.remove} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:border-red-300 hover:bg-red-50">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          {/* PRD §38 — Start New Analysis: fresh anonymous session, nothing carried over */}
          <button
            onClick={async () => {
              await fetch("/api/session/new", { method: "POST" }).catch(() => {});
              try { sessionStorage.clear(); } catch { /* private mode */ }
              window.location.href = "/analyze"; // full reload clears all client-side state
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:border-indigo-300 hover:bg-indigo-100"
            title={tt.start_new_confirm}
          >
            <RotateCcw className="h-3.5 w-3.5" /> {tt.start_new}
          </button>
        </div>
      </div>

      {/* status strip */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Strip icon={Siren} label={tt.rs_card_sev} value={sev === "red" ? tt.sev_red : sev === "yellow" ? tt.sev_yellow : tt.sev_green} dot={sev === "red" ? "bg-red-500" : sev === "yellow" ? "bg-amber-500" : "bg-emerald-500"} />
        <Strip icon={CalendarClock} label={tt.rs_deadlines_t} value={meta ? meta.deadline! : tt.ac_cannot_calc} tone={meta ? "text-slate-900" : "text-amber-700"} />
        <Strip icon={ListChecksIcon} label={tt.ms_title} value={`${view.missing.length}`} sub={view.missing.length ? tt.ms_sub : tt.ms_none} tone={view.missing.length ? "text-amber-700" : "text-emerald-700"} />
        <Strip icon={ShieldAlert} label={tt.rp_status} value={`✓ ${tt.rp_engine_ok}`} sub={tt.rp_sources_ok} tone="text-emerald-700" />
      </div>

      {/* banners */}
      <div className="mt-4 space-y-3">
        {/* PRD §3 — UNKNOWN jurisdiction gate: no substantive rules until confirmed */}
        {base.jurisdiction.country === "UNKNOWN" && (
          <div className="rounded-2xl border border-red-300 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-extrabold text-red-800">{tt.jur_unknown_t}</div>
                <p className="mt-1 text-sm leading-relaxed text-red-800/90">{tt.jur_unknown_d}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => void actions.patchNotice({ jurisdiction: "INDIA" })}
                    className="rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                  >
                    {tt.jur_india}
                  </button>
                  <button
                    onClick={() => void actions.patchNotice({ jurisdiction: "USA" })}
                    className="rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                  >
                    {tt.jur_usa}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* PRD §2 — unsupported notice language is disclosed, never silently analysed */}
        {base.language_unsupported && (
          <div className="flex items-start gap-3.5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <Languages className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <div className="text-sm font-extrabold text-amber-800">{tt.lang_unsupported}</div>
              <p className="mt-1 text-sm leading-relaxed text-amber-800/90">
                {tt.lang_detected}: {LANGUAGE_NAMES[base.language_detected] ?? base.language_detected}
              </p>
            </div>
          </div>
        )}
        {/* PRD §11/§12 — applicability / state notes (only for a confirmed jurisdiction) */}
        {view.jurisdiction_note && base.jurisdiction.country !== "UNKNOWN" && (
          <div className="flex items-start gap-3.5 rounded-2xl border border-slate-300 bg-slate-50 p-4">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
            <p className="text-sm leading-relaxed text-slate-700">{view.jurisdiction_note}</p>
          </div>
        )}
        {base.overall_confidence < 0.75 && (
          <div className="flex items-start gap-3.5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <div className="text-sm font-extrabold text-amber-800">{tt.rs_lowconf_t}</div>
              <p className="mt-1 text-sm leading-relaxed text-amber-800/90">{tt.rs_lowconf_d}</p>
            </div>
          </div>
        )}
        {/* receipt date capture — the single most important missing fact */}
        {n.missingReceipt && !n.completed && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <div className="text-sm font-extrabold text-amber-900">⚠ {tt.nl_receipt_missing}</div>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-amber-800">{tt.ac_cannot_calc}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={flags.receiptInput}
                  onChange={(e) => flags.setReceiptInput(e.target.value)}
                  aria-label={tt.rp_receipt_ph}
                  className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
                />
                <button
                  onClick={() => flags.receiptInput && actions.saveReceipt(flags.receiptInput)}
                  disabled={!flags.receiptInput || flags.receiptBusy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
                >
                  {flags.receiptBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  {tt.rp_receipt_add}
                </button>
              </div>
            </div>
            {flags.savedFlash === "receipt_saved" && (
              <p className="mt-2.5 text-[12px] font-bold text-emerald-600">✓ {tt.rp_receipt_saved}</p>
            )}
          </div>
        )}
      </div>

      {/* 1 · ACTION CENTER */}
      <div className="mt-6">
        <ActionCenter view={view} t={tt} locale={locale} />
      </div>

      {/* 2 · DEADLINE */}
      <div className="mt-5">
        <SectionCard icon={CalendarClock} title={tt.rdl_title} sub={tt.rdl_sub}>
          <div className="grid gap-4">
            {view.deadlines.map((d, i) => {
              const u = d.status === "calculated" ? d.days_left : null;
              return (
                <div key={i} className={`rounded-xl border p-4 ${d.status === "calculated" ? "border-slate-200" : "border-amber-200 bg-amber-50/50"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide ${d.status === "calculated" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-300 bg-amber-50 text-amber-700"}`}>
                      {d.status === "calculated" ? `✓ ${tt.rdl_calculated}` : `⚠ ${tt.rdl_missing}`}
                    </span>
                    {d.status === "calculated" && <DeadlineCountdown daysLeft={u} t={dlLabels} />}
                  </div>
                  <p className="mt-2.5 text-sm font-bold text-slate-900">{d.label}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{d.description}</p>
                  {d.status === "calculated" ? (
                    <>
                      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="font-mono text-2xl font-extrabold text-slate-900">{fmtDateFor(d.deadline, locale)}</span>
                        <span className="text-xs font-semibold text-slate-500">{d.anchor_source === "user_input" ? tt.rdl_from_user : tt.rdl_from_doc}</span>
                      </div>
                      <WhyBox label={tt.ac_why}>
                        <span className="font-semibold">{tt.rdl_method}</span>
                        <br />
                        {d.anchor_field
                          ? `${fmtDateFor(d.anchor_date, locale)} (${d.anchor_source === "user_input" ? tt.tl_user : tt.tl_doc}) + ${d.period_days} ${d.business_days ? "business" : ""} days`
                          : ""}
                        {d.rule_source_id && (
                          <span className="mt-1.5 block"><CitationChip sid={d.rule_source_id} /></span>
                        )}
                      </WhyBox>
                      {/* Reminder system — anchored to THIS deterministic deadline */}
                      {i === primaryDeadlineIdx && d.deadline && (
                        <ReminderSection
                          noticeId={n.id}
                          deadlineISO={d.deadline}
                          deadlineLabel={d.label}
                          reminder={detail.reminder}
                          tt={tt}
                          locale={locale}
                          onChanged={actions.refresh}
                        />
                      )}
                      {d.days_left !== null && d.days_left > 1 && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                          <BellPlus className="h-4 w-4 text-slate-400" />
                          {[7, 3, 1].map((num) => (
                            <button
                              key={num}
                              onClick={() => actions.downloadFile(`lexlens-reminder-${num}d.ics`, buildIcs(d.deadline!, d.label, num), "text/calendar")}
                              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
                            >
                              −{num} {locale === "en" ? (num === 1 ? "day" : "days") : locale === "hi" ? "दिन" : locale === "zh" ? "天" : "jour(s)"}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="mt-3">
                      <p className="text-[13px] font-medium leading-relaxed text-amber-800">{d.missing_reason}</p>
                      {d.anchor_field && d.anchor_field !== "explicit" && d.anchor_field !== "receipt_date" && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          <input
                            type="date"
                            value={detail.userState.inputs[d.anchor_field]?.iso ?? ""}
                            onChange={(e) => actions.setInput(d.anchor_field!, "date", e.target.value)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                          />
                          <span className={`text-[11px] font-bold text-emerald-600 ${flags.savedFlash === d.anchor_field ? "opacity-100" : "opacity-0"} transition-opacity`}>{tt.ms_added}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {view.deadlines.length === 0 && (
              <p className="flex items-start gap-2 text-sm text-slate-500">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /> {tt.rdl_none}
              </p>
            )}
          </div>
        </SectionCard>
      </div>

      {/* 3 · TIMELINE */}
      <div className="mt-5">
        <SectionCard icon={GitBranch} title={tt.tl_title} sub={tt.tl_input_required + " → " + tt.ms_add}>
          <TimelineView view={view} t={tt} locale={locale} />
        </SectionCard>
      </div>

      {/* 4 · KEY FACTS */}
      <div className="mt-5">
        <SectionCard icon={ListChecksIcon} title={tt.kt_title} sub={tt.kt_sub}>
          <div className="grid gap-2.5">
            {view.facts.map((f) => (
              <div key={f.key} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{f.label}</span>
                    {f.feeds_deadline && (
                      <span className="rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-indigo-600">{tt.kt_feeds}</span>
                    )}
                  </div>
                  <StatusBadge status={f.status} t={tt} />
                </div>
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                  <span className={`text-[15px] font-extrabold ${f.value ? "text-slate-900" : "text-slate-400"}`}>
                    {f.kind === "date" && f.value ? fmtDateFor(f.value, locale) : f.value || tt.kt_missing}
                  </span>
                  {f.confidence !== null && <ConfidenceBar value={f.confidence} label={tt.kt_conf_med} />}
                </div>
                <WhyBox label={tt.kt_show_why}>
                  <span className="font-semibold">{tt.ac_source}:</span>{" "}
                  {f.source.kind === "user_input" ? tt.fs_user : f.source.ref ?? "—"}
                  {f.confidence !== null && (
                    <span className="block text-slate-500">{tt.rs_card_conf}: {Math.round(f.confidence * 100)}%</span>
                  )}
                </WhyBox>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* 5 · MISSING INFORMATION */}
      <div className="mt-5">
        <SectionCard icon={AlertTriangle} title={tt.ms_title} sub={tt.ms_sub} tone={view.missing.length ? "border-amber-200" : "border-emerald-200"}>
          {view.missing.length === 0 ? (
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="h-4.5 w-4.5" /> {tt.ms_none}
            </p>
          ) : (
            <div className="grid gap-3">
              {view.missing.map((m) => (
                <div key={m.field} className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-900">⚠ {m.label}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide ${
                      m.importance === "critical" ? "border-red-200 bg-red-50 text-red-700" : m.importance === "high" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-500"
                    }`}>
                      {m.importance === "critical" ? tt.ms_critical : m.importance === "high" ? tt.ms_high : tt.ms_medium}
                    </span>
                  </div>
                  <div className="mt-2">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{tt.ms_why}</span>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-slate-700">{m.why}</p>
                    {m.source_id && <div className="mt-1.5"><CitationChip sid={m.source_id} /></div>}
                  </div>
                  {m.field !== "receipt_date" && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {m.input === "date" ? (
                        <input
                          type="date"
                          placeholder={tt.ms_date_ph}
                          value={detail.userState.inputs[m.field]?.iso ?? ""}
                          onChange={(e) => actions.setInput(m.field, "date", e.target.value)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                        />
                      ) : (
                        <input
                          type={m.input === "number" ? "number" : "text"}
                          placeholder={m.input === "number" ? "0" : tt.ms_text_ph}
                          value={detail.userState.inputs[m.field]?.value ?? ""}
                          onChange={(e) => actions.setInput(m.field, m.input, e.target.value)}
                          className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                        />
                      )}
                      <span className={`text-[11px] font-bold text-emerald-600 transition-opacity ${flags.savedFlash === m.field ? "opacity-100" : "opacity-0"}`}>{tt.ms_added}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* 6 · EVIDENCE */}
      <div className="mt-5">
        <SectionCard icon={FileText} title={tt.ev_title} sub={tt.ev_sub}>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {view.evidence.map((e) => (
              <div key={e.key} className={`rounded-xl border p-3.5 ${e.have ? "border-emerald-200 bg-emerald-50/40" : "border-dashed border-amber-300 bg-amber-50/30"}`}>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[13px] font-bold text-slate-900">{e.have ? "✓" : "⚠"} {e.label}</span>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${e.have ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                    {e.have ? tt.ev_have : tt.ev_missing}
                  </span>
                </div>
                {e.claim_link && <p className="mt-1 text-[12px] leading-relaxed text-slate-600"><span className="font-semibold">{tt.ev_supports}</span> {e.claim_link}</p>}
              </div>
            ))}
          </div>

          {/* uploaded evidence files */}
          {detail.evidenceRows.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{tt.rp_evidence_add}</div>
              <ul className="mt-2 grid gap-1.5">
                {detail.evidenceRows.map((e) => (
                  <li key={e.id} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 text-[13px] text-slate-700">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                    <span className="min-w-0 flex-1 truncate font-semibold">{e.name}</span>
                    <span className="shrink-0 text-[11px] text-slate-400">{e.size < 1024 * 1024 ? `${Math.round(e.size / 1024)} KB` : `${(e.size / 1024 / 1024).toFixed(1)} MB`}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <label className={`no-print mt-4 inline-flex cursor-pointer items-center gap-1.5 text-[12px] font-bold text-indigo-600 hover:text-indigo-800 ${flags.evidenceBusy ? "opacity-60" : ""}`}>
            {flags.evidenceBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {tt.rp_evidence_add}
            <input type="file" multiple accept="application/pdf,image/png,image/jpeg,image/webp" className="hidden" disabled={flags.evidenceBusy} onChange={(ev) => { void actions.addEvidence(ev.target.files); ev.target.value = ""; }} />
          </label>
          {flags.savedFlash === "evidence" && <span className="ml-2 text-[11px] font-bold text-emerald-600">✓ {tt.rp_evidence_saved}</span>}
        </SectionCard>
      </div>

      {/* 7 · LEGAL BASIS */}
      <div className="mt-5">
        <SectionCard icon={BookOpenCheck} title={tt.lb_title} sub={tt.lb_sub}>
          {base.citations.length === 0 ? (
            <p className="flex items-start gap-2 text-sm text-slate-500">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /> {tt.lb_none}
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
                          <span className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-700">{tt.lb_verified}</span>
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

      {/* 8 · WHAT HAPPENS IF I DO NOTHING */}
      <div className="mt-5">
        <SectionCard icon={Route} title={tt.wn_title} sub={tt.wn_sub}>
          <ol className="relative space-y-4">
            {view.consequences.map((c, i) => (
              <li key={c.key} className="relative flex gap-3.5 pb-1 last:pb-0">
                {i < view.consequences.length - 1 && <span className="absolute left-[11px] top-6 h-[calc(100%-1.5rem)] w-0.5 bg-slate-200" aria-hidden />}
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white ${c.tone === "danger" ? "bg-red-500" : c.tone === "warning" ? "bg-amber-500" : "bg-slate-400"}`}>
                  {i + 1}
                </span>
                <p className="text-[13.5px] leading-relaxed text-slate-700">{c.text}</p>
              </li>
            ))}
          </ol>
        </SectionCard>
      </div>

      {/* 9 · YOUR POSITION */}
      <div className="mt-5">
        <SectionCard icon={UserRound} title={tt.ps_title} sub={tt.ps_sub}>
          <div className="grid gap-2 sm:grid-cols-2">
            {POSITIONS.map((p) => {
              const active = detail.userState.position === p;
              return (
                <button
                  key={p}
                  onClick={() => actions.setPosition(p)}
                  className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left text-sm font-semibold transition-colors ${
                    active ? "border-indigo-400 bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200" : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/40"
                  }`}
                  aria-pressed={active}
                >
                  <span className={`flex h-4.5 w-4.5 items-center justify-center rounded-full border-2 ${active ? "border-indigo-600" : "border-slate-300"}`}>
                    {active && <span className="h-2 w-2 rounded-full bg-indigo-600" />}
                  </span>
                  {tt[`ps_${p}`]}
                </button>
              );
            })}
          </div>
          {detail.userState.position && <p className="mt-3 text-[12px] font-bold text-emerald-600">✓ {tt.ps_saved}</p>}
        </SectionCard>
      </div>

      {/* 10 · RESPONSE DRAFT */}
      <div className="mt-5">
        <SectionCard icon={MessageSquareText} title={tt.rd_title} sub={tt.rd_sub}>
          {!detail.userState.draft ? (
            <button
              onClick={() => void actions.generateDraft()}
              disabled={flags.draftBusy}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-60"
            >
              {flags.draftBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquareText className="h-4 w-4" />}
              {flags.draftBusy ? tt.rd_generating : tt.rd_generate}
            </button>
          ) : (
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                  {detail.userState.draft.source === "ai" ? tt.rd_ai : tt.rd_template}
                </span>
                <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">⚠ {tt.rd_tag}</span>
                <button onClick={() => void actions.generateDraft()} disabled={flags.draftBusy} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-60">
                  {flags.draftBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                  {tt.rd_regenerate}
                </button>
                <button
                  onClick={() => void navigator.clipboard.writeText(detail.userState.draft!.text).catch(() => {})}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
                >
                  <Copy className="h-3.5 w-3.5" /> {tt.rd_copy}
                </button>
                <button onClick={() => actions.downloadFile("lexlens-response-draft.txt", detail.userState.draft!.text)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-700">
                  <FileText className="h-3.5 w-3.5" /> {tt.rd_download}
                </button>
              </div>
              <DraftText text={detail.userState.draft.text} />
            </div>
          )}
          {flags.draftErr && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">{flags.draftErr}</p>}
        </SectionCard>
      </div>

      {/* 11 · LAWYER BRIEF */}
      <div className="mt-5">
        <SectionCard icon={Scale} title={tt.br_title} sub={tt.br_sub}>
          {!flags.briefOpen ? (
            <button
              onClick={actions.openBrief}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-800"
            >
              <Scale className="h-4 w-4" /> {tt.br_prepare}
            </button>
          ) : (
            <div>
              <div className="no-print mb-3 flex justify-end">
                <button onClick={() => flags.setBriefOpen(false)} className="text-[11px] font-bold text-slate-500 hover:text-slate-800">{tt.br_hide}</button>
              </div>
              <BriefView brief={brief} t={tt} locale={locale} onPrint={actions.printBrief} onDownload={() => actions.downloadFile("lexlens-case-brief.txt", briefToText(brief, locale))} />
            </div>
          )}
        </SectionCard>
      </div>

      {/* 12 · PLAIN-LANGUAGE EXPLANATION */}
      <div className="mt-5">
        <PlainLanguageCard base={base} locale={locale} tt={tt} />
      </div>

      {/* report details — no technical names, just outcomes */}
      <div className="mt-5">
        <SectionCard icon={FileText} title={tt.rs_details_t}>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            {[
              [tt.rp_status, `✓ ${tt.rp_engine_ok}`],
              [tt.rp_sources, `✓ ${tt.rp_sources_ok}`],
              [tt.rs_card_lang, LANGUAGE_NAMES[base.language_detected] ?? base.language_detected],
              [tt.rs_card_from, `${base.sender.name} (${base.sender.type})`],
              [tt.ac_receipt, n.receiptDate ? fmtDateFor(n.receiptDate, locale) : `⚠ ${tt.ac_not_provided}`],
              [tt.nl_deadline, n.deadlineDate ? fmtDateFor(n.deadlineDate, locale) : tt.ac_cannot_calc],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{k}</dt>
                <dd className="mt-0.5 truncate font-medium text-slate-800" title={String(v)}>{v}</dd>
              </div>
            ))}
          </dl>

          {detail.noticeText && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <button onClick={() => flags.setShowOriginal(!flags.showOriginal)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700 hover:text-indigo-800">
                <ChevronDown className={`h-4 w-4 transition-transform ${flags.showOriginal ? "rotate-180" : ""}`} />
                {tt.rs_original}
              </button>
              {flags.showOriginal && (
                <div className="mt-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{tt.rs_original_t}</div>
                  <pre className="font-legal custom-scroll max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-[13.5px] leading-relaxed text-slate-800">
                    {detail.noticeText}
                  </pre>
                </div>
              )}
            </div>
          )}
        </SectionCard>
      </div>

      {/* disclaimer */}
      <div className="print-card mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-5 text-center">
        <p className="mx-auto max-w-2xl text-xs leading-relaxed text-slate-500">{tt.rs_disclaimer}</p>
      </div>
    </>
  );
}

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

function DraftText({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]\n]{8,90}\])/g);
  return (
    <div className="custom-scroll max-h-[480px] overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50/70 p-4 font-legal text-[13.5px] leading-relaxed text-slate-800">
      {parts.map((p, i) =>
        /^\[[^\]\n]{8,90}\]$/.test(p) ? (
          <mark key={i} className="rounded bg-amber-100 px-1 font-sans text-[12px] font-bold text-amber-900 ring-1 ring-amber-200">{p}</mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </div>
  );
}

function PlainLanguageCard({ base, locale, tt }: { base: CaseBase; locale: Locale; tt: TT }) {
  const [viewL, setViewL] = useState<Locale>(locale);
  const block: LocalizedBlock = base.localized[viewL] ?? base.localized.en;
  const langCls = viewL === "hi" ? "lang-hi" : "";
  return (
    <SectionCard icon={ClipboardList} title={tt.rs_summary_t} sub={tt.rs_summary_hint}>
      <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Explanation language">
        {OUTPUT_LOCALES.map((l) => (
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

export default function NoticeReportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      }
    >
      <ReportInner />
    </Suspense>
  );
}
