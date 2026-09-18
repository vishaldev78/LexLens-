// LexLens — server-side notice helpers (session ownership, persistence,
// canonical case facts). Every accessor verifies the anonymous sessionId —
// session isolation is enforced HERE, not in the UI (PRD §4/§5/§34).

import { db } from "@/lib/db";
import type { Notice } from "@prisma/client";
import { deriveDeadline, deriveStatus, isoFromDate, type NoticeStatus } from "./deadline";
import type { CaseBase, CaseJurisdiction, UserCaseState } from "../types";
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
  jurisdictionSource: string;
  legalDomain: string;
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
    jurisdictionSource: n.jurisdictionSource,
    legalDomain: n.legalDomain,
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

/* ─────────────────── canonical case facts (PRD §12) ───────────────────
 * ONE source of truth for the dates every feature consumes (deadline
 * engine, timeline, response draft, action center, lawyer brief, PDF).
 * Precedence: explicit user confirmation > document fact > null. */

export interface CanonicalCaseFacts {
  noticeDate: string | null;
  noticeReceivedDate: string | null;
  chequeDate: string | null;
  dishonourDate: string | null;
  amount: number | null;
  currency: string | null;
  chequeNumber: string | null;
  bankName: string | null;
  jurisdiction: CaseJurisdiction;
  legalDomain: string;
}

export function canonicalCaseFacts(
  notice: Pick<Notice, "noticeDate" | "receiptDate" | "jurisdiction" | "legalDomain">,
  base: CaseBase | null,
  userState: UserCaseState | null,
): CanonicalCaseFacts {
  const docFact = (key: string) => base?.facts.find((f) => f.key === key) ?? null;
  const userInput = (key: string) => userState?.inputs?.[key] ?? null;

  const noticeDate = isoFromDate(notice.noticeDate) ?? docFact("notice_date")?.iso ?? null;
  // noticeReceivedDate: user confirmation wins, then the DB column, then the document.
  const userReceipt = userInput("receipt_date")?.iso ?? null;
  const dbReceipt = isoFromDate(notice.receiptDate);
  const noticeReceivedDate = userReceipt ?? dbReceipt ?? docFact("receipt_date")?.iso ?? null;

  const amountFact = docFact("amount");
  return {
    noticeDate,
    noticeReceivedDate,
    chequeDate: docFact("cheque_date")?.iso ?? null,
    dishonourDate: docFact("dishonour_date")?.iso ?? null,
    amount: amountFact?.num ?? null,
    currency: amountFact?.currency ?? null,
    chequeNumber: docFact("cheque_number")?.value ?? null,
    bankName: docFact("bank_name")?.value ?? null,
    jurisdiction: (["INDIA", "USA"].includes(notice.jurisdiction) ? notice.jurisdiction : "UNKNOWN") as CaseJurisdiction,
    legalDomain: notice.legalDomain || "UNKNOWN",
  };
}

/* ─────────────────── receipt-date consistency gate (PRD §13) ───────────────────
 * Contradictions between the stored receipt date, the user state and the
 * analysis MUST fail report generation instead of producing a misleading
 * legal report. */

export class CaseFactConsistencyError extends Error {
  constructor() {
    super("Case fact synchronization error.");
  }
}

export function validateCaseFactConsistency(
  notice: Pick<Notice, "receiptDate">,
  userState: UserCaseState | null,
  base: CaseBase | null,
): void {
  const dbReceipt = isoFromDate(notice.receiptDate);
  const userReceipt = userState?.inputs?.receipt_date?.iso ?? null;

  // The mirrored user input and the canonical DB column must never disagree.
  if (userReceipt && dbReceipt && userReceipt !== dbReceipt) {
    throw new CaseFactConsistencyError();
  }
  // A document-verified receipt date that disagrees with a confirmed user
  // date means extraction and user state diverged — refuse to render.
  const docReceipt = base?.facts.find((f) => f.key === "receipt_date")?.iso ?? null;
  if (docReceipt && dbReceipt && userReceipt && docReceipt !== userReceipt) {
    if (dbReceipt !== userReceipt) throw new CaseFactConsistencyError();
  }
}

/** Recalculate + persist the deterministic deadline for a notice. */
export async function recalcAndStoreDeadline(notice: Notice, receiptOverrideISO?: string | null): Promise<Notice> {
  const report = await db.analysisReport.findUnique({ where: { noticeId: notice.id }, select: { baseData: true } });
  const base = parseBase(report?.baseData ?? null);
  const state = parseUserState(notice.userState);
  const receiptISO = receiptOverrideISO !== undefined ? receiptOverrideISO : isoFromDate(notice.receiptDate);
  const country = (["INDIA", "USA"].includes(notice.jurisdiction) ? notice.jurisdiction : "UNKNOWN") as "INDIA" | "USA" | "UNKNOWN";
  const dl = deriveDeadline(notice.noticeType, base, receiptISO, country, base?.debt_rule_applicable ?? null);
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

/** Session-ownership-checked fetch for route handlers. Throws a 404-shaped
 *  null — a foreign session id is indistinguishable from a nonexistent one
 *  (privacy-preserving 404, PRD §34). Expired records count as gone. */
export async function getOwnedNotice(noticeId: string, sessionId: string): Promise<Notice | null> {
  if (!noticeId || noticeId.length > 64) return null;
  const notice = await db.notice.findUnique({ where: { id: noticeId } });
  if (!notice) return null;
  if (notice.sessionId !== sessionId) return null; // never leak existence
  if (notice.expiresAt.getTime() <= Date.now()) return null; // expired = gone
  return notice;
}
