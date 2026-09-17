import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, startSession, validateSignup } from "@/lib/auth";

export async function POST(req: NextRequest) {
  let body: { username?: string; age?: unknown; password?: string; email?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const username = (body.username ?? "").trim();
  const password = body.password ?? "";
  const email = (body.email ?? "").trim() || null;
  const age = typeof body.age === "string" ? Number(body.age) : Number(body.age);

  const invalid = validateSignup(username, age, password);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address, or leave it empty." }, { status: 400 });
  }

  try {
    const clash = await db.user.findFirst({
      where: email ? { OR: [{ username }, { email }] } : { username },
      select: { username: true, email: true },
    });
    if (clash) {
      const msg = clash.username === username ? "That username is already taken." : "An account with that email already exists.";
      return NextResponse.json({ error: msg }, { status: 409 });
    }

    const user = await db.user.create({
      data: { username, age, email, passwordHash: hashPassword(password) },
      select: { id: true, username: true },
    });
    await startSession(user.id);
    return NextResponse.json({ user });
  } catch (err) {
    console.error("[lexlens/auth] signup failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "We couldn't create your account. Please try again." }, { status: 500 });
  }
}
