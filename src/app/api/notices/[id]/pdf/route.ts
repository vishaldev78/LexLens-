import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateSession } from "@/lib/session";
import {
  CaseFactConsistencyError,
  getOwnedNotice,
  parseBase,
  parseUserState,
  validateCaseFactConsistency,
} from "@/lib/lexlens/server/notices";
import { generateNoticePdf } from "@/lib/lexlens/server/report-pdf";
import { todayISO } from "@/lib/lexlens/deadline-engine";
import type { Locale } from "@/lib/lexlens/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await getOrCreateSession();
    const { id } = await params;
    const notice = await getOwnedNotice(id, session.id);
    if (!notice) return NextResponse.json({ error: "Notice not found." }, { status: 404 });

    const report = await db.analysisReport.findUnique({ where: { noticeId: notice.id } });
    const base = parseBase(report?.baseData ?? null);
    if (!base) {
      return NextResponse.json({ error: "The analysis for this notice is not ready yet." }, { status: 400 });
    }

    const url = new URL(req.url);
    const locale = (["en", "hi"].includes(url.searchParams.get("locale") ?? "")
      ? url.searchParams.get("locale")
      : "en") as Locale;

    const state = parseUserState(notice.userState);

    // PRD §9 — receipt-date consistency gate. A contradictory report must
    // NEVER render; refuse with an actionable error instead.
    validateCaseFactConsistency(notice, state, base);
    const brief = await db.lawyerBrief.findFirst({
      where: { noticeId: notice.id, sessionId: session.id },
      orderBy: { updatedAt: "desc" },
    });

    // Deadline status is derived live — never stored.
    const deadlineISO = notice.deadlineDate ? notice.deadlineDate.toISOString().slice(0, 10) : null;
    let daysRemaining: number | null = null;
    if (deadlineISO) {
      daysRemaining = Math.round(
        (new Date(`${deadlineISO}T00:00:00Z`).getTime() - new Date(`${todayISO()}T00:00:00Z`).getTime()) / 86_400_000,
      );
    }

    const amountNum = base.facts.find((f) => f.key === "amount" && f.num !== null)?.num ?? null;

    const pdf = await generateNoticePdf({
      locale,
      noticeTitle: notice.title,
      noticeType: base.notice_type,
      jurisdiction: notice.jurisdiction || `${base.jurisdiction.country}${base.jurisdiction.region ? " · " + base.jurisdiction.region : ""}`,
      noticeLanguage: base.language_detected,
      severity: base.severity.level,
      claimedAmount: notice.claimedAmount ?? (amountNum !== null ? String(amountNum) : null),
      currency: base.facts.find((f) => f.key === "amount")?.currency ?? null,
      noticeDate: notice.noticeDate ? notice.noticeDate.toISOString().slice(0, 10) : null,
      receiptDate: notice.receiptDate ? notice.receiptDate.toISOString().slice(0, 10) : null,
      deadlineDate: deadlineISO,
      daysRemaining,
      deadlineStatus: notice.deadlineRule ?? "",
      ruleLabel: notice.deadlineRule,
      base,
      userState: state,
      draftText: state.draft?.text ?? null,
      briefJson: brief?.content ?? null,
    });

    const filename = `LexLens-Report-${notice.title.replace(/[^a-zA-Z0-9-_ ]/g, "").slice(0, 60) || "Notice"}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
        if (err instanceof CaseFactConsistencyError) {
      console.error("[lexlens/notices] case fact synchronization error:", err.message);
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("[lexlens/notices] pdf failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not generate the PDF report. Please try again." }, { status: 500 });
  }
}
