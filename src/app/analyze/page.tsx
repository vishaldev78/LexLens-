"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardPaste,
  UploadCloud,
  FlaskConical,
  FileText,
  X,
  ArrowRight,
  Loader2,
  ShieldCheck,
  Languages as LanguagesIcon,
  MapPin,
  Landmark,
  Scale,
  Home,
} from "lucide-react";
import { useLang } from "@/components/lexlens/language-provider";
import { SAMPLES } from "@/lib/lexlens/samples";
import { LOCALE_LABELS, OUTPUT_LOCALES } from "@/lib/lexlens/types";
import { newRunId, saveDraft } from "@/lib/lexlens/run-store";

type Tab = "paste" | "file" | "samples";

const SAMPLE_ICONS = [Landmark, Scale, Home];

export default function AnalyzePage() {
  const { t } = useLang();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<Tab>("paste");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileReading, setFileReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const canStart = text.trim().length >= 40 && !starting;
  const charCount = useMemo(() => text.trim().length, [text]);

  function start(source: string, label: string, noticeText: string) {
    const trimmed = noticeText.trim();
    if (trimmed.length < 40) {
      setError(t.an_need_more);
      setTab("paste");
      return;
    }
    setError(null);
    setStarting(true);
    const id = newRunId();
    saveDraft({ id, text: trimmed.slice(0, 12_000), source, label, createdAt: Date.now() });
    router.push(`/processing?id=${id}`);
  }

  async function handleFile(f: File) {
    setError(null);
    if (f.size > 2_000_000) {
      setError("File is larger than 2 MB.");
      return;
    }
    setFileReading(true);
    try {
      const content = await f.text();
      setText(content);
      setFileName(f.name);
      setTab("paste");
    } catch {
      setError("Could not read this file. Try a plain .txt file.");
    } finally {
      setFileReading(false);
    }
  }

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "paste", label: t.an_tab_paste, icon: ClipboardPaste },
    { key: "file", label: t.an_tab_file, icon: UploadCloud },
    { key: "samples", label: t.an_tab_samples, icon: FlaskConical },
  ];

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-gradient-to-b from-indigo-50/80 to-transparent" />

      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        {/* Heading */}
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{t.an_title}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-slate-600">{t.an_sub}</p>
        </div>

        {/* Output languages strip */}
        <div className="mx-auto mt-6 flex max-w-2xl flex-wrap items-center justify-center gap-2 text-xs font-medium text-slate-500">
          <LanguagesIcon className="h-3.5 w-3.5 text-indigo-500" />
          <span>{t.an_outlangs}</span>
          {OUTPUT_LOCALES.map((loc) => (
            <span key={loc} className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-0.5 font-semibold text-indigo-700">
              {LOCALE_LABELS[loc].native}
            </span>
          ))}
        </div>

        {/* Card */}
        <div className="print-card mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-100">
          {/* Tabs */}
          <div className="flex gap-1 border-b border-slate-100 p-2" role="tablist">
            {tabs.map((tb) => (
              <button
                key={tb.key}
                role="tab"
                aria-selected={tab === tb.key}
                onClick={() => setTab(tb.key)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors sm:flex-none sm:px-4 ${
                  tab === tb.key ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <tb.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tb.label}</span>
                <span className="sm:hidden">{tb.label.split(" ")[0]}</span>
              </button>
            ))}
          </div>

          <div className="p-5 sm:p-6">
            {/* ── Paste ── */}
            {tab === "paste" && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor="notice-text" className="text-sm font-semibold text-slate-800">
                    {t.an_paste_label}
                  </label>
                  {charCount > 0 && (
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>{charCount.toLocaleString()} / {t.an_chars}</span>
                      <button
                        onClick={() => {
                          setText("");
                          setFileName(null);
                        }}
                        className="flex items-center gap-1 font-medium text-slate-500 hover:text-red-600"
                      >
                        <X className="h-3 w-3" /> {t.an_clear}
                      </button>
                    </div>
                  )}
                </div>
                <textarea
                  id="notice-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={t.an_paste_ph}
                  rows={12}
                  className="font-legal custom-scroll w-full resize-y rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-[15px] leading-relaxed text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
                {fileName && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600">
                    <FileText className="h-3.5 w-3.5" />
                    {t.an_file_selected}: <span className="font-semibold">{fileName}</span>
                  </div>
                )}
              </div>
            )}

            {/* ── File upload ── */}
            {tab === "file" && (
              <div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f) void handleFile(f);
                  }}
                  disabled={fileReading}
                  className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 px-6 py-14 text-center transition-colors hover:border-indigo-400 hover:bg-indigo-50/40"
                >
                  {fileReading ? (
                    <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
                  ) : (
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
                      <UploadCloud className="h-7 w-7" />
                    </span>
                  )}
                  <span className="text-sm font-semibold text-slate-700">{t.an_file_btn}</span>
                  <span className="max-w-md text-xs leading-relaxed text-slate-500">{t.an_file_hint}</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,text/plain,text/markdown"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                    e.target.value = "";
                  }}
                />
              </div>
            )}

            {/* ── Samples ── */}
            {tab === "samples" && (
              <div>
                <h3 className="text-sm font-bold text-slate-900">{t.an_samples_title}</h3>
                <p className="mt-1 text-xs text-slate-500">{t.an_samples_sub}</p>
                <div className="mt-4 grid gap-3">
                  {SAMPLES.map((s, i) => {
                    const Icon = SAMPLE_ICONS[i % SAMPLE_ICONS.length];
                    return (
                      <div
                        key={s.id}
                        className="group flex flex-col gap-3 rounded-xl border border-slate-200 p-4 transition-colors hover:border-indigo-300 hover:bg-indigo-50/30 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-start gap-3.5">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                            <Icon className="h-5 w-5" />
                          </span>
                          <div>
                            <div className="text-sm font-bold text-slate-900">{s.title}</div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> {s.jurisdiction_label}
                              </span>
                              <span className="flex items-center gap-1">
                                <FileText className="h-3 w-3" /> {s.stat_hint}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => start(s.id, s.title, s.text)}
                          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-indigo-700 sm:self-auto"
                        >
                          {t.an_use}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
                {error}
              </p>
            )}

            {/* Start button (paste/file tabs) */}
            {tab !== "samples" && (
              <button
                onClick={() => start(fileName ? "file" : "paste", fileName ?? "Pasted text", text)}
                disabled={!canStart}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-md shadow-indigo-200 transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              >
                {starting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> {t.an_starting}
                  </>
                ) : (
                  <>
                    {t.an_start} <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Privacy note */}
        <p className="mx-auto mt-6 flex max-w-2xl items-start justify-center gap-2 text-center text-xs leading-relaxed text-slate-500">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          {t.an_privacy}
        </p>
      </div>
    </div>
  );
}
