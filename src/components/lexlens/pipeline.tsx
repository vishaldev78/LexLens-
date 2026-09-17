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

function stageSub(
  i: number,
  meta: StageMeta | null,
  done: boolean
): string {
  if (!done) {
    const running: Record<number, string> = {
      0: "Normalizing characters, stripping headers…",
      1: "Reconstructing document layout…",
      2: "Scoring 40+ scripts & languages…",
      3: "Matching sender, court and statute clues…",
      4: "Mapping to notice taxonomy…",
      5: "Extracting sender, demands, deadlines…",
      6: `Searching ${meta ? "jurisdiction-filtered" : "versioned"} statute corpus…`,
      7: "Verifying citations against corpus…",
      8: "Assembling plain-language breakdown…",
    };
    return running[i] ?? "";
  }
  if (!meta) return "done";
  const final: Record<number, string> = {
    0: `${meta.noticeType ? "input normalized" : "done"}`,
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
  currentStage: number; // index of the active stage
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
    <div
      aria-live="polite"
      className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-5 sm:p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {!done && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-60"></span>
            )}
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${done ? "bg-emerald-400" : "bg-indigo-400"}`}
            ></span>
          </span>
          <h3 className="text-sm font-semibold tracking-wide text-slate-200">
            {done ? "Pipeline complete" : "Analyzing your notice…"}
          </h3>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-widest text-slate-500">
          {done ? "10-stage v0.9" : "10-stage pipeline"}
        </span>
      </div>

      <ol className="relative space-y-1">
        {STAGES.map((stage, i) => {
          const isDone = done || i < currentStage;
          const isActive = !done && i === currentStage;
          const Icon = stage.icon;
          return (
            <motion.li
              key={stage.key}
              initial={false}
              animate={{
                opacity: isDone || isActive ? 1 : 0.38,
                x: isActive ? 4 : 0,
              }}
              transition={{ duration: 0.25 }}
              className="relative flex items-center gap-3 rounded-xl px-3 py-2"
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                  isActive
                    ? "border-indigo-400/50 bg-indigo-500/20 text-indigo-300"
                    : isDone
                      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                      : "border-white/10 bg-white/[0.03] text-slate-500"
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
                  className={`block text-[13px] leading-tight font-medium ${
                    isActive ? "text-indigo-200" : isDone ? "text-slate-200" : "text-slate-400"
                  }`}
                >
                  {stage.label}
                </span>
                <span
                  className={`block font-mono text-[11px] leading-tight truncate ${
                    isActive ? "text-indigo-400/90" : "text-slate-500"
                  }`}
                >
                  {(isDone || isActive) && stageSub(i, meta, done)}
                </span>
              </span>
              {isActive && (
                <motion.span
                  layoutId="stage-glow"
                  className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-indigo-400/30 bg-indigo-500/[0.06]"
                />
              )}
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
