import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser, UnauthorizedError } from "@/lib/auth";
import { toSummary } from "@/lib/lexlens/server/notices";
import { syncReminders } from "@/lib/lexlens/server/notify";
import { todayISO } from "@/lib/lexlens/deadline-engine";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireApiUser();

    // Deterministic reminder sync runs on dashboard load — the dashboard is
    // always current for "today", countdowns are computed per request.
    await syncReminders(user);

    const [notices, unread] = await Promise.all([
      db.notice.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } }),
      db.notification.count({ where: { userId: user.id, isRead: false } }),
    ]);

    const today = todayISO();
    const summaries = notices.map((n) => toSummary(n, today));

    const deadlines = summaries
      .filter((n) => !n.completed && n.deadlineDate && (n.status === "ACTIVE" || n.status === "DUE_SOON" || n.status === "DUE_TODAY" || n.status === "OVERDUE"))
      .sort((a, b) => (a.deadlineDate ?? "").localeCompare(b.deadlineDate ?? ""))
      .slice(0, 5);

    const attention = summaries.filter(
      (n) => !n.completed && (n.status === "DUE_SOON" || n.status === "DUE_TODAY" || n.status === "OVERDUE" || n.analysisStatus === "FAILED"),
    ).length;

    return NextResponse.json({
      user: { id: user.id, username: user.username, email: user.email, createdAt: user.createdAt },
      deadlines,
      recentNotices: summaries.slice(0, 6),
      totalNotices: summaries.length,
      unreadNotifications: unread,
      attention,
      today,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    console.error("[lexlens/dashboard] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not load the dashboard." }, { status: 500 });
  }
}
