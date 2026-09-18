# LexLens — Legal Notice Intelligence

> Any legal notice. Any language. Understood in 60 seconds.

LexLens converts legal notices (debt-collection letters, cheque-bounce notices, eviction
demands) into a plain-language, citation-verified breakdown — sender, demands, deadlines,
severity, your rights and an action plan — in **English, हिन्दी, 中文 and Français**.
Every analyzed notice is saved to your **private local workspace** with its report,
deadlines, evidence, reminders and a downloadable structured PDF.

Built on Next.js 16 (App Router) with a clean white production UI (Poppins for the
interface, Times New Roman serif for legal document text). **No accounts, no sign-in** —
the app runs as a single private workspace on your machine.

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

## Pages

| Route             | Purpose |
|-------------------|---------|
| `/`               | Landing page — how it works, safety features, languages, coverage |
| `/analyze`        | Upload a notice — paste text, upload **PDF / PNG / JPG / WEBP**, or launch fictional samples |
| `/processing`     | Working section — animated 9-stage pipeline while the analysis runs |
| `/dashboard`      | Personal dashboard — welcome, active deadlines with live countdowns, recent notices, quick actions |
| `/notices`        | My Notices library — every saved notice with status, deadline, days remaining, PDF download |
| `/notices/[id]`   | Full report — Action Center, exact deadline, timeline, key facts, missing information, evidence, legal basis, response draft, lawyer brief, Download Full Report PDF |
| `/notifications`  | Notification center — deadline reminders (7/3/1 days, due date, overdue), mark read |
| `/settings`       | Notification preferences — choose which reminders you receive |

Deadlines are computed by a **deterministic deadline engine** (never by the AI model):
the notice receipt date + the statutory response period gives an exact deadline date,
stored in the database. Remaining days are recalculated on every request, so countdowns
are always current. If the receipt date is unknown, the app says so — it never invents
a date.

## How the analysis engine works (two modes)

| Mode | When | Notes |
|------|------|-------|
| **LLM engine** | Default when the SDK credentials are configured | Full generative analysis, ~15–28 s |
| **Offline engine** (`src/lib/lexlens/fallback-analyzer.ts`) | Automatic fallback when the LLM is unreachable (timeouts, no credentials, network blocked) | Rule-based pattern matching for the supported notice families + generic mode, responds in milliseconds |

Both modes run the same post-processing safety pass:

- citation whitelist (the model may only cite the versioned statute corpus in
  `src/lib/lexlens/corpus.ts`)
- deadline recomputation (server-side, deterministic)
- red-severity guard: strips any "ignore/disregard" language and injects a mandatory
  consult-a-lawyer step in all four languages
- confidence caps: auto-cap when no corpus citation matches; hard ceiling at 0.95
- prompt-injection defense: the notice is wrapped as untrusted data

## Project structure

```
src/
├── app/
│   ├── page.tsx                    # landing page (/)
│   ├── analyze/page.tsx            # upload page (/analyze)
│   ├── processing/page.tsx         # working page (/processing)
│   ├── dashboard/                  # dashboard (/dashboard)
│   ├── notices/                    # notices library + report page (/notices, /notices/[id])
│   ├── notifications/page.tsx      # notification center (/notifications)
│   ├── settings/page.tsx           # notification preferences (/settings)
│   ├── layout.tsx                  # Poppins font + header/footer shell
│   ├── globals.css                 # theme tokens + .font-legal (Times) + lang helpers
│   └── api/                        # notices CRUD, analysis, PDF, evidence, draft, brief, notifications
├── components/lexlens/
│   ├── site-header.tsx             # navbar (nav links, bell, language switcher)
│   ├── case-widgets.tsx            # Action Center, Timeline, Brief view
│   ├── case-ui.tsx                 # shared report UI primitives
│   └── pipeline.tsx                # 9-stage animated pipeline visualisation
└── lib/
    ├── auth.ts                     # local workspace resolution (single private workspace)
    ├── db.ts                       # Prisma client
    └── lexlens/
        ├── deadline-engine.ts      # deterministic deadline engine (only source of deadlines)
        ├── corpus.ts               # versioned statute mini-corpus (US/IN/EU/UK)
        ├── samples.ts              # 3 fictional demo notices with dynamic dates
        ├── fallback-analyzer.ts    # offline rule-based engine (4-language output)
        └── server/                 # analysis, PDF report, notifications, deadline persistence
```

## Demo script

1. On `/analyze` → **Sample notices** tab → **Cheque bounce legal notice** → watch the
   9-stage pipeline → the report opens with red severity, the exact 15-day deadline and
   the §138 citation. Receipt date is unknown, so the deadline shows "cannot be
   calculated yet" — add the receipt date and the exact deadline appears instantly.
2. Open **Dashboard** — the notice appears under active deadlines with a live countdown
   that updates every day automatically.
3. Download the **Full Report PDF** — a structured, professionally typeset document.
4. Switch the explanation between **English / हिन्दी / 中文 / Français** — the whole
   breakdown transcreates (never literal translation). The interface language is
   switchable from the navbar and persists.
5. Try **Debt collection letter** (FDCPA 30-day validation right) or **Eviction payment
   demand**, or paste/upload any notice of your own.

## Disclaimer

LexLens provides **legal information, not legal advice**. Demo notices are fictional. No
attorney-client relationship is created. For decisions with legal consequences, consult a
qualified lawyer in your jurisdiction.
