"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, FileText, Loader2, RotateCcw, CheckCircle2 } from "lucide-react";
import { Pipeline, PIPELINE_STAGE_COUNT } from "@/components/lexlens/pipeline";
import { useLang } from "@/components/lexlens/language-provider";
import { loadDraft, loadResult, saveResult, upsertCaseFromResult, type RunDraft, type RunResult } from "@/lib/lexlens/run-store";
import type { AnalyzeResponse } from "@/lib/lexlens/types";

const MAX_HOLD_STAGE = PIPELINE_STAGE_COUNT - 2; // hold "Checking missing information" until the response lands
const STAGE_TICK_MS = 1300;

function ProcessingInner() {
  const { t } = useLang();
  const router = useRouter();
  const params = useSearchParams();
  const runId = params.get("id");

  const [draft, setDraft] = useState<RunDraft | null>(null);
  const [phase, setPhase] = useState<"loading" | "running" | "error">("loading");
  const [stage, setStage] = useState(0);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const startedRef = useRef(false);
  const stageTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Draft bootstrap
  useEffect(() => {
    const d = loadDraft();
    if (!d) {
      router.replace("/analyze");
      return;
    }
    // Refresh after a completed run → jump straight to the existing report.
    const existing = loadResult();
    if (existing && existing.draft.id === d.id && runId && existing.draft.id === runId) {
      router.replace(`/result?id=${d.id}`);
      return;
    }
    setDraft(d);
  }, [router, runId]);

  const runAnalysis = useCallback(
    async (d: RunDraft) => {
      setPhase("running");
      setDone(false);
      setStage(0);
      startedRef.current = true;

      // Animated stage progression (held at MAX_HOLD_STAGE until the API answers)
      stageTimerRef.current = setInterval(() => {
        setStage((s) => (s < MAX_HOLD_STAGE ? s + 1 : s));
      }, STAGE_TICK_MS);

      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: d.text }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as AnalyzeResponse;
        if (!data.base) throw new Error(data.error ?? "empty analysis");

        if (stageTimerRef.current) clearInterval(stageTimerRef.current);
        setStage(PIPELINE_STAGE_COUNT - 1);
        setDone(true);

        const result: RunResult = { ...data, draft: d, finishedAt: Date.now() };
        saveResult(result);
        upsertCaseFromResult(result);
        setTimeout(() => router.replace(`/result?id=${d.id}`), 700);
      } catch (err) {
        if (stageTimerRef.current) clearInterval(stageTimerRef.current);
        setPhase("error");
        setErrorMsg(err instanceof Error ? err.message : String(err));
      }
    },
    [router]
  );

  // Kick off once per draft
  useEffect(() => {
    if (draft && !startedRef.current && phase === "loading") {
      void runAnalysis(draft);
    }
    return () => {
      if (stageTimerRef.current) clearInterval(stageTimerRef.current);
    };
  }, [draft, phase, runAnalysis]);

  const pipelineStrings = {
    titleRunning: t.pl_title_running,
    titleDone: t.pl_title_done,
    labels: [t.pl_stage_1, t.pl_stage_2, t.pl_stage_3, t.pl_stage_4, t.pl_stage_5, t.pl_stage_6],
    running: [t.pl_run_1, t.pl_run_2, t.pl_run_3, t.pl_run_4, t.pl_run_5, t.pl_run_6],
  };

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-gradient-to-b from-indigo-50/80 to-transparent" />

      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        {phase === "error" ? (
          /* ── Error card ── */
          <div className="print-card mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500 ring-1 ring-red-100">
              <AlertTriangle className="h-7 w-7" />
            </span>
            <h1 className="mt-4 text-xl font-bold text-slate-900">{t.pr_err_title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{t.pr_err_sub}</p>
            {errorMsg && (
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-500">{errorMsg}</p>
            )}
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
              <button
                onClick={() => draft && void runAnalysis(draft)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-700"
              >
                <RotateCcw className="h-4 w-4" /> {t.pr_retry}
              </button>
              <Link
                href="/analyze"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-700"
              >
                <ArrowLeft className="h-4 w-4" /> {t.pr_change_input}
              </Link>
            </div>
          </div>
        ) : (
          /* ── Running card ── */
          <>
            <div className="text-center">
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{t.pr_title}</h1>
              <p className="mx-auto mt-3 max-w-xl text-slate-600">{t.pr_sub}</p>
            </div>

            {draft && (
              <div className="mx-auto mt-6 flex max-w-xl flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 font-medium">
                  <FileText className="h-3.5 w-3.5 text-indigo-500" />
                  {draft.label}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-mono">
                  {draft.text.length.toLocaleString()} {t.an_chars}
                </span>
              </div>
            )}

            <div className="mt-8">
              <Pipeline currentStage={stage} done={done} base={null} s={pipelineStrings} />
            </div>

            <div className="mt-6 text-center" aria-live="polite">
              {done ? (
                <p className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> {t.pr_ok}
                </p>
              ) : (
                <p className="inline-flex items-center gap-2 text-sm font-medium text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="font-mono">{Math.min(stage + 1, 6)}/6</span>
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ProcessingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      }
    >
      <ProcessingInner />
    </Suspense>
  );
}
