import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { startSession, verifyPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const username = (body.username ?? "").trim();
  const password = body.password ?? "";
  if (!username || !password) {
    return NextResponse.json({ error: "Please enter your username and password." }, { status: 400 });
  }

  try {
    const user = await db.user.findUnique({ where: { username } });
    // Same generic message for unknown user and wrong password (no enumeration).
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "Incorrect username or password." }, { status: 401 });
    }
    await startSession(user.id);
    return NextResponse.json({ user: { id: user.id, username: user.username } });
  } catch (err) {
    console.error("[lexlens/auth] login failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Sign-in failed. Please try again." }, { status: 500 });
  }
}
