import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateSession } from "@/lib/session";
import {
  CaseFactConsistencyError,
  getOwnedNotice,
  parseBase,
  parseUserState,
  recalcAndStoreDeadline,
  toSummary,
  validateCaseFactConsistency,
} from "@/lib/lexlens/server/notices";
import { validateAnalysis } from "@/lib/lexlens/validator";
import { fillRulePackRights } from "@/lib/lexlens/server/analyze";
import { toReminderDTO } from "@/lib/lexlens/server/reminders";
import { classifyNotice, type CaseBase } from "@/lib/lexlens/types";
import { todayISO } from "@/lib/lexlens/deadline-engine";
import type { UserInputValue } from "@/lib/lexlens/types";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await getOrCreateSession();
    const { id } = await params;
    const notice = await getOwnedNotice(id, session.id);
    if (!notice) return NextResponse.json({ error: "Notice not found." }, { status: 404 });

    const report = await db.analysisReport.findUnique({ where: { noticeId: notice.id } });
    const draft = await db.responseDraft.findFirst({
      where: { noticeId: notice.id, sessionId: session.id },
      orderBy: { updatedAt: "desc" },
    });
    const brief = await db.lawyerBrief.findFirst({
      where: { noticeId: notice.id, sessionId: session.id },
      orderBy: { updatedAt: "desc" },
    });
    const evidence = await db.evidence.findMany({
      where: { noticeId: notice.id, sessionId: session.id },
      orderBy: { createdAt: "asc" },
    });
    // The notice's ACTIVE deadline reminder (session-scoped, deadline-anchored).
    const activeReminder = await db.reminder.findFirst({
      where: { noticeId: notice.id, sessionId: session.id, status: "ACTIVE" },
      orderBy: { remindAt: "asc" },
    });

    const state = parseUserState(notice.userState);
    // PRD §9 — refuse to serve an inconsistent report.
    validateCaseFactConsistency(notice, state, report ? parseBase(report.baseData) : null);
    return NextResponse.json({
      notice: toSummary(notice, todayISO()),
      base: report ? parseBaseSafe(report.baseData) : null,
      userState: {
        ...state,
        draft: draft ? { text: draft.content, source: draft.source as "ai" | "template", at: draft.updatedAt.getTime() } : state.draft,
      },
      hasBrief: !!brief,
      reminder: activeReminder ? toReminderDTO(activeReminder, notice.title) : null,
      evidenceRows: evidence.map((e) => ({ id: e.id, name: e.name, size: e.size, mimeType: e.mimeType, createdAt: e.createdAt.toISOString() })),
      noticeText: notice.noticeText,
    });
  } catch (err) {
        if (err instanceof CaseFactConsistencyError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("[lexlens/notices] get failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not load this notice." }, { status: 500 });
  }
}

function parseBaseSafe(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await getOrCreateSession();
    const { id } = await params;
    const notice = await getOwnedNotice(id, session.id);
    if (!notice) return NextResponse.json({ error: "Notice not found." }, { status: 404 });

    const body = (await req.json().catch(() => ({}))) as {
      receiptDate?: string | null;
      title?: string;
      completed?: boolean;
      position?: string | null;
      jurisdiction?: "INDIA" | "USA";
      inputs?: Record<string, { value: string; iso: string | null; num: number | null }>;
    };

    // PRD §3 — explicit jurisdiction confirmation (the UNKNOWN gate).
    // Re-runs the jurisdiction firewall over the stored analysis and
    // recalculates the deterministic deadline for the confirmed jurisdiction.
    if (body.jurisdiction === "INDIA" || body.jurisdiction === "USA") {
      const report = await db.analysisReport.findUnique({ where: { noticeId: notice.id } });
      const base = parseBase(report?.baseData ?? null);
      if (base) {
        base.jurisdiction = {
          ...base.jurisdiction,
          country: body.jurisdiction,
          confidence: 0.99,
          userSelected: true,
          signals: ["Selected by the user"],
        };
        base.debt_rule_applicable = base.notice_type === "debt_collection" && body.jurisdiction === "USA" ? base.debt_rule_applicable ?? null : null;
        base.classification = classifyNotice(base.notice_type, body.jurisdiction, base.debt_rule_applicable);
        fillRulePackRights(base);
        const { base: validated } = validateAnalysis(base);
        await db.analysisReport.update({
          where: { noticeId: notice.id },
          data: { baseData: JSON.stringify(validated) },
        });
        const jurUpdated = await db.notice.update({
          where: { id: notice.id },
          data: {
            jurisdiction: body.jurisdiction,
            jurisdictionSource: "user",
            legalDomain: base.notice_type === "cheque_bounce" && body.jurisdiction === "INDIA" ? "CHEQUE_DISHONOUR" : notice.legalDomain || base.notice_type.toUpperCase(),
            updatedAt: new Date(),
          },
        });
        const recalced = await recalcAndStoreDeadline(jurUpdated, undefined);
        return NextResponse.json({ notice: toSummary(recalced, todayISO()) });
      }
    }

    // Receipt date (or explicit clearing) → deterministic deadline recalculation.
    if (body.receiptDate !== undefined) {
      const iso = body.receiptDate && /^\d{4}-\d{2}-\d{2}$/.test(body.receiptDate) ? body.receiptDate : null;
      if (body.receiptDate && !iso) {
        return NextResponse.json({ error: "That date format is not valid." }, { status: 400 });
      }
      const recalced = await recalcAndStoreDeadline(notice, iso);

      // Mirror the confirmed receipt date into userState so the case view,
      // drafts and briefs all see the same fact.
      const state = parseUserState(notice.userState);
      if (iso) {
        state.inputs = { ...state.inputs, receipt_date: { value: iso, iso, num: null, at: Date.now() } };
      } else {
        delete state.inputs.receipt_date;
      }
      await db.notice.update({ where: { id: notice.id }, data: { userState: JSON.stringify(state) } });

      return NextResponse.json({ notice: toSummary(recalced, todayISO()) });
    }

    const data: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim().slice(0, 120);
    if (typeof body.completed === "boolean") data.completed = body.completed;

    if (body.position !== undefined || body.inputs !== undefined) {
      const state = parseUserState(notice.userState);
      if (body.position !== undefined) {
        const allowed = ["agree", "partial_dispute", "full_dispute", "already_paid", "dont_recognize", "unknown"];
        state.position = body.position && allowed.includes(body.position) ? (body.position as typeof state.position) : null;
      }
      if (body.inputs !== undefined) {
        const clean: Record<string, UserInputValue> = {};
        for (const [k, v] of Object.entries(body.inputs ?? {}).slice(0, 40)) {
          if (!/^[a-z_]{1,40}$/.test(k) || typeof v?.value !== "string") continue;
          clean[k] = { value: v.value.slice(0, 300), iso: v.iso, num: v.num, at: Date.now() };
        }
        state.inputs = clean;
      }
      data.userState = JSON.stringify(state);
    }

    const updated = await db.notice.update({ where: { id: notice.id }, data });
    return NextResponse.json({ notice: toSummary(updated, todayISO()) });
  } catch (err) {
        console.error("[lexlens/notices] patch failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not update this notice." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await getOrCreateSession();
    const { id } = await params;
    const notice = await getOwnedNotice(id, session.id);
    if (!notice) return NextResponse.json({ error: "Notice not found." }, { status: 404 });
    await db.notice.delete({ where: { id: notice.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
        console.error("[lexlens/notices] delete failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not delete this notice." }, { status: 500 });
  }
}
