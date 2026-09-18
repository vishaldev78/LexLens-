// LexLens — anonymous session resolution (server only).
//
// PRD (anonymous SaaS): NO login, NO signup, NO accounts, NO profiles. The
// browser holds a cryptographically random session token in an HttpOnly
// cookie; the database stores only the SHA-256 hash of that token. Every
// temporary resource (notice, report, evidence, draft, brief, uploaded file)
// is scoped by sessionId and verified server-side — a foreign id yields a
// privacy-preserving 404 (PRD §4/§5/§34).
//
// Temporary data expires automatically (§27): the session and every record
// carry expiresAt (24h sliding). Expired rows are purged opportunistically
// by cleanupIfDue() — cheap, indexed deleteMany calls.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "lexlens_sid";

/** Session TTL: 24 hours, sliding on activity. */
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/** How often the opportunistic cleanup sweep may run. */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

export interface AnonymousSession {
  id: string; // SHA-256 of the browser token — this is the sessionId
  createdAt: Date;
  expiresAt: Date;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Create a fresh anonymous session (token + hashed DB row). */
async function createSession(): Promise<{ session: AnonymousSession; token: string }> {
  const token = randomBytes(32).toString("base64url"); // unpredictable, no PII
  const id = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const row = await db.analysisSession.create({ data: { id, expiresAt } });
  return { session: { id: row.id, createdAt: row.createdAt, expiresAt: row.expiresAt }, token };
}

/** Opportunistic TTL sweep (PRD §27). Cheap + indexed; throttled. */
let lastCleanup = 0;
export async function cleanupIfDue(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  const expired = new Date(now);
  try {
    // Remove uploaded files that belong to expired records (private temp
    // storage lives under uploads/<sessionId>/ — never public, PRD §26).
    const [deadNotices, deadEvidence] = await Promise.all([
      db.notice.findMany({
        where: { expiresAt: { lt: expired } },
        select: { filePath: true },
        take: 200,
      }),
      db.evidence.findMany({
        where: { expiresAt: { lt: expired } },
        select: { storedPath: true },
        take: 200,
      }),
    ]);
    for (const rel of [...deadNotices.map((n) => n.filePath), ...deadEvidence.map((e) => e.storedPath)]) {
      if (!rel) continue;
      const abs = path.join(process.cwd(), "uploads", rel);
      await unlink(abs).catch(() => {}); // best-effort; missing files are fine
    }

    // Row-level expiry for records whose session is still alive.
    // Batch delete operations to reduce connection pool pressure.
    await Promise.all([
      db.notice.deleteMany({ where: { expiresAt: { lt: expired } } }),
      db.analysisReport.deleteMany({ where: { expiresAt: { lt: expired } } }),
      db.evidence.deleteMany({ where: { expiresAt: { lt: expired } } }),
      db.responseDraft.deleteMany({ where: { expiresAt: { lt: expired } } }),
      db.lawyerBrief.deleteMany({ where: { expiresAt: { lt: expired } } }),
      db.reminder.deleteMany({ where: { expiresAt: { lt: expired } } }),
    ]);
    // Expired sessions cascade-delete their notices → reports/evidence/etc.
    await db.analysisSession.deleteMany({ where: { expiresAt: { lt: expired } } });
  } catch (err) {
    console.error("[lexlens/session] cleanup failed:", err instanceof Error ? err.message : err);
  }
}

/**
 * Resolve the current anonymous session from the browser cookie, creating a
 * new one when absent/expired. Must be called from a route handler (cookie
 * writes are only permitted there). Sliding TTL: every call extends expiry.
 */
export async function getOrCreateSession(): Promise<AnonymousSession> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;

  if (token && /^[A-Za-z0-9_-]{40,80}$/.test(token)) {
    const id = hashToken(token);
    const existing = await db.analysisSession.findUnique({ where: { id } });
    if (existing && existing.expiresAt.getTime() > Date.now()) {
      // Sliding expiry + keep records alive with the session.
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
      await Promise.all([
        db.analysisSession.update({ where: { id }, data: { expiresAt, updatedAt: new Date() } }),
        db.notice.updateMany({ where: { sessionId: id }, data: { expiresAt } }),
        db.analysisReport.updateMany({ where: { sessionId: id }, data: { expiresAt } }),
        db.evidence.updateMany({ where: { sessionId: id }, data: { expiresAt } }),
        db.responseDraft.updateMany({ where: { sessionId: id }, data: { expiresAt } }),
        db.lawyerBrief.updateMany({ where: { sessionId: id }, data: { expiresAt } }),
        db.reminder.updateMany({ where: { sessionId: id }, data: { expiresAt } }),
      ]);
      void cleanupIfDue();
      return { id: existing.id, createdAt: existing.createdAt, expiresAt };
    }
  }

  const { session, token: newToken } = await createSession();
  jar.set(SESSION_COOKIE, newToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
    path: "/",
  });
  void cleanupIfDue();
  return session;
}

/** Expiry timestamp for new temporary records (PRD §27). */
export function sessionExpiresAt(): Date {
  return new Date(Date.now() + SESSION_TTL_MS);
}

/** Compare a presented session id against the resolved one (defense in depth). */
export function sessionMatches(presented: string | null | undefined, current: AnonymousSession): boolean {
  if (!presented) return false;
  return safeEqual(presented, current.id);
}

/** Force-expire the current session ("Start New Analysis" clears state). */
export async function revokeSession(token: string | undefined | null): Promise<void> {
  if (!token) return;
  if (!/^[A-Za-z0-9_-]{40,80}$/.test(token)) return;
  const id = hashToken(token);
  await db.analysisSession.deleteMany({ where: { id } }); // cascade removes data
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", maxAge: 0, path: "/" });
}
