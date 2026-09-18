// LexLens — anonymous session isolation test suite (PRD §33/§34/§48).
// Runs against the live dev server. Two anonymous sessions (cookie jars, NO
// accounts) must each see only their own temporary analysis data — verified
// with DIRECT API requests, not the UI.
// Run: node scripts/test-privacy.mjs

const BASE = "http://localhost:3000";
let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name} ${extra}`); }
}

function jar() { return { cookie: "" }; }
async function req(session, method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(session.cookie ? { Cookie: session.cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) session.cookie = setCookie.split(";")[0];
  return res;
}

console.log("Setup: two anonymous sessions (no signup — sessions are issued automatically)");
const A = jar();
const B = jar();

// Any API call provisions a fresh anonymous session with an HttpOnly cookie.
{
  const r = await req(A, "GET", "/api/notices");
  check("Session A auto-provisioned on first API call", r.status === 200 && /lexlens_sid=/.test(A.cookie));
  const r2 = await req(B, "GET", "/api/notices");
  check("Session B auto-provisioned independently", r2.status === 200 && /lexlens_sid=/.test(B.cookie));
  check("Session tokens differ", A.cookie.split("=")[1] !== B.cookie.split("=")[1]);
  const list = await (await req(A, "GET", "/api/notices")).json();
  check("Fresh session has no history (empty list)", Array.isArray(list.notices) && list.notices.length === 0);
}

console.log("Each session analyzes its own notice");
const NOTICE_A = `BY REGISTERED POST A.D.

Date: 18 September 2026

To, Mr. Rohan Mehta, Mumbai.

SUB: LEGAL NOTICE UNDER SECTION 138 OF THE NEGOTIABLE INSTRUMENTS ACT, 1881

You issued Cheque No. 458721 dated 5 September 2026 for Rs. 85,000 drawn on State Bank of India, which was dishonoured on 10 September 2026. Pay Rs. 85,000 within 15 days of receipt of this notice, failing which criminal proceedings under Section 138 will follow. This notice was received under acknowledgment on 19 September 2026.`;
const NOTICE_B = `ALLIED RECOVERY SYSTEMS LLC — debt collector letter. Buffalo, Buffalo NY 14213. FDCPA 15 U.S.C. §1692g validation notice. Balance owed $2,340.55 to Feline Bank USA. Unless you dispute within thirty (30) days after receiving this notice the debt will be assumed valid. This is an attempt to collect a debt.`;

async function upload(session, text, label) {
  const r = await req(session, "POST", "/api/notices", { text, label, source: "paste" });
  const d = await r.json().catch(() => ({}));
  return { status: r.status, id: d.notice?.id ?? null };
}
const upA = await upload(A, NOTICE_A, "Notice A");
const upB = await upload(B, NOTICE_B, "Notice B");
check("Session A uploaded a notice", upA.status === 200 && !!upA.id, `(got ${upA.status})`);
check("Session B uploaded a notice", upB.status === 200 && !!upB.id, `(got ${upB.status})`);

console.log("Session list isolation");
{
  const la = await (await req(A, "GET", "/api/notices")).json();
  const lb = await (await req(B, "GET", "/api/notices")).json();
  check("Session A list contains only A's notice", la.notices?.length === 1 && la.notices[0].id === upA.id);
  check("Session B list contains only B's notice", lb.notices?.length === 1 && lb.notices[0].id === upB.id);
}

console.log("Direct ID attacks across sessions (PRD §34) — privacy-preserving 404");
{
  const aReadsB = await req(A, "GET", `/api/notices/${upB.id}`);
  const bReadsA = await req(B, "GET", `/api/notices/${upA.id}`);
  check("Session A → notice B denied", aReadsB.status === 404, `(got ${aReadsB.status})`);
  check("Session B → notice A denied", bReadsA.status === 404, `(got ${bReadsA.status})`);

  const bPatchA = await req(B, "PATCH", `/api/notices/${upA.id}`, { title: "HACKED" });
  check("Session B cannot update A's notice", bPatchA.status === 404, `(got ${bPatchA.status})`);
  const bDelA = await req(B, "DELETE", `/api/notices/${upA.id}`);
  check("Session B cannot delete A's notice", bDelA.status === 404, `(got ${bDelA.status})`);
  const bFileA = await req(B, "GET", `/api/notices/${upA.id}/file`);
  check("Session B cannot download A's document", bFileA.status === 404, `(got ${bFileA.status})`);
  const bPdfA = await req(B, "GET", `/api/notices/${upA.id}/pdf`);
  check("Session B cannot download A's PDF", bPdfA.status === 404, `(got ${bPdfA.status})`);
  const bDraftA = await req(B, "POST", `/api/notices/${upA.id}/draft`, { locale: "en" });
  check("Session B cannot draft on A's notice", bDraftA.status === 404, `(got ${bDraftA.status})`);
  const bBriefA = await req(B, "POST", `/api/notices/${upA.id}/brief`, { locale: "en" });
  check("Session B cannot brief on A's notice", bBriefA.status === 404, `(got ${bBriefA.status})`);
  const bAnalyzeA = await req(B, "POST", `/api/notices/${upA.id}/analyze`, {});
  check("Session B cannot analyze A's notice", bAnalyzeA.status === 404, `(got ${bAnalyzeA.status})`);
}

console.log("Owner sessions still work");
{
  const okA = await req(A, "GET", `/api/notices/${upA.id}`);
  check("Session A can read its own notice", okA.status === 200, `(got ${okA.status})`);
  const okB = await req(B, "GET", `/api/notices/${upB.id}`);
  check("Session B can read its own notice", okB.status === 200, `(got ${okB.status})`);
}

console.log("No accounts exist at all");
{
  // Auth endpoints must be gone (404/405) — no login/signup surface.
  const login = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "x@y.z", password: "nope1234" }) });
  check("No login endpoint", login.status === 404, `(got ${login.status})`);
  const signup = await fetch(`${BASE}/api/auth/signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "x@y.z", password: "nope1234" }) });
  check("No signup endpoint", signup.status === 404, `(got ${signup.status})`);
  const dash = await fetch(`${BASE}/api/dashboard`);
  check("No dashboard endpoint", dash.status === 404, `(got ${dash.status})`);
  const page = await fetch(`${BASE}/login`, { redirect: "manual" });
  check("No /login page", page.status === 404, `(got ${page.status})`);
}

console.log("Session token integrity");
{
  // A garbage cookie must NOT map onto anyone's session — it gets a fresh one.
  const forged = jar();
  forged.cookie = "lexlens_sid=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  const list = await (await req(forged, "GET", "/api/notices")).json();
  check("Forged token gets its own empty session — no cross-session data", list.notices?.length === 0);
  const cross = await req(forged, "GET", `/api/notices/${upA.id}`);
  check("Forged token cannot read Session A's notice", cross.status === 404, `(got ${cross.status})`);
}

console.log("Start New Analysis revokes the session (PRD §38)");
{
  const r = await req(A, "POST", "/api/session/new");
  check("POST /api/session/new ok", r.status === 200);
  // The OLD cookie now maps to a deleted session → notice A is unreachable.
  const oldJar = { cookie: A.cookie };
  // NOTE: req() would overwrite the cookie with the new one; use fetch directly.
  const after = await fetch(`${BASE}/api/notices/${upA.id}`, { headers: { Cookie: A.cookie.split(";")[0] } });
  check("Old session's notice is gone after Start New Analysis", after.status === 404, `(got ${after.status})`);
  void oldJar;
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
