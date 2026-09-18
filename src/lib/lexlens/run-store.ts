// LexLens — run + case storage.
// Flow: /analyze saves a draft → /processing reads it, calls the API, saves the
// report → /result reads it. Every finished analysis is also archived to
// localStorage as a CaseRecord so /cases can list and reopen cases.

import type { AnalyzeResponse, CaseRecord, UserCaseState } from "./types";
import { emptyUserState } from "./types";

const DRAFT_KEY = "lexlens.run.draft";
const RESULT_KEY = "lexlens.run.result";
const CASES_KEY = "lexlens.cases";

export interface RunDraft {
  id: string;
  text: string;
  source: string; // "paste" | "file" | sample id
  label: string;
  createdAt: number;
}

export interface RunResult extends AnalyzeResponse {
  draft: RunDraft;
  finishedAt: number;
}

function getSession<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function setSession(key: string, value: unknown) {
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
  setSession(DRAFT_KEY, draft);
}

export function loadDraft(): RunDraft | null {
  return getSession<RunDraft>(DRAFT_KEY);
}

export function saveResult(result: RunResult) {
  setSession(RESULT_KEY, result);
}

export function loadResult(): RunResult | null {
  return getSession<RunResult>(RESULT_KEY);
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

/* ───────────────────────── case archive (localStorage) ───────────────────────── */

export function listCases(): CaseRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CASES_KEY);
    const arr = raw ? (JSON.parse(raw) as CaseRecord[]) : [];
    return arr.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function getCase(id: string): CaseRecord | null {
  return listCases().find((c) => c.id === id) ?? null;
}

export function saveCase(record: CaseRecord) {
  if (typeof window === "undefined") return;
  try {
    const arr = listCases().filter((c) => c.id !== record.id);
    arr.unshift(record);
    window.localStorage.setItem(CASES_KEY, JSON.stringify(arr.slice(0, 30)));
  } catch {
    /* storage full */
  }
}

export function upsertCaseFromResult(result: RunResult): CaseRecord | null {
  if (!result.base) return null;
  const record: CaseRecord = {
    id: result.draft.id,
    label: result.draft.label,
    createdAt: result.finishedAt,
    updatedAt: Date.now(),
    base: result.base,
    user: emptyUserState(),
  };
  saveCase(record);
  return record;
}

export function patchCase(id: string, patch: (u: UserCaseState) => UserCaseState): CaseRecord | null {
  const rec = getCase(id);
  if (!rec) return null;
  const next: CaseRecord = { ...rec, user: patch(rec.user), updatedAt: Date.now() };
  saveCase(next);
  return next;
}

export function deleteCase(id: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CASES_KEY, JSON.stringify(listCases().filter((c) => c.id !== id)));
  } catch {
    /* ignore */
  }
}
