import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateSession, sessionExpiresAt } from "@/lib/session";
import { getOwnedNotice, parseUserState, recalcAndStoreDeadline, toSummary } from "@/lib/lexlens/server/notices";
import { runAnalysis } from "@/lib/lexlens/server/analyze";
import { todayISO } from "@/lib/lexlens/deadline-engine";
import { LANGUAGE_NAMES } from "@/lib/lexlens/types";

export const runtime = "nodejs";
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

const FACT_LABEL_EN: Record<string, string> = {
  receipt_date: "notice receipt date",
  notice_date: "notice date",
};

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await getOrCreateSession();
    const { id } = await params;
    const notice = await getOwnedNotice(id, session.id);
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

    // Explicit user jurisdiction selection (PRD §3) — authoritative signal.
    let userJurisdiction: string | null = notice.jurisdictionSource === "user" && ["INDIA", "USA"].includes(notice.jurisdiction)
      ? notice.jurisdiction
      : null;
    const body = (await req.json().catch(() => null)) as { jurisdiction?: string } | null;
    if (body?.jurisdiction === "INDIA" || body?.jurisdiction === "USA") userJurisdiction = body.jurisdiction;

    const result = await runAnalysis(notice.noticeText, userJurisdiction);
    const base = result.base;

    // PRD §2 — unsupported notice language is flagged, never silently analysed.
    if (base.language_unsupported) {
      console.info(`[lexlens] notice ${notice.id}: unsupported language "${base.language_detected}"`);
    }

    const amountFact = base.facts.find((f) => f.key === "amount" && f.num !== null);
    const noticeDateFact = base.facts.find((f) => f.key === "notice_date" && f.iso);
    const countryCol = base.jurisdiction.country === "INDIA" ? "INDIA" : base.jurisdiction.country === "USA" ? "USA" : "UNKNOWN";
    const legalDomain =
      base.notice_type === "cheque_bounce" && countryCol === "INDIA"
        ? "CHEQUE_DISHONOUR"
        : base.notice_type === "debt_collection" && countryCol === "USA"
          ? "DEBT_COLLECTION"
          : base.notice_type.toUpperCase();

    await db.analysisReport.create({
      data: {
          noticeId: notice.id,
        sessionId: session.id,
        expiresAt: sessionExpiresAt(),
        baseData: JSON.stringify(base),
        metaJson: JSON.stringify(result.internalMeta),
      },
    });

    const updated = await db.notice.update({
      where: { id: notice.id },
      data: {
        noticeType: base.notice_type,
        jurisdiction: countryCol,
        jurisdictionSource: base.jurisdiction.userSelected ? "user" : "auto",
        legalDomain,
        noticeLanguage: LANGUAGE_NAMES[base.language_detected] ?? base.language_detected,
        severity: base.severity.level,
        claimedAmount: amountFact ? amountFact.value : base.claims.find((c) => c.amount !== null)?.amount?.toString() ?? null,
        currency: amountFact?.currency ?? base.claims.find((c) => c.currency)?.currency ?? null,
        noticeDate: noticeDateFact?.iso ? new Date(`${noticeDateFact.iso}T00:00:00Z`) : null,
        // Canonical receipt date (PRD §7/§8): when the notice itself states it,
        // store it immediately — the engine must never claim it is missing.
        receiptDate: (base.facts.find((f) => f.key === "receipt_date")?.iso)
          ? new Date(`${base.facts.find((f) => f.key === "receipt_date")!.iso!}T00:00:00Z`)
          : undefined,
        analysisStatus: "READY",
        updatedAt: new Date(),
      },
    });

    // Mirror a document-stated receipt date into userState (single source of truth).
    const docReceipt = base.facts.find((f) => f.key === "receipt_date")?.iso;
    if (docReceipt) {
      const state = parseUserState(updated.userState);
      state.inputs = { ...state.inputs, receipt_date: { value: docReceipt, iso: docReceipt, num: null, at: Date.now() } };
      await db.notice.update({ where: { id: notice.id }, data: { userState: JSON.stringify(state) } });
    }

    // Deterministic deadline from whatever anchor dates exist right now.
    const reloaded = await getOwnedNotice(id, session.id);
    const withDeadline = await recalcAndStoreDeadline(reloaded ?? updated, undefined);

    return NextResponse.json({ ok: true, notice: toSummary(withDeadline, todayISO()) });
  } catch (err) {
    // Persist the failure state so the document is never lost (friendly retry).
    try {
      const session = await getOrCreateSession();
      const { id } = await params;
      const notice = await getOwnedNotice(id, session.id);
      if (notice && notice.analysisStatus === "PENDING") {
        await db.notice.update({ where: { id: notice.id }, data: { analysisStatus: "FAILED" } });
      }
    } catch {
      /* best-effort */
    }
    console.error("[lexlens/notices] analyze failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "We couldn't complete the analysis. Your uploaded document has been saved. Please try again." },
      { status: 500 },
    );
  }
}
