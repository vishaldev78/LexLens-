import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

export const runtime = "nodejs";

/** Workspace preferences — profile GET. */
export async function GET() {
  try {
    const user = await requireApiUser();
    return NextResponse.json({
      profile: {
        id: user.id,
        username: user.username,
        createdAt: user.createdAt,
        notifications: {
          enabled: user.notifyEnabled,
          days7: user.remind7,
          days3: user.remind3,
          days1: user.remind1,
          dueDate: user.remindDue,
          overdue: user.remindOverdue,
        },
      },
    });
  } catch (err) {
    console.error("[lexlens/profile] get failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not load your settings." }, { status: 500 });
  }
}

/** Workspace preferences — save notification settings. */
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = (await req.json().catch(() => ({}))) as {
      notifications?: Partial<{ enabled: boolean; days7: boolean; days3: boolean; days1: boolean; dueDate: boolean; overdue: boolean }>;
    };

    const data: Record<string, unknown> = { updatedAt: new Date() };

    if (body.notifications) {
      const n = body.notifications;
      if (typeof n.enabled === "boolean") data.notifyEnabled = n.enabled;
      if (typeof n.days7 === "boolean") data.remind7 = n.days7;
      if (typeof n.days3 === "boolean") data.remind3 = n.days3;
      if (typeof n.days1 === "boolean") data.remind1 = n.days1;
      if (typeof n.dueDate === "boolean") data.remindDue = n.dueDate;
      if (typeof n.overdue === "boolean") data.remindOverdue = n.overdue;
    }

    await db.user.update({ where: { id: user.id }, data });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[lexlens/profile] patch failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not save your settings." }, { status: 500 });
  }
}
