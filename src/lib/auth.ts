// LexLens — local workspace resolution (server only).
//
// LexLens runs as a single private workspace: there are no accounts, no
// sign-in and no passwords. Requests are not attributed to a session — every
// piece of user-owned data belongs to the one local workspace user, which is
// created automatically on first use.
//
// The per-user data model (userId on notices, reports, evidence, reminders,
// notifications, drafts, briefs) is kept unchanged: the data-access layer
// still scopes every query through the helpers below, so the authorization
// boundary lives in exactly one place.

import { db } from "@/lib/db";

const LOCAL_USERNAME = "local";

export interface SafeUser {
  id: string;
  username: string;
  createdAt: Date;
  notifyEnabled: boolean;
  remind7: boolean;
  remind3: boolean;
  remind1: boolean;
  remindDue: boolean;
  remindOverdue: boolean;
}

function toSafe(u: {
  id: string; username: string; createdAt: Date;
  notifyEnabled: boolean; remind7: boolean; remind3: boolean; remind1: boolean; remindDue: boolean; remindOverdue: boolean;
}): SafeUser {
  return {
    id: u.id, username: u.username, createdAt: u.createdAt,
    notifyEnabled: u.notifyEnabled, remind7: u.remind7, remind3: u.remind3,
    remind1: u.remind1, remindDue: u.remindDue, remindOverdue: u.remindOverdue,
  };
}

/** The single local workspace user — created on first use.
 *  Never cached: preference updates must be visible on the next read. */
export async function getLocalUser(): Promise<SafeUser> {
  const existing = await db.user.findUnique({ where: { username: LOCAL_USERNAME } });
  if (existing) return toSafe(existing);
  const created = await db.user.create({ data: { username: LOCAL_USERNAME } });
  return toSafe(created);
}

/** Compatibility alias — always resolves to the local workspace user. */
export async function getAuthedUser(): Promise<SafeUser> {
  return getLocalUser();
}

/** For server components — no redirect is ever needed. */
export async function requireUser(): Promise<SafeUser> {
  return getLocalUser();
}

/** For route handlers — no 401 is ever raised. */
export async function requireApiUser(): Promise<SafeUser> {
  return getLocalUser();
}

/** Kept only so existing imports keep compiling; never thrown anymore. */
export class UnauthorizedError extends Error {}
