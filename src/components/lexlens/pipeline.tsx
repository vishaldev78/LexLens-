"use client";

import { motion } from "framer-motion";
import {
  ScanLine,
  FileText,
  Languages,
  Globe2,
  Tags,
  ListChecks,
  BookOpenCheck,
  ShieldCheck,
  ClipboardCheck,
  Check,
  Loader2,
} from "lucide-react";
import type { Analysis } from "@/lib/lexlens/types";
import { LANGUAGE_NAMES, NOTICE_TYPE_LABELS } from "@/lib/lexlens/types";

export interface StageMeta {
  language: string;
  jurisdiction: string;
  noticeType: string;
  citations: number;
  confidence: number;
}

const STAGES: { key: string; label: string; icon: React.ElementType }[] = [
  { key: "preprocess", label: "Preprocess input", icon: ScanLine },
  { key: "extract", label: "Text extraction (OCR)", icon: FileText },
  { key: "lang", label: "Language detection", icon: Languages },
  { key: "jur", label: "Jurisdiction detection", icon: Globe2 },
  { key: "classify", label: "Notice classification", icon: Tags },
  { key: "entities", label: "Entity extraction", icon: ListChecks },
  { key: "corpus", label: "Corpus retrieval", icon: BookOpenCheck },
  { key: "safety", label: "Analysis + safety pass", icon: ShieldCheck },
  { key: "ready", label: "Action plan ready", icon: ClipboardCheck },
];

function stageSub(i: number, meta: StageMeta | null, done: boolean): string {
  if (!done) {
    const running: Record<number, string> = {
      0: "Normalizing characters, stripping headers…",
      1: "Reconstructing document layout…",
      2: "Scoring 40+ scripts & languages…",
      3: "Matching sender, court and statute clues…",
      4: "Mapping to notice taxonomy…",
      5: "Extracting sender, demands, deadlines…",
      6: "Searching jurisdiction-filtered statute corpus…",
      7: "Verifying citations against corpus…",
      8: "Assembling plain-language breakdown…",
    };
    return running[i] ?? "";
  }
  if (!meta) return "done";
  const final: Record<number, string> = {
    0: "input normalized",
    1: "clean text layer built",
    2: `detected: ${LANGUAGE_NAMES[meta.language] ?? meta.language}`,
    3: meta.jurisdiction,
    4: NOTICE_TYPE_LABELS[meta.noticeType] ?? meta.noticeType,
    5: "structured schema filled",
    6: `${meta.citations} statute${meta.citations === 1 ? "" : "s"} matched`,
    7: meta.confidence < 0.75 ? "low confidence flagged" : "all citations verified",
    8: `confidence ${(meta.confidence * 100).toFixed(0)}%`,
  };
  return final[i] ?? "done";
}

export function Pipeline({
  currentStage,
  done,
  analysis,
}: {
  currentStage: number;
  done: boolean;
  analysis: Analysis | null;
}) {
  const meta: StageMeta | null = analysis
    ? {
        language: analysis.language_detected,
        jurisdiction: `${analysis.jurisdiction.country}${analysis.jurisdiction.region ? " · " + analysis.jurisdiction.region : ""}`,
        noticeType: analysis.notice_type,
        citations: analysis.citations.length,
        confidence: analysis.overall_confidence,
      }
    : null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {!done && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-60"></span>
            )}
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${done ? "bg-emerald-500" : "bg-indigo-500"}`}
            ></span>
          </span>
          <h3 className="text-sm font-semibold tracking-wide text-slate-800">
            {done ? "Pipeline complete" : "Analyzing your notice…"}
          </h3>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-widest text-slate-400">
          {done ? "10-stage v0.9" : "10-stage pipeline"}
        </span>
      </div>

      <ol className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {STAGES.map((stage, i) => {
          const isDone = done || i < currentStage;
          const isActive = !done && i === currentStage;
          const Icon = stage.icon;
          return (
            <motion.li
              key={stage.key}
              initial={false}
              animate={{
                opacity: isDone || isActive ? 1 : 0.45,
                scale: isActive ? 1.015 : 1,
              }}
              transition={{ duration: 0.25 }}
              className="relative flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5"
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                  isActive
                    ? "border-indigo-200 bg-indigo-50 text-indigo-600"
                    : isDone
                      ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                      : "border-slate-200 bg-slate-50 text-slate-400"
                }`}
              >
                {isDone ? (
                  <Check className="h-4 w-4" strokeWidth={3} />
                ) : isActive ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </span>
              <span className="min-w-0">
                <span
                  className={`block text-[13px] font-medium leading-tight ${
                    isActive ? "font-semibold text-indigo-700" : isDone ? "text-slate-800" : "text-slate-500"
                  }`}
                >
                  {stage.label}
                </span>
                <span
                  className={`block truncate font-mono text-[11px] leading-tight ${
                    isActive ? "text-indigo-500" : isDone ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  {(isDone || isActive) && stageSub(i, meta, done)}
                </span>
              </span>
              {isActive && (
                <motion.span
                  layoutId="stage-glow"
                  className="pointer-events-none absolute inset-0 rounded-xl border border-indigo-200 bg-indigo-50/70"
                />
              )}
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
