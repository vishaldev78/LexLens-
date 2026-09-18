// LexLens — Reminder System E2E test (receipt date → deadline → reminder → notification).
//
// Run: node scripts/test-reminder.mjs   (dev server must be on :3000)
//
// Covers:
//  1. Receipt date → DETERMINISTIC deadline recalculation (India §138: 15 days)
//  2. Set Reminder (anchored to the calculated deadline) + confirmation payload
//  3. Edit (replace) — always exactly ONE active reminder per notice
//  4. Guards: stale deadline anchor → 409, past time → 400, after deadline → 400,
//     no calculated deadline → 409
//  5. Session isolation: foreign session gets 404 + empty reminder list + cannot ack
//  6. Deadline shift: changing the receipt date shifts the reminder (same offset)
//  7. Due-fire + fire-once ack (the browser watcher's server contract)
//  8. Cancel reminder + notice deletion cascade
import { readFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";

// tiny .env loader (Prisma Client does not auto-load .env in plain node)
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const BASE = "http://localhost:3000";

let pass = 0, fail = 0;
function ok(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ FAIL: ${name} ${extra}`); }
}

function sha(s) { return createHash("sha256").update(s).digest("hex"); }
function cookieFor(token) { return { Cookie: `lexlens_sid=${token}` }; }

async function api(token, path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { ...(opts.headers ?? {}), ...cookieFor(token) },
  });
  let body = null;
  try { body = await res.json(); } catch { /* no body */ }
  return { status: res.status, body };
}

const DAY = 86_400_000;
const exp = new Date(Date.now() + DAY);

console.log("\n── setup: two anonymous sessions + India §138 notices ──");
const tokenA = randomBytes(32).toString("base64url");
const tokenB = randomBytes(32).toString("base64url");
const sessionA = { id: sha(tokenA), expiresAt: exp };
const sessionB = { id: sha(tokenB), expiresAt: exp };
await prisma.analysisSession.create({ data: sessionA });
await prisma.analysisSession.create({ data: sessionB });

const noticeA1 = await prisma.notice.create({
  data: {
    sessionId: sessionA.id, title: "Demand notice — cheque ₹85,000 (SBI)",
    noticeType: "cheque_bounce", jurisdiction: "INDIA", jurisdictionSource: "auto",
    legalDomain: "CHEQUE_DISHONOUR", analysisStatus: "READY", expiresAt: exp,
  },
});
const noticeA2 = await prisma.notice.create({ // receipt date missing → no deadline
  data: {
    sessionId: sessionA.id, title: "Notice without receipt date",
    noticeType: "cheque_bounce", jurisdiction: "INDIA", analysisStatus: "READY", expiresAt: exp,
  },
});
const noticeB1 = await prisma.notice.create({
  data: {
    sessionId: sessionB.id, title: "Session B notice",
    noticeType: "cheque_bounce", jurisdiction: "INDIA", analysisStatus: "READY", expiresAt: exp,
  },
});

try {
  /* 1 ─ receipt date → deterministic deadline */
  console.log("\n── 1 · receipt date → deadline (deterministic, never AI) ──");
  const patchRes = await api(tokenA, `/api/notices/${noticeA1.id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ receiptDate: "2026-09-19" }),
  });
  ok("PATCH receiptDate accepted", patchRes.status === 200);
  ok("deadline = 2026-10-04 (receipt 2026-09-19 + 15 days, NI Act §138)",
    patchRes.body?.notice?.deadlineDate === "2026-10-04",
    `got ${JSON.stringify(patchRes.body?.notice?.deadlineDate)}`);
  ok("deadline rule recorded", !!patchRes.body?.notice?.ruleLabel);

  /* 2 ─ set reminder */
  console.log("\n── 2 · set reminder (anchored to the calculated deadline) ──");
  const remindAt1 = Date.parse("2026-10-03T09:00:00");
  const setRes = await api(tokenA, `/api/notices/${noticeA1.id}/reminder`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ remindAt: remindAt1, deadline: "2026-10-04" }),
  });
  ok("POST reminder → 200", setRes.status === 200, JSON.stringify(setRes.body));
  ok("reminder echoes the deterministic deadline", setRes.body?.reminder?.deadlineDate === "2026-10-04");
  ok("reminder time stored exactly", setRes.body?.reminder?.remindAtMs === remindAt1);
  ok("reminder status ACTIVE", setRes.body?.reminder?.status === "ACTIVE");
  const reminderId = setRes.body?.reminder?.id;

  const detail1 = await api(tokenA, `/api/notices/${noticeA1.id}`);
  ok("notice detail exposes the active reminder", detail1.body?.reminder?.id === reminderId);

  /* 3 ─ edit reminder = replace, still exactly one */
  console.log("\n── 3 · edit reminder (replace, one active per notice) ──");
  const remindAt2 = Date.parse("2026-10-02T18:30:00");
  const editRes = await api(tokenA, `/api/notices/${noticeA1.id}/reminder`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ remindAt: remindAt2, deadline: "2026-10-04" }),
  });
  ok("second POST (edit) → 200", editRes.status === 200);
  ok("edit keeps a NEW id (old row replaced)", editRes.body?.reminder?.id !== reminderId);
  const list1 = await api(tokenA, "/api/reminders");
  ok("exactly ONE active reminder in session", list1.body?.reminders?.length === 1,
    `got ${list1.body?.reminders?.length}`);

  /* 4 ─ guards */
  console.log("\n── 4 · reminder guards (deterministic anchor enforcement) ──");
  const stale = await api(tokenA, `/api/notices/${noticeA1.id}/reminder`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ remindAt: remindAt2, deadline: "2026-10-05" }),
  });
  ok("stale deadline anchor rejected (409)", stale.status === 409, `got ${stale.status}`);

  const past = await api(tokenA, `/api/notices/${noticeA1.id}/reminder`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ remindAt: Date.now() - 10 * 60 * 1000, deadline: "2026-10-04" }),
  });
  ok("past reminder time rejected (400)", past.status === 400, `got ${past.status}`);

  const late = await api(tokenA, `/api/notices/${noticeA1.id}/reminder`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ remindAt: Date.parse("2026-10-10T09:00:00"), deadline: "2026-10-04" }),
  });
  ok("reminder after the deadline rejected (400)", late.status === 400, `got ${late.status}`);

  const noDl = await api(tokenA, `/api/notices/${noticeA2.id}/reminder`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ remindAt: remindAt2, deadline: "2026-10-04" }),
  });
  ok("reminder without a calculated deadline refused (409)", noDl.status === 409, `got ${noDl.status}`);

  /* 5 ─ session isolation */
  console.log("\n── 5 · session isolation (no accounts, but hard isolation) ──");
  const foreignSet = await api(tokenB, `/api/notices/${noticeA1.id}/reminder`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ remindAt: remindAt2, deadline: "2026-10-04" }),
  });
  ok("foreign session cannot set a reminder on A's notice (404)", foreignSet.status === 404, `got ${foreignSet.status}`);
  const foreignDel = await api(tokenB, `/api/notices/${noticeA1.id}/reminder`, { method: "DELETE" });
  ok("foreign session cannot cancel A's reminder (404)", foreignDel.status === 404, `got ${foreignDel.status}`);
  const listB = await api(tokenB, "/api/reminders");
  ok("session B's reminder list is empty", Array.isArray(listB.body?.reminders) && listB.body.reminders.length === 0);
  const foreignAck = await api(tokenB, "/api/reminders/ack", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: [editRes.body?.reminder?.id] }),
  });
  ok("foreign ack touches nothing (updated=0)", foreignAck.body?.updated === 0, JSON.stringify(foreignAck.body));
  const listA1 = await api(tokenA, "/api/reminders");
  ok("A's reminder still ACTIVE after foreign ack", listA1.body?.reminders?.[0]?.status === "ACTIVE");

  /* 6 ─ deadline shift keeps the reminder offset */
  console.log("\n── 6 · receipt date changes → reminder follows the new deadline ──");
  const beforeShift = (await api(tokenA, "/api/reminders")).body.reminders[0];
  const shiftRes = await api(tokenA, `/api/notices/${noticeA1.id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ receiptDate: "2026-09-20" }),
  });
  ok("deadline recalculated to 2026-10-05", shiftRes.body?.notice?.deadlineDate === "2026-10-05",
    `got ${JSON.stringify(shiftRes.body?.notice?.deadlineDate)}`);
  const afterShift = (await api(tokenA, "/api/reminders")).body.reminders[0];
  ok("reminder shifted by exactly +1 day", afterShift.remindAtMs - beforeShift.remindAtMs === DAY,
    `delta ${afterShift.remindAtMs - beforeShift.remindAtMs}`);
  ok("reminder now anchored to the new deadline", afterShift.deadlineDate === "2026-10-05");

  /* 7 ─ due-fire + fire-once ack (browser watcher contract) */
  console.log("\n── 7 · due reminder → notification contract (fire once) ──");
  const dueRes = await api(tokenA, `/api/notices/${noticeA1.id}/reminder`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ remindAt: Date.now() - 5_000, deadline: "2026-10-05" }),
  });
  ok("due reminder accepted (watcher fires it immediately)", dueRes.status === 200);
  const dueList = await api(tokenA, "/api/reminders");
  ok("watcher sees the due reminder in the session list", dueList.body?.reminders?.length === 1);
  const ackRes = await api(tokenA, "/api/reminders/ack", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: [dueRes.body?.reminder?.id] }),
  });
  ok("ack marks it notified (updated=1)", ackRes.body?.updated === 1, JSON.stringify(ackRes.body));
  const postAckList = await api(tokenA, "/api/reminders");
  ok("notified reminder no longer in the active list (fire once)", postAckList.body?.reminders?.length === 0);

  /* 8 ─ cancel + cascade */
  console.log("\n── 8 · cancel reminder & deletion cascade ──");
  await api(tokenA, `/api/notices/${noticeA1.id}/reminder`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ remindAt: Date.now() + 3_600_000, deadline: "2026-10-05" }),
  });
  const cancelRes = await api(tokenA, `/api/notices/${noticeA1.id}/reminder`, { method: "DELETE" });
  ok("cancel reminder → ok", cancelRes.status === 200);
  const detail2 = await api(tokenA, `/api/notices/${noticeA1.id}`);
  ok("notice detail shows reminder=null after cancel", detail2.body?.reminder === null);
  const listA2 = await api(tokenA, "/api/reminders");
  ok("session reminder list empty after cancel", listA2.body?.reminders?.length === 0);

  await api(tokenA, `/api/notices/${noticeA1.id}/reminder`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ remindAt: Date.now() + 3_600_000, deadline: "2026-10-05" }),
  });
  await api(tokenA, `/api/notices/${noticeA1.id}`, { method: "DELETE" });
  const orphans = await prisma.reminder.count({ where: { noticeId: noticeA1.id } });
  ok("deleting the notice cascade-deletes its reminders", orphans === 0, `left ${orphans}`);
  ok("session B notice untouched", (await prisma.reminder.count({ where: { noticeId: noticeB1.id } })) === 0);

} finally {
  // clean every trace of the test (anonymous test data must not linger)
  await prisma.analysisSession.deleteMany({ where: { id: { in: [sessionA.id, sessionB.id] } } });
  await prisma.$disconnect();
}

console.log(`\n═══ RESULT: ${pass} passed, ${fail} failed ═══`);
process.exit(fail === 0 ? 0 : 1);
