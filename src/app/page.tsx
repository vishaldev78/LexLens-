"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpenCheck,
  ChevronRight,
  FileUp,
  Globe2,
  Languages,
  Loader2,
  Lock,
  Scale,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Timer,
  Wand2,
  X,
} from "lucide-react";
import { Pipeline } from "@/components/lexlens/pipeline";
import { ResultDashboard } from "@/components/lexlens/result";
import { SAMPLES, type SampleNotice } from "@/lib/lexlens/samples";
import type { AnalyzeResponse } from "@/lib/lexlens/types";
import { useToast } from "@/hooks/use-toast";

type Phase = "idle" | "analyzing" | "done" | "error";

const TICK_MS = 850;

export default function LexLensPage() {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState("");
  const [activeSample, setActiveSample] = useState<string | null>(null);
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const analyzeRef = useRef<HTMLDivElement | null>(null);

  const stopTimer = () => {
    if (stageTimer.current) {
      clearInterval(stageTimer.current);
      stageTimer.current = null;
    }
  };

  useEffect(() => stopTimer, []);

  const analyze = useCallback(
    async (rawText: string) => {
      const notice = rawText.trim();
      if (notice.length < 40) {
        toast({
          title: "Notice too short",
          description: "Paste a few more sentences so the pipeline has something to read.",
        });
        return;
      }
      stopTimer();
      setPhase("analyzing");
      setError("");
      setResult(null);
      setStage(0);
      analyzeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      stageTimer.current = setInterval(() => {
        setStage((s) => Math.min(s + 1, 7)); // hold at "Analysis + safety pass" until API returns
      }, TICK_MS);

      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: notice }),
        });
        const data = (await res.json()) as AnalyzeResponse & { error?: string };
        stopTimer();
        if (!res.ok || !data.analysis) {
          setPhase("error");
          setError(data.error ?? "Something went wrong while analyzing this notice.");
          return;
        }
        setStage(9);
        setResult(data);
        setPhase("done");
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
      } catch {
        stopTimer();
        setPhase("error");
        setError("Network error — could not reach the analysis engine. Please retry.");
      }
    },
    [toast]
  );

  const loadSample = (s: SampleNotice) => {
    setText(s.text);
    setActiveSample(s.id);
    toast({
      title: `${s.title} loaded`,
      description: `${s.jurisdiction_label} · running the full pipeline now.`,
    });
    void analyze(s.text);
  };

  const onFile = (file: File | null) => {
    if (!file) return;
    if (/\.(txt|md|text)$/i.test(file.name)) {
      const reader = new FileReader();
      reader.onload = () => {
        setText(String(reader.result ?? ""));
        setActiveSample(null);
        toast({ title: "File loaded", description: `${file.name} — review the text, then hit Analyze.` });
      };
      reader.readAsText(file);
    } else {
      toast({
        title: "OCR ships in P1",
        description: "Photo & PDF OCR lands with the GA build — for the demo, paste the notice text.",
      });
    }
  };

  const reset = () => {
    stopTimer();
    setPhase("idle");
    setResult(null);
    setText("");
    setActiveSample(null);
    setStage(0);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0B1220] text-slate-200 antialiased">
      {/* ambient glows */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[480px] w-[720px] rounded-full bg-indigo-600/20 blur-[140px]" />
        <div className="absolute top-[55%] -left-40 h-[380px] w-[380px] rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute bottom-0 -right-32 h-[320px] w-[420px] rounded-full bg-sky-600/10 blur-[120px]" />
      </div>

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0B1220]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-950/50">
              <Scale className="h-5 w-5 text-white" strokeWidth={2.2} />
            </span>
            <div className="leading-tight">
              <p className="text-[15px] font-bold tracking-tight text-white">LexLens</p>
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
                Legal Notice Intelligence
              </p>
            </div>
            <span className="ml-2 hidden rounded-full border border-indigo-400/30 bg-indigo-500/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-indigo-300 sm:inline">
              Hackathon MVP
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <Lock className="h-3 w-3" />
            <span className="hidden md:inline">Legal information, not advice</span>
            <span className="inline-flex md:hidden">Not advice</span>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1">
        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-14 pb-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="mx-auto max-w-3xl text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-[1.1]">
              Any legal notice.{" "}
              <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-sky-300 bg-clip-text text-transparent">
                Any language.
              </span>{" "}
              Understood in 60 seconds.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-slate-400">
              LexLens turns an intimidating legal notice into a plain-language action plan — who sent
              it, what they demand, every deadline, and the rights you didn&apos;t know you had. Built for
              the billions who face the legal system without a lawyer.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {[
                { icon: Languages, label: "EN · हिं · ES live" },
                { icon: Globe2, label: "US · IN · ES corpus" },
                { icon: Timer, label: "<60s p95 target" },
                { icon: ShieldCheck, label: "Citation-verified" },
              ].map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11.5px] font-medium text-slate-300"
                >
                  <Icon className="h-3.5 w-3.5 text-indigo-300" />
                  {label}
                </span>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ── Step 1: input ──────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-10">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/20 font-mono text-[12px] font-bold text-indigo-300 ring-1 ring-indigo-400/40">
              1
            </span>
            <h2 className="text-[16px] font-semibold text-slate-100">Add your notice</h2>
            <span className="text-[12px] text-slate-500">— pick a demo notice or paste your own</span>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* samples */}
            <div className="lg:col-span-5 space-y-3">
              {SAMPLES.map((s, i) => (
                <motion.button
                  key={s.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.08 }}
                  onClick={() => loadSample(s)}
                  disabled={phase === "analyzing"}
                  className={`group w-full rounded-2xl border p-4 text-left transition-all ${
                    activeSample === s.id
                      ? "border-indigo-400/50 bg-indigo-500/10 ring-1 ring-indigo-400/40"
                      : "border-white/10 bg-white/[0.04] hover:border-indigo-400/40 hover:bg-white/[0.07]"
                  } disabled:opacity-50`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black/40 ring-1 ring-white/10">
                        <ScrollText className="h-4.5 w-4.5 text-indigo-300" />
                      </span>
                      <div>
                        <p className="text-[14px] font-semibold text-slate-100">{s.title}</p>
                        <p className="mt-0.5 text-[11.5px] text-slate-500">{s.jurisdiction_label}</p>
                        <p className="mt-1.5 inline-flex rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300/90 ring-1 ring-emerald-500/25">
                          {s.stat_hint}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-indigo-300" />
                  </div>
                </motion.button>
              ))}

              <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-4 text-center">
                <label className="inline-flex cursor-pointer items-center gap-2 text-[12.5px] font-medium text-slate-400 transition hover:text-slate-200">
                  <FileUp className="h-4 w-4 text-indigo-300" />
                  Upload a .txt file — photo/PDF OCR ships in P1
                  <input
                    type="file"
                    accept=".txt,.md,.text"
                    className="sr-only"
                    onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </div>

            {/* paste box */}
            <div className="lg:col-span-7">
              <div className="flex h-full min-h-[320px] flex-col rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-5">
                <div className="mb-3 flex items-center justify-between">
                  <label htmlFor="notice" className="text-[13px] font-semibold text-slate-300">
                    Paste notice text
                  </label>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] text-slate-500">
                      {text.length.toLocaleString()} chars
                    </span>
                    {text && (
                      <button
                        onClick={() => {
                          setText("");
                          setActiveSample(null);
                        }}
                        className="inline-flex items-center gap-1 text-[11.5px] text-slate-500 transition hover:text-slate-300"
                      >
                        <X className="h-3 w-3" /> clear
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  id="notice"
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setActiveSample(null);
                  }}
                  placeholder={"Paste the full notice here — a debt letter, rent demand, cheque bounce notice…\n\nTip: click any demo notice on the left for a one-click end-to-end run."}
                  className="flex-1 w-full resize-none rounded-xl border border-white/10 bg-black/30 p-4 font-serif text-[13.5px] leading-relaxed text-slate-200 placeholder:text-slate-600 placeholder:font-sans placeholder:text-[12.5px] outline-none ring-indigo-500/40 focus:ring-2 transition"
                  rows={10}
                />
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="max-w-[60%] text-[11px] leading-snug text-slate-600">
                    Demo data never leaves this sandbox. Production runs zero-retention LLM APIs under
                    GDPR / DPDP.
                  </p>
                  <button
                    onClick={() => void analyze(text)}
                    disabled={phase === "analyzing" || text.trim().length < 40}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-3 text-[14px] font-semibold text-white shadow-lg shadow-indigo-950/40 transition hover:from-indigo-400 hover:to-violet-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:from-indigo-500 disabled:hover:to-violet-500"
                  >
                    {phase === "analyzing" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Analyzing…
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4" /> Analyze notice
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Pipeline (analyzing / done) ────────────────────────── */}
        <div ref={analyzeRef} className="scroll-mt-24" />
        {(phase === "analyzing" || phase === "done") && (
          <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-10">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/20 font-mono text-[12px] font-bold text-indigo-300 ring-1 ring-indigo-400/40">
                2
              </span>
              <h2 className="text-[16px] font-semibold text-slate-100">10-stage analysis pipeline</h2>
            </div>
            <Pipeline currentStage={phase === "done" ? 9 : stage} done={phase === "done"} analysis={result?.analysis ?? null} />
          </section>
        )}

        {/* ── Error ──────────────────────────────────────────────── */}
        {phase === "error" && (
          <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-10">
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
              <p className="text-[14px] font-semibold text-red-200">Analysis failed</p>
              <p className="mt-1 text-[13px] text-red-200/80">{error}</p>
              <button
                onClick={() => void analyze(text)}
                className="mt-3 rounded-lg bg-red-500/90 px-4 py-2 text-[13px] font-semibold text-white hover:bg-red-500"
              >
                Retry
              </button>
            </div>
          </section>
        )}

        {/* ── Step 3: results ────────────────────────────────────── */}
        <div ref={resultRef} className="scroll-mt-24" />
        {phase === "done" && result && (
          <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-10">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/20 font-mono text-[12px] font-bold text-indigo-300 ring-1 ring-indigo-400/40">
                3
              </span>
              <h2 className="text-[16px] font-semibold text-slate-100">Your plain-language breakdown</h2>
            </div>
            <ResultDashboard result={result} onReset={reset} />
          </section>
        )}

        {/* ── Under the hood (judges' section) ───────────────────── */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-16">
          <div className="mb-6 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-300" />
            <h2 className="text-[16px] font-semibold text-slate-100">Production thinking, already wired in</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: BookOpenCheck,
                title: "RAG-lite, hallucination-capped",
                body: "The model may only cite a versioned statute corpus. Zero corpus match → confidence auto-caps at 72% and the consult-a-lawyer banner fires.",
              },
              {
                icon: ShieldCheck,
                title: "Safety pipeline",
                body: "Notices are wrapped as untrusted data against prompt injection. Red severity strips 'ignore' language and injects a mandatory lawyer step in all 3 languages.",
              },
              {
                icon: Globe2,
                title: "i18n by transcreation",
                body: "Output language is decoupled from notice language. Legal terms are transcreated — चेक अनादरण, enervación — never machine-literal.",
              },
              {
                icon: ArrowRight,
                title: "Scale path",
                body: "This demo API mirrors the prod contract. GA adds FastAPI + Celery + pgvector hybrid retrieval, WhatsApp intake, voice and B2B endpoints.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:bg-white/[0.06]"
              >
                <Icon className="h-5 w-5 text-indigo-300" />
                <p className="mt-3 text-[13.5px] font-semibold text-slate-100">{title}</p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="relative z-10 mt-auto border-t border-white/[0.06] bg-black/30">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2 text-[12px] text-slate-500">
            <Scale className="h-3.5 w-3.5 text-indigo-400" />
            <span className="font-semibold text-slate-400">LexLens</span> — Any legal notice. Any
            language. Understood in 60 seconds.
          </div>
          <p className="text-[11px] text-slate-600">
            Demo build · All notices and senders are fictional · Legal information, not advice
          </p>
        </div>
      </footer>
    </div>
  );
}
