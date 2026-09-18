// LexLens — anonymous session management API.
// POST /api/session/new — "Start New Analysis" (PRD §38): force-expires the
// current anonymous session (cascade-deleting its temporary data) and issues
// a fresh one. No history survives.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { cleanupIfDue, getOrCreateSession, revokeSession, SESSION_COOKIE } from "@/lib/session";

export const runtime = "nodejs";

export async function POST() {
  const jar = await cookies();
  await revokeSession(jar.get(SESSION_COOKIE)?.value);
  const session = await getOrCreateSession();
  void cleanupIfDue();
  return NextResponse.json({ ok: true });
}
