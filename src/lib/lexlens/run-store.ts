// LexLens — run state passed between the separate pages via sessionStorage.
// Flow: /analyze saves a draft → /processing reads it, calls the API, saves
// the report → /result reads the report. Refresh-safe within the same tab.

import type { AnalyzeResponse } from "./types";

const DRAFT_KEY = "lexlens.run.draft";
const RESULT_KEY = "lexlens.run.result";

export interface RunDraft {
  id: string;
  text: string;
  source: string; // "paste" | "file" | sample id
  label: string; // display label (file name / sample title / "Pasted text")
  createdAt: number;
}

export interface RunResult extends AnalyzeResponse {
  draft: RunDraft;
  finishedAt: number;
}

function safeGet<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function safeSet(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / private mode */
  }
}

export function newRunId(): string {
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function saveDraft(draft: RunDraft) {
  safeSet(DRAFT_KEY, draft);
}

export function loadDraft(): RunDraft | null {
  return safeGet<RunDraft>(DRAFT_KEY);
}

export function saveResult(result: RunResult) {
  safeSet(RESULT_KEY, result);
}

export function loadResult(): RunResult | null {
  return safeGet<RunResult>(RESULT_KEY);
}

export function clearRun() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
    window.sessionStorage.removeItem(RESULT_KEY);
  } catch {
    /* ignore */
  }
}
