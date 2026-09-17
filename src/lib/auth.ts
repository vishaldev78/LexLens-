// LexLens — authentication & session layer (server only).
//
// - Passwords: scrypt (node:crypto) with a per-user random salt. Never stored
//   or logged in plain text.
// - Sessions: stateless HMAC-signed tokens in an httpOnly cookie. No session
//   table needed; the signature is verified on every request.
// - Every helper that reads user-owned data goes through requireUser() /
//   getAuthedUser() so authorization is enforced at the data-access layer.

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

const COOKIE_NAME = "lexlens_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Auth secret — set AUTH_SECRET in .env for production. A dev fallback keeps
 *  local first-run from crashing, with a clear warning. */
function authSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    console.warn("[lexlens/auth] AUTH_SECRET is not set — using an ephemeral dev secret. Set AUTH_SECRET in .env!");
  }
  return "lexlens-dev-secret-do-not-use-in-production";
}

/* ───────────────────────── passwords ───────────────────────── */

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, salt, hash] = stored.split("$");
    if (scheme !== "scrypt" || !salt || !hash) return false;
    const candidate = scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, "hex");
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

/* ───────────────────────── session tokens ───────────────────────── */

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

function sign(payload: string): string {
  return createHmac("sha256", authSecret()).update(payload).digest("base64url");
}

function makeToken(userId: string): string {
  const payload = b64url(JSON.stringify({ uid: userId, exp: Date.now() + SESSION_TTL_MS }));
  return `${payload}.${sign(payload)}`;
}

function readToken(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(payload);
  if (sig.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { uid?: string; exp?: number };
    if (!data.uid || typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return data.uid;
  } catch {
    return null;
  }
}

/* ───────────────────────── cookie helpers ───────────────────────── */

export async function startSession(userId: string) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, makeToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function endSession() {
  const jar = await cookies();
  jar.set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export interface SafeUser {
  id: string;
  username: string;
  age: number;
  email: string | null;
  createdAt: Date;
  notifyEnabled: boolean;
  remind7: boolean;
  remind3: boolean;
  remind1: boolean;
  remindDue: boolean;
  remindOverdue: boolean;
}

function toSafe(u: {
  id: string; username: string; age: number; email: string | null; createdAt: Date;
  notifyEnabled: boolean; remind7: boolean; remind3: boolean; remind1: boolean; remindDue: boolean; remindOverdue: boolean;
}): SafeUser {
  return {
    id: u.id, username: u.username, age: u.age, email: u.email, createdAt: u.createdAt,
    notifyEnabled: u.notifyEnabled, remind7: u.remind7, remind3: u.remind3,
    remind1: u.remind1, remindDue: u.remindDue, remindOverdue: u.remindOverdue,
  };
}

/** Returns the signed-in user or null. Safe in RSC and route handlers. */
export async function getAuthedUser(): Promise<SafeUser | null> {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token) return null;
    const uid = readToken(token);
    if (!uid) return null;
    const user = await db.user.findUnique({ where: { id: uid } });
    return user ? toSafe(user) : null;
  } catch {
    return null;
  }
}

/** For server components: redirects to /login when signed out. */
export async function requireUser(): Promise<SafeUser> {
  const user = await getAuthedUser();
  if (!user) redirect("/login");
  return user;
}

/** For route handlers: throws a 401-shaped error when signed out. */
export class UnauthorizedError extends Error {}

export async function requireApiUser(): Promise<SafeUser> {
  const user = await getAuthedUser();
  if (!user) throw new UnauthorizedError("Not signed in");
  return user;
}

/* ───────────────────────── validation ───────────────────────── */

export const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;

export function validateSignup(username: string, age: number, password: string): string | null {
  if (!USERNAME_RE.test(username)) {
    return "Username must be 3–24 characters (letters, numbers, underscores).";
  }
  if (!Number.isInteger(age) || age < 18 || age > 120) {
    return "You must be at least 18 years old to create an account.";
  }
  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (password.length > 200) {
    return "Password is too long.";
  }
  return null;
}
