// LexLens — TTL cleanup unit test (PRD §27).
// Verifies that temporary records expire automatically.
// Run: bun run scripts/test-cleanup.ts
import { db } from "../src/lib/db";
import { cleanupIfDue, sessionExpiresAt, SESSION_TTL_MS } from "../src/lib/session";

let pass = 0, fail = 0;
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}`); }
}

// Create a session + one of every temporary record.
const session = await db.analysisSession.create({
  data: { id: `test-session-${Date.now()}`, expiresAt: sessionExpiresAt() },
});
const notice = await db.notice.create({
  data: { sessionId: session.id, title: "TTL test", noticeText: "x".repeat(60), expiresAt: sessionExpiresAt() },
});
const report = await db.analysisReport.create({
  data: { noticeId: notice.id, sessionId: session.id, baseData: "{}", expiresAt: sessionExpiresAt() },
});
const evidence = await db.evidence.create({
  data: { noticeId: notice.id, sessionId: session.id, name: "e.pdf", mimeType: "application/pdf", size: 1, expiresAt: sessionExpiresAt() },
});
const draft = await db.responseDraft.create({
  data: { noticeId: notice.id, sessionId: session.id, content: "draft", expiresAt: sessionExpiresAt() },
});
const brief = await db.lawyerBrief.create({
  data: { noticeId: notice.id, sessionId: session.id, content: "{}", expiresAt: sessionExpiresAt() },
});

// Backdate everything past its TTL.
const past = new Date(Date.now() - SESSION_TTL_MS - 60_000);
await db.analysisSession.update({ where: { id: session.id }, data: { expiresAt: past } });
await db.notice.update({ where: { id: notice.id }, data: { expiresAt: past } });

// Run the forced sweep.
await cleanupIfDue(true);

check("expired session deleted", (await db.analysisSession.findUnique({ where: { id: session.id } })) === null);
check("expired notice deleted", (await db.notice.findUnique({ where: { id: notice.id } })) === null);
check("expired report deleted (cascade)", (await db.analysisReport.findUnique({ where: { id: report.id } })) === null);
check("expired evidence deleted (cascade)", (await db.evidence.findUnique({ where: { id: evidence.id } })) === null);
check("expired draft deleted (cascade)", (await db.responseDraft.findUnique({ where: { id: draft.id } })) === null);
check("expired brief deleted (cascade)", (await db.lawyerBrief.findUnique({ where: { id: brief.id } })) === null);

// A live session must survive the sweep.
const live = await db.analysisSession.create({
  data: { id: `live-session-${Date.now()}`, expiresAt: sessionExpiresAt() },
});
await cleanupIfDue(true);
check("live session survives TTL sweep", (await db.analysisSession.findUnique({ where: { id: live.id } })) !== null);
await db.analysisSession.delete({ where: { id: live.id } }).catch(() => {});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
