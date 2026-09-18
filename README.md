# LexLens — Anonymous Legal Notice Analysis

> Understand any legal notice in 60 seconds. No account. Nothing saved.

LexLens converts legal notices (cheque-dishonour demand notices, debt-collection
letters, payment demands) into a plain-language, citation-verified breakdown —
sender, demands, deterministically calculated deadlines, severity, legal
conditions and an action plan — in **English and हिन्दी**. Download the result
as a structured PDF and finish. There is no history by design.

Built on Next.js 16 (App Router) with a clean white production UI (Poppins for
the interface, Times New Roman serif for legal document text).

## Anonymous session model (no accounts)

- **No login, no signup, no profiles, no history.** You open LexLens and analyze a notice.
- A cryptographically random session token (HttpOnly cookie) associates the
  current browser with temporary processing resources. The database stores only
  a SHA-256 hash of the token.
- Every temporary resource (uploaded document, OCR text, analysis result,
  evidence, draft, brief, PDF) is scoped to the session and verified
  **server-side** — one anonymous session can never access another session's
  data (foreign IDs return a privacy-preserving 404).
- Everything expires automatically (24-hour sliding TTL) via a cleanup sweep;
  uploaded files are removed together with their records.
- "Start New Analysis" on the report force-expires the current session and
  issues a fresh one — nothing carries over.

## Quick start (local VS Code)

```bash
# 1. install dependencies (npm or bun both work)
npm install

# 2. create the environment file
cp .env.example .env        # Windows: copy .env.example .env

# 3. create / update the local SQLite database
npm run db:push

# 4. run the dev server
npm run dev

# 5. open http://localhost:3000
```

Environment variables (see `.env.example`):

| Variable       | Required | Purpose                                                        |
|----------------|----------|----------------------------------------------------------------|
| `DATABASE_URL` | yes      | SQLite database file, e.g. `file:./db/custom.db`              |
| SDK credentials| optional | When the Z.ai SDK credentials are present in the environment the LLM engine is used; otherwise the app automatically falls back to the built-in offline engine and never hard-fails |

## Flow

| Route             | Purpose |
|-------------------|---------|
| `/`               | Landing — Understand Any Legal Notice in 60 Seconds |
| `/analyze`        | Upload a notice — paste text, upload **PDF / PNG / JPG / WEBP**, or launch fictional samples; optional jurisdiction hint |
| `/processing`     | Working — animated pipeline while the analysis runs |
| `/notices/[id]`   | Report — jurisdiction, classification, deadline, Action Center, timeline, key facts, missing information, evidence, legal basis, consequences, response draft, lawyer brief, **Download Full Report PDF**, **Start New Analysis** |

## Legal engine (safety-critical design)

- **Jurisdiction detection** (`src/lib/lexlens/jurisdiction.ts`): multi-signal
  detection → `INDIA` | `USA` | `UNKNOWN`. Conflicting or insufficient evidence
  is never guessed: UNKNOWN cases run no substantive rule pack until the user
  confirms the country.
- **Jurisdiction firewall** (`src/lib/lexlens/validator.ts` + `corpus.ts`):
  every legal claim carries a jurisdiction; claims from an incompatible legal
  system are REJECTED server-side before they can reach a report. India cases
  can never load FDCPA/US sources; US cases can never load the NI Act.
- **Rule packs**: `INDIA:cheque_bounce` (NI Act §138 — the recipient's
  15-day payment window runs from RECEIPT of the demand notice; the 30-day
  period belongs to the payee and is never shown as a "dispute window") and
  `USA:debt_collection` (FDCPA §1692g 30-day validation window, loaded only
  when federal applicability is established from the facts). US state law is
  scoped to the detected state and never guessed.
- **Deterministic deadline engine** (`deadline-engine.ts`): the LLM never
  computes a deadline. `calculateStatutoryDeadline({ ruleId, triggerDate,
  jurisdiction, statutoryPeriod })` returns `MISSING_REQUIRED_FACT` when the
  trigger date is unknown — nothing is invented. Date counting is calendar-day
  addition in UTC (`addDaysISO`), documented and covered by tests.
- **Canonical case facts** (`server/notices.ts`): one source of truth for
  dates/amounts consumed by the deadline engine, timeline, drafts, briefs and
  PDF. A receipt-date consistency gate refuses to render a contradictory report.
- **Languages**: English + Hindi only. Legal facts are language-neutral; only
  presentation changes. Unsupported notice languages are disclosed, never
  silently analyzed as if fully supported.

## Tests

```bash
bun run scripts/test-engine.ts        # deadline engine, jurisdiction detection, firewall, classification (38)
bun run scripts/test-cleanup.ts       # TTL expiry sweep (7)
node scripts/test-privacy.mjs         # anonymous session isolation matrix (27)   [dev server running]
node scripts/test-regression.mjs      # India §138 / US NY / Hindi / missing-date regressions (49) [dev server running]
```

## Disclaimer

LexLens provides **legal information, not legal advice**. Demo notices are
fictional. No attorney-client relationship is created. For decisions with legal
consequences, consult a qualified lawyer in your jurisdiction.
