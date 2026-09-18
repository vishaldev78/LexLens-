import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateSession, sessionExpiresAt } from "@/lib/session";
import { getOwnedNotice, parseBase, parseUserState } from "@/lib/lexlens/server/notices";
import { generateDraft, templateFallback } from "@/lib/lexlens/server/draft";
import { buildCaseView } from "@/lib/lexlens/case-engine";
import { todayISO } from "@/lib/lexlens/deadline-engine";
import type { Locale, UserPosition } from "@/lib/lexlens/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await getOrCreateSession();
    const { id } = await params;
    const notice = await getOwnedNotice(id, session.id);
    if (!notice) return NextResponse.json({ error: "Notice not found." }, { status: 404 });

    const body = (await req.json().catch(() => ({}))) as { locale?: Locale };
    const locale = (["en", "hi", "zh", "fr"].includes(body.locale ?? "") ? body.locale : "en") as Locale;

    const report = await db.analysisReport.findUnique({ where: { noticeId: notice.id } });
    const base = parseBase(report?.baseData ?? null);
    const state = parseUserState(notice.userState);

    // Deadline line for the draft context (deterministic only).
    let deadlineLine: string | null = null;
    if (base) {
      const view = buildCaseView(base, state, locale, todayISO());
      const dl = view.deadlines.find((d) => d.status === "calculated");
      deadlineLine = dl ? `${dl.label}: ${dl.deadline}` : null;
    }

    const result = await generateDraft({
      noticeText: notice.noticeText,
      noticeType: notice.noticeType,
      locale,
      position: state.position,
      facts: base ? base.facts.map((f) => ({ key: f.key, value: f.value })) : [],
      missing: [],
      deadlineLine,
    });

    // One draft per notice — upsert on (noticeId).
    const existing = await db.responseDraft.findFirst({ where: { noticeId: notice.id, sessionId: session.id }, select: { id: true } });
    const row = existing
      ? await db.responseDraft.update({ where: { id: existing.id }, data: { content: result.draft, source: result.source, updatedAt: new Date() } })
      : await db.responseDraft.create({ data: { sessionId: session.id, noticeId: notice.id, content: result.draft, source: result.source, expiresAt: sessionExpiresAt() } });

    const state2 = parseUserState(notice.userState);
    state2.draft = { text: row.content, source: row.source as "ai" | "template", at: row.updatedAt.getTime() };
    await db.notice.update({ where: { id: notice.id }, data: { userState: JSON.stringify(state2) } });

    return NextResponse.json({ draft: result.draft, source: result.source });
  } catch (err) {
        console.error("[lexlens/notices] draft failed:", err instanceof Error ? err.message : err);
    // Last-resort template so the button never dead-ends.
    try {
      const session = await getOrCreateSession();
      const { id } = await params;
      const notice = await getOwnedNotice(id, session.id);
      if (notice) {
        const report = await db.analysisReport.findUnique({ where: { noticeId: notice.id } });
        const base = parseBase(report?.baseData ?? null);
        if (base) {
          const state = parseUserState(notice.userState);
          const view = buildCaseView(base, state, "en", todayISO());
          const text = templateFallback({
            noticeText: notice.noticeText,
            noticeType: notice.noticeType,
            locale: "en",
            position: state.position,
            facts: base.facts.map((f) => ({ key: f.key, value: f.value })),
            missing: view.missing.map((m) => m.field),
            deadlineLine: null,
          });
          return NextResponse.json({ draft: text, source: "template" });
        }
      }
    } catch {
      /* ignore */
    }
    return NextResponse.json({ error: "Could not prepare the response draft. Please try again." }, { status: 500 });
  }
}
