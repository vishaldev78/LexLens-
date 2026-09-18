import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser, UnauthorizedError } from "@/lib/auth";
import { getOwnedNotice, parseBase, parseUserState } from "@/lib/lexlens/server/notices";
import { buildCaseView, buildBrief, briefToText } from "@/lib/lexlens/case-engine";
import { todayISO } from "@/lib/lexlens/deadline-engine";
import type { Locale } from "@/lib/lexlens/types";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const notice = await getOwnedNotice(id, user);
    if (!notice) return NextResponse.json({ error: "Notice not found." }, { status: 404 });

    const body = (await req.json().catch(() => ({}))) as { locale?: Locale };
    const locale = (["en", "hi", "zh", "fr"].includes(body.locale ?? "") ? body.locale : "en") as Locale;

    const report = await db.analysisReport.findUnique({ where: { noticeId: notice.id } });
    const base = parseBase(report?.baseData ?? null);
    if (!base) return NextResponse.json({ error: "This notice has no completed analysis yet." }, { status: 400 });

    const state = parseUserState(notice.userState);
    const view = buildCaseView(base, state, locale, todayISO());
    const brief = buildBrief(view, locale);

    const payload = JSON.stringify(brief);
    const existing = await db.lawyerBrief.findFirst({ where: { noticeId: notice.id, userId: user.id }, select: { id: true } });
    if (existing) {
      await db.lawyerBrief.update({ where: { id: existing.id }, data: { content: payload, updatedAt: new Date() } });
    } else {
      await db.lawyerBrief.create({ data: { userId: user.id, noticeId: notice.id, content: payload } });
    }

    return NextResponse.json({ ok: true, brief, text: briefToText(brief, locale) });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    console.error("[lexlens/notices] brief failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not prepare the lawyer brief." }, { status: 500 });
  }
}
