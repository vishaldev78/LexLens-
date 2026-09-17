"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BookOpenCheck,
  ChevronDown,
  ChevronRight,
  FileUp,
  Globe2,
  Languages,
  Loader2,
  Lock,
  Menu,
  Scale,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Timer,
  Wand2,
  X,
  XCircle,
} from "lucide-react";
import { Pipeline } from "@/components/lexlens/pipeline";
import { ResultDashboard } from "@/components/lexlens/result";
import { SAMPLES, type SampleNotice } from "@/lib/lexlens/samples";
import type { AnalyzeResponse } from "@/lib/lexlens/types";
import { useToast } from "@/hooks/use-toast";

type Phase = "idle" | "analyzing" | "done" | "error";

const TICK_MS = 850;
const FETCH_TIMEOUT_MS = 110_000;

const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#demo", label: "Try the demo" },
  { href: "#pipeline", label: "Pipeline" },
  { href: "#trust", label: "Trust & safety" },
];

export default function LexLensPage() {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState("");
  const [activeSample, setActiveSample] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const demoRef = useRef<HTMLDivElement | null>(null);

  const stopTimer = () => {
    if (stageTimer.current) {
      clearInterval(stageTimer.current);
      stageTimer.current = null;
    }
  };

  useEffect(() => stopTimer, []);

  /** Fetch with timeout + one automatic retry on network failure. */
  const fetchAnalysis = useCallback(
    async (notice: string): Promise<AnalyzeResponse & { error?: string }> => {
      let lastErr = "";
      for (let attempt = 1; attempt <= 2; attempt++) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
        try {
          const res = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: notice }),
            signal: ctrl.signal,
          });
          clearTimeout(t);
          const data = (await res.json()) as AnalyzeResponse & { error?: string };
          if (!res.ok || !data.analysis) throw new Error(data.error ?? "Engine returned an error.");
          return data;
        } catch (err) {
          clearTimeout(t);
          lastErr =
            err instanceof DOMException && err.name === "AbortError"
              ? "The analysis took too long and timed out. Please retry."
              : "Could not reach the analysis engine.";
          if (attempt === 1) await new Promise((r) => setTimeout(r, 1200)); // brief pause, then retry
        }
      }
      throw new Error(lastErr);
    },
    []
  );

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
      setTimeout(() => demoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
      stageTimer.current = setInterval(() => {
        setStage((s) => Math.min(s + 1, 7)); // hold at "Analysis + safety pass" until the API returns
      }, TICK_MS);

      try {
        const data = await fetchAnalysis(notice);
        stopTimer();
        setStage(9);
        setResult(data);
        setPhase("done");
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
      } catch (err) {
        stopTimer();
        setPhase("error");
        setError(err instanceof Error ? err.message : "Something went wrong. Please retry.");
      }
    },
    [fetchAnalysis, toast]
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
    <div className="flex min-h-screen flex-col bg-white text-slate-900 antialiased">
      {/* ── Navbar ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="#top" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-md shadow-indigo-200">
              <Scale className="h-5 w-5 text-white" strokeWidth={2.2} />
            </span>
            <span className="leading-tight">
              <span className="block text-[16px] font-bold tracking-tight text-slate-900">LexLens</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Legal Notice Intelligence
              </span>
            </span>
          </a>

          {/* desktop links */}
          <div className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-lg px-3.5 py-2 text-[13.5px] font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-500">
              <Lock className="h-3 w-3" /> Legal information, not advice
            </span>
            <a
              href="#demo"
              className="rounded-lg bg-indigo-600 px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-700"
            >
              Analyze a notice
            </a>
          </div>

          {/* mobile toggle */}
          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>

        {/* mobile menu */}
        {menuOpen && (
          <div className="border-t border-slate-200 bg-white px-4 pb-4 pt-2 md:hidden">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-[14px] font-medium text-slate-700 hover:bg-slate-100"
              >
                {l.label}
              </a>
            ))}
            <a
              href="#demo"
              onClick={() => setMenuOpen(false)}
              className="mt-2 block rounded-lg bg-indigo-600 px-3 py-2.5 text-center text-[14px] font-semibold text-white"
            >
              Analyze a notice
            </a>
          </div>
        )}
      </header>

      <main id="top" className="flex-1">
        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-b from-indigo-50/70 via-white to-white">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 left-1/2 h-72 w-[640px] -translate-x-1/2 rounded-full bg-indigo-100/70 blur-3xl" />
          </div>
          <div className="relative mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3.5 py-1.5 text-[12px] font-semibold text-indigo-700">
                <Sparkles className="h-3.5 w-3.5" />
                Hackathon MVP · 10-stage AI pipeline · v0.9
              </span>
              <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold leading-[1.12] tracking-tight text-slate-900 sm:text-5xl">
                Any legal notice.{" "}
                <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                  Any language.
                </span>{" "}
                Understood in 60 seconds.
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-[16px] leading-relaxed text-slate-600">
                LexLens turns an intimidating legal notice into a plain-language action plan — who
                sent it, what they demand, every deadline, and the rights you didn&apos;t know you
                had. Built for the billions who face the legal system without a lawyer.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <a
                  href="#demo"
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-[14.5px] font-semibold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-700"
                >
                  <Wand2 className="h-4 w-4" /> Analyze a notice — free demo
                </a>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-[14.5px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  See how it works <ChevronDown className="h-4 w-4" />
                </a>
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                {[
                  { icon: Languages, label: "EN · हिं · ES live output" },
                  { icon: Globe2, label: "US · India · Spain statute corpus" },
                  { icon: Timer, label: "<60s p95 target" },
                  { icon: ShieldCheck, label: "Citation-verified answers" },
                ].map(({ icon: Icon, label }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11.5px] font-medium text-slate-600 shadow-sm"
                  >
                    <Icon className="h-3.5 w-3.5 text-indigo-500" />
                    {label}
                  </span>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── How it works ───────────────────────────────────────── */}
        <section id="how-it-works" className="scroll-mt-20 border-b border-slate-100 bg-slate-50/60">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">How it works</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
                From an unreadable legal document to a step-by-step plan — in three moves.
              </p>
            </div>
            <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
              {[
                {
                  step: "01",
                  title: "Add your notice",
                  body: "Paste the text or pick one of the three demo notices — a US debt-collection letter, an Indian cheque-bounce notice, or a Spanish eviction demand.",
                },
                {
                  step: "02",
                  title: "The 10-stage pipeline runs",
                  body: "Language detection, jurisdiction matching, notice classification, entity extraction and statute-corpus retrieval — with a safety pass on every result.",
                },
                {
                  step: "03",
                  title: "Get your action plan",
                  body: "A plain-language summary in English, Hindi or Spanish: who sent it, what they demand, every deadline with a live countdown, and the rights you can use.",
                },
              ].map((s, i) => (
                <motion.div
                  key={s.step}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 font-mono text-[13px] font-bold text-indigo-600 ring-1 ring-indigo-100">
                    {s.step}
                  </span>
                  <h3 className="mt-4 text-[16px] font-semibold text-slate-900">{s.title}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-slate-600">{s.body}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Demo / input ───────────────────────────────────────── */}
        <section id="demo" className="scroll-mt-20">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8" ref={demoRef}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">Try the live demo</h2>
                <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-slate-600">
                  Pick a demo notice for a one-click end-to-end run, or paste your own notice text.
                  Everything runs in this session — nothing is stored.
                </p>
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11.5px] font-semibold text-emerald-700">
                ● Engine online
              </span>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-12">
              {/* samples */}
              <div className="space-y-3 lg:col-span-5">
                {SAMPLES.map((s, i) => (
                  <motion.button
                    key={s.id}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.05 + i * 0.08 }}
                    onClick={() => loadSample(s)}
                    disabled={phase === "analyzing"}
                    className={`group w-full rounded-2xl border p-4 text-left shadow-sm transition-all ${
                      activeSample === s.id
                        ? "border-indigo-300 bg-indigo-50/70 ring-1 ring-indigo-200"
                        : "border-slate-200 bg-white hover:border-indigo-200 hover:shadow-md"
                    } disabled:opacity-50`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
                          <ScrollText className="h-5 w-5 text-indigo-500" />
                        </span>
                        <div>
                          <p className="text-[14px] font-semibold text-slate-900">{s.title}</p>
                          <p className="mt-0.5 text-[11.5px] text-slate-500">{s.jurisdiction_label}</p>
                          <p className="mt-1.5 inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-emerald-700">
                            {s.stat_hint}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
                    </div>
                  </motion.button>
                ))}

                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-[12.5px] font-medium text-slate-500 transition hover:text-slate-800">
                    <FileUp className="h-4 w-4 text-indigo-500" />
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
                <div className="flex h-full min-h-[340px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <label htmlFor="notice" className="text-[13px] font-semibold text-slate-800">
                      Paste notice text
                    </label>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[11px] text-slate-400">
                        {text.length.toLocaleString()} chars
                      </span>
                      {text && (
                        <button
                          onClick={() => {
                            setText("");
                            setActiveSample(null);
                          }}
                          className="inline-flex items-center gap-1 text-[11.5px] text-slate-400 transition hover:text-slate-700"
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
                    className="min-h-0 flex-1 w-full resize-none rounded-xl border border-slate-300 bg-slate-50/60 p-4 font-serif text-[13.5px] leading-relaxed text-slate-800 outline-none ring-indigo-500/40 transition placeholder:font-sans placeholder:text-[12.5px] placeholder:text-slate-400 focus:bg-white focus:ring-2"
                    rows={10}
                  />
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="max-w-[58%] text-[11px] leading-snug text-slate-400">
                      Demo notices are fictional. Production runs zero-retention LLM APIs under GDPR /
                      DPDP.
                    </p>
                    <button
                      onClick={() => void analyze(text)}
                      disabled={phase === "analyzing" || text.trim().length < 40}
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-[14px] font-semibold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
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
          </div>
        </section>

        {/* ── Pipeline (analyzing / done) ────────────────────────── */}
        {(phase === "analyzing" || phase === "done") && (
          <section id="pipeline" className="scroll-mt-20 border-t border-slate-100 bg-slate-50/60">
            <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
              <div className="mb-5 flex items-center gap-2.5">
                <BookOpenCheck className="h-5 w-5 text-indigo-500" />
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  Inside the analysis pipeline
                </h2>
              </div>
              <Pipeline
                currentStage={phase === "done" ? 9 : stage}
                done={phase === "done"}
                analysis={result?.analysis ?? null}
              />
            </div>
          </section>
        )}

        {/* ── Error ──────────────────────────────────────────────── */}
        {phase === "error" && (
          <section className="border-t border-slate-100">
            <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                <div className="flex items-start gap-3">
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                  <div className="flex-1">
                    <p className="text-[14px] font-semibold text-red-800">Analysis failed</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-red-700">{error}</p>
                    <button
                      onClick={() => void analyze(text)}
                      className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-red-700"
                    >
                      Retry analysis
                    </button>
                  </div>
                  <AlertTriangle className="h-5 w-5 shrink-0 text-red-300" />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Results ────────────────────────────────────────────── */}
        <div ref={resultRef} className="scroll-mt-20" />
        {phase === "done" && result && (
          <section className="border-t border-slate-100">
            <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
              <div className="mb-5 flex items-center gap-2.5">
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  Your plain-language breakdown
                </h2>
              </div>
              <ResultDashboard result={result} onReset={reset} />
            </div>
          </section>
        )}

        {/* ── Trust & safety ─────────────────────────────────────── */}
        <section id="trust" className="scroll-mt-20 border-t border-slate-100 bg-slate-50/60">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">Production thinking, already wired in</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
                This demo mirrors the production contract from the LexLens TRD — same schemas, same
                guardrails, same degradation strategy.
              </p>
            </div>
            <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
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
                  icon: Timer,
                  title: "Never-fail demo engine",
                  body: "If the LLM backend is unreachable (e.g. running locally in VS Code), a rule-based offline engine takes over in milliseconds — the demo always completes.",
                },
              ].map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 ring-1 ring-indigo-100">
                    <Icon className="h-5 w-5 text-indigo-600" />
                  </span>
                  <p className="mt-3.5 text-[14px] font-semibold text-slate-900">{title}</p>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-600">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600">
                  <Scale className="h-4 w-4 text-white" strokeWidth={2.2} />
                </span>
                <span className="text-[15px] font-bold tracking-tight text-slate-900">LexLens</span>
              </div>
              <p className="mt-3 max-w-sm text-[12.5px] leading-relaxed text-slate-500">
                Any legal notice. Any language. Understood in 60 seconds. A legal-information
                platform — not a law firm, and never legal advice.
              </p>
            </div>
            {[
              { h: "Product", links: ["How it works", "Try the demo", "Pipeline", "Trust & safety"], hrefs: ["#how-it-works", "#demo", "#pipeline", "#trust"] },
              { h: "Roadmap", links: ["P1 — Voice mode", "P1 — WhatsApp bot", "P1 — Lawyer marketplace", "P2 — B2B API"], hrefs: ["#trust", "#trust", "#trust", "#trust"] },
            ].map((col) => (
              <div key={col.h}>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-900">{col.h}</p>
                <ul className="mt-3 space-y-2">
                  {col.links.map((l, i) => (
                    <li key={l}>
                      <a href={col.hrefs[i]} className="text-[12.5px] text-slate-500 transition hover:text-indigo-600">
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-6 sm:flex-row">
            <p className="text-[11.5px] text-slate-400">
              © 2026 LexLens · Demo build — all notices and senders are fictional
            </p>
            <p className="text-[11.5px] font-medium text-slate-500">Legal information, not advice</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
