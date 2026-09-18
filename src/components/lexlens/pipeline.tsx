"use client";

import { motion } from "framer-motion";
import {
  ScanLine,
  ListChecks,
  BookOpenCheck,
  GitBranch,
  AlertTriangle,
  ClipboardCheck,
  Check,
  Loader2,
} from "lucide-react";
import type { CaseBase } from "@/lib/lexlens/types";
import { LANGUAGE_NAMES } from "@/lib/lexlens/types";

export interface StageMeta {
  language: string;
  jurisdiction: string;
  noticeType: string;
  citations: number;
  confidence: number;
}

export interface PipelineStrings {
  titleRunning: string;
  titleDone: string;
  labels: string[]; // 6 stage labels
  running: string[]; // 6 running sub-lines
}

const STAGE_ICONS: React.ElementType[] = [
  ScanLine,
  ListChecks,
  BookOpenCheck,
  GitBranch,
  AlertTriangle,
  ClipboardCheck,
];

export const PIPELINE_STAGE_COUNT = 6;

/** Language-neutral "done" values — engine facts speak for themselves. */
function stageDoneValue(i: number, meta: StageMeta | null): string {
  if (!meta) return "✓";
  switch (i) {
    case 0:
      return LANGUAGE_NAMES[meta.language] ?? meta.language;
    case 1:
      return `${meta.noticeType}`;
    case 2:
      return `${meta.citations}`;
    case 5:
      return `${Math.round(meta.confidence * 100)}%`;
    default:
      return "✓";
  }
}

export function Pipeline({
  currentStage,
  done,
  base,
  s,
}: {
  currentStage: number;
  done: boolean;
  base: CaseBase | null;
  s: PipelineStrings;
}) {
  const meta: StageMeta | null = base
    ? {
        language: base.language_detected,
        jurisdiction: `${base.jurisdiction.country}${base.jurisdiction.region ? " · " + base.jurisdiction.region : ""}`,
        noticeType: base.notice_type,
        citations: base.citations.length,
        confidence: base.overall_confidence,
      }
    : null;
  const N = PIPELINE_STAGE_COUNT;

  return (
    <div className="print-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            {!done && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-60" />
            )}
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${done ? "bg-emerald-500" : "bg-indigo-500"}`} />
          </span>
          <h3 className="text-sm font-bold tracking-tight text-slate-900 sm:text-base">
            {done ? s.titleDone : s.titleRunning}
          </h3>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-500">
          {done ? `${N} / ${N}` : `${Math.min(currentStage + 1, N)} / ${N}`}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
          initial={false}
          animate={{ width: done ? "100%" : `${((currentStage + 1) / N) * 100}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      <ol className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {STAGE_ICONS.map((Icon, i) => {
          const isDone = done || i < currentStage;
          const isActive = !done && i === currentStage;
          return (
            <motion.li
              key={i}
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
                  className={`block truncate text-[13px] font-medium leading-tight ${
                    isActive ? "font-bold text-indigo-700" : isDone ? "text-slate-800" : "text-slate-500"
                  }`}
                >
                  {s.labels[i]}
                </span>
                <span
                  className={`block truncate font-mono text-[11px] leading-tight ${
                    isActive ? "text-indigo-500" : isDone ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  {(isDone || isActive) && (isDone ? stageDoneValue(i, meta) : s.running[i])}
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
