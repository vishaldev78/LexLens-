// LexLens — server-side notice helpers (mapping, ownership, persistence).
// Every accessor verifies userId — data isolation is enforced HERE, not in the UI.

import { db } from "@/lib/db";
import type { Notice, User } from "@prisma/client";
import { deriveDeadline, deriveStatus, isoFromDate, type NoticeStatus } from "./deadline";
import type { CaseBase, UserCaseState } from "../types";
import { emptyUserState } from "../types";

export function parseUserState(json: string): UserCaseState {
  try {
    const raw = JSON.parse(json) as Partial<UserCaseState>;
    return {
      inputs: raw.inputs ?? {},
      position: raw.position ?? null,
      evidence: Array.isArray(raw.evidence) ? raw.evidence : [],
      draft: raw.draft ?? null,
    };
  } catch {
    return emptyUserState();
  }
}

export function parseBase(json: string | null | undefined): CaseBase | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as CaseBase;
  } catch {
    return null;
  }
}

export interface NoticeSummary {
  id: string;
  title: string;
  sourceLabel: string;
  fileType: string;
  noticeType: string;
  jurisdiction: string;
  severity: string;
  noticeLanguage: string;
  claimedAmount: string | null;
  currency: string | null;
  noticeDate: string | null;
  receiptDate: string | null;
  deadlineDate: string | null;
  ruleLabel: string | null;
  status: NoticeStatus;
  daysRemaining: number | null;
  completed: boolean;
  analysisStatus: string;
  hasReport: boolean;
  missingReceipt: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toSummary(n: Notice, today: string): NoticeSummary {
  const dl = deriveStatus(n.completed, isoFromDate(n.deadlineDate), !!n.deadlineSourceId || !!n.deadlineRule, today);
  return {
    id: n.id,
    title: n.title,
    sourceLabel: n.sourceLabel,
    fileType: n.fileType,
    noticeType: n.noticeType,
    jurisdiction: n.jurisdiction,
    severity: n.severity,
    noticeLanguage: n.noticeLanguage,
    claimedAmount: n.claimedAmount,
    currency: n.currency,
    noticeDate: isoFromDate(n.noticeDate),
    receiptDate: isoFromDate(n.receiptDate),
    deadlineDate: isoFromDate(n.deadlineDate),
    ruleLabel: n.deadlineRule,
    status: dl.status,
    daysRemaining: dl.daysRemaining,
    completed: n.completed,
    analysisStatus: n.analysisStatus,
    hasReport: n.analysisStatus === "READY",
    missingReceipt: !n.receiptDate,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  };
}

/** Recalculate + persist the deterministic deadline for a notice. */
export async function recalcAndStoreDeadline(notice: Notice, receiptOverrideISO?: string | null): Promise<Notice> {
  const base = parseBase(
    (await db.analysisReport.findUnique({ where: { noticeId: notice.id }, select: { baseData: true } }))?.baseData ?? null,
  );
  const receiptISO = receiptOverrideISO !== undefined ? receiptOverrideISO : isoFromDate(notice.receiptDate);
  const dl = deriveDeadline(notice.noticeType, base, receiptISO);
  return db.notice.update({
    where: { id: notice.id },
    data: {
      receiptDate: receiptISO ? new Date(`${receiptISO}T00:00:00Z`) : null,
      deadlineDate: dl.deadlineDate ? new Date(`${dl.deadlineDate}T00:00:00Z`) : null,
      deadlineRule: dl.ruleLabel,
      deadlineSourceId: dl.sourceId,
      updatedAt: new Date(),
    },
  });
}

/** Ownership-checked fetch for route handlers. Throws 404-shaped null. */
export async function getOwnedNotice(noticeId: string, user: Pick<User, "id">): Promise<Notice | null> {
  if (!noticeId || noticeId.length > 64) return null;
  const notice = await db.notice.findUnique({ where: { id: noticeId } });
  if (!notice || notice.userId !== user.id) return null; // never leak existence
  return notice;
}
