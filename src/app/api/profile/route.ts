import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthedUser, hashPassword, requireApiUser, UnauthorizedError, verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  return NextResponse.json({
    profile: {
      id: user.id,
      username: user.username,
      age: user.age,
      email: user.email,
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
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = (await req.json().catch(() => ({}))) as {
      email?: string | null;
      notifications?: Partial<{ enabled: boolean; days7: boolean; days3: boolean; days1: boolean; dueDate: boolean; overdue: boolean }>;
    };

    const data: Record<string, unknown> = { updatedAt: new Date() };

    if (body.email !== undefined) {
      const email = body.email === null || body.email === "" ? null : String(body.email).trim();
      if (email) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
        }
        const clash = await db.user.findFirst({ where: { email, id: { not: user.id } }, select: { id: true } });
        if (clash) return NextResponse.json({ error: "That email is already in use." }, { status: 409 });
      }
      data.email = email;
    }

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
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    console.error("[lexlens/profile] patch failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not save your settings." }, { status: 500 });
  }
}

/** Change password (requires the current password). */
export async function POST(req: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = (await req.json().catch(() => ({}))) as { currentPassword?: string; newPassword?: string };
    const current = body.currentPassword ?? "";
    const next = body.newPassword ?? "";

    const row = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
    if (!row || !verifyPassword(current, row.passwordHash)) {
      return NextResponse.json({ error: "Your current password is incorrect." }, { status: 400 });
    }
    if (next.length < 8) {
      return NextResponse.json({ error: "The new password must be at least 8 characters." }, { status: 400 });
    }
    await db.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(next), updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    return NextResponse.json({ error: "Could not change the password." }, { status: 500 });
  }
}

/** Delete account — cascades to all owned data. */
export async function DELETE() {
  try {
    const user = await requireApiUser();
    await db.user.delete({ where: { id: user.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    console.error("[lexlens/profile] delete failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not delete the account." }, { status: 500 });
  }
}
