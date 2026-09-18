import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser, UnauthorizedError } from "@/lib/auth";
import { getOwnedNotice, recalcAndStoreDeadline, toSummary } from "@/lib/lexlens/server/notices";
import { runAnalysis } from "@/lib/lexlens/server/analyze";
import { notifyAnalysisFailed, notifyMissingInfo, notifyReportReady } from "@/lib/lexlens/server/notify";
import { todayISO } from "@/lib/lexlens/deadline-engine";
import { LANGUAGE_NAMES } from "@/lib/lexlens/types";

export const runtime = "nodejs";
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

const FACT_LABEL_EN: Record<string, string> = {
  receipt_date: "notice receipt date",
  notice_date: "notice date",
};

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const notice = await getOwnedNotice(id, user);
    if (!notice) return NextResponse.json({ error: "Notice not found." }, { status: 404 });

    if (notice.noticeText.trim().length < 40) {
      return NextResponse.json(
        { error: "This notice has no readable text yet. Please upload a clearer document or paste the text." },
        { status: 400 },
      );
    }

    // Already analyzed → return the stored report (never re-run automatically).
    const existing = await db.analysisReport.findUnique({ where: { noticeId: notice.id } });
    if (existing) {
      return NextResponse.json({ ok: true, alreadyAnalyzed: true, notice: toSummary(notice, todayISO()) });
    }

    const result = await runAnalysis(notice.noticeText);
    const base = result.base;

    const amountFact = base.facts.find((f) => f.key === "amount" && f.num !== null);
    const noticeDateFact = base.facts.find((f) => f.key === "notice_date" && f.iso);

    await db.analysisReport.create({
      data: {
        noticeId: notice.id,
        userId: user.id,
        baseData: JSON.stringify(base),
        metaJson: JSON.stringify(result.internalMeta),
      },
    });

    const updated = await db.notice.update({
      where: { id: notice.id },
      data: {
        noticeType: base.notice_type,
        jurisdiction: `${base.jurisdiction.country}${base.jurisdiction.region ? " · " + base.jurisdiction.region : ""}`,
        noticeLanguage: LANGUAGE_NAMES[base.language_detected] ?? base.language_detected,
        severity: base.severity.level,
        claimedAmount: amountFact ? amountFact.value : base.claims.find((c) => c.amount !== null)?.amount?.toString() ?? null,
        currency: amountFact?.currency ?? base.claims.find((c) => c.currency)?.currency ?? null,
        noticeDate: noticeDateFact?.iso ? new Date(`${noticeDateFact.iso}T00:00:00Z`) : null,
        analysisStatus: "READY",
        updatedAt: new Date(),
      },
    });

    // Deterministic deadline from whatever anchor dates exist right now.
    const withDeadline = await recalcAndStoreDeadline(updated, undefined);

    // Event notifications (once per notice).
    await notifyReportReady(user.id, user.username, { id: notice.id, title: notice.title });
    const needsReceipt =
      (withDeadline.noticeType === "cheque_bounce" || withDeadline.noticeType === "debt_collection") &&
      !withDeadline.receiptDate;
    if (needsReceipt) {
      await notifyMissingInfo(user.id, { id: notice.id, title: notice.title }, FACT_LABEL_EN.receipt_date);
    }
    if (result.internalMeta.fallback) {
      // Quietly keep the audit trail server-side; nothing user-facing exposes engines.
      console.info(`[lexlens] notice ${notice.id} analyzed with standard engine (${result.processingMs}ms)`);
    }

    return NextResponse.json({ ok: true, notice: toSummary(withDeadline, todayISO()) });
  } catch (err) {
    // Persist the failure state so the document is never lost (friendly retry).
    try {
      const user = await requireApiUser();
      const { id } = await params;
      const notice = await getOwnedNotice(id, user);
      if (notice && notice.analysisStatus === "PENDING") {
        await db.notice.update({ where: { id: notice.id }, data: { analysisStatus: "FAILED" } });
        await notifyAnalysisFailed(user.id, { id: notice.id, title: notice.title });
      }
    } catch {
      /* best-effort */
    }
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    console.error("[lexlens/notices] analyze failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "We couldn't complete the analysis. Your uploaded document has been saved. Please try again." },
      { status: 500 },
    );
  }
}
