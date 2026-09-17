# LexLens — Legal Notice Intelligence (MVP)

> Any legal notice. Any language. Understood in 60 seconds.

LexLens converts legal notices (debt-collection letters, cheque-bounce notices, eviction
demands) into a plain-language, citation-verified breakdown — sender, demands, deadlines,
severity, your rights and an action plan — in **English, हिन्दी, 中文 and Français**.

Built on Next.js 16 (App Router) with a clean white production UI (Poppins for the
interface, Times New Roman serif for legal document text).

## Quick start (local VS Code)

```bash
# 1. install dependencies (bun or npm both work)
bun install        # or: npm install

# 2. run the dev server
bun run dev        # or: npm run dev

# 3. open http://localhost:3000
```

That's it — no database, no external API keys required to try the demo.

## Pages

| Route         | Purpose |
|---------------|---------|
| `/`           | Landing page — how it works, safety features, languages, coverage |
| `/analyze`    | Upload section — paste text, upload `.txt`/`.md`, or launch fictional samples |
| `/processing` | Working section — animated 9-stage pipeline, calls the analysis API |
| `/result`     | Result section — full report: severity, plain-language summary (4-language tabs), deadlines, demands, rights, action plan, citations, printable |

The three app pages pass state via `sessionStorage` (see `src/lib/lexlens/run-store.ts`),
so refreshing the processing/result page never loses your report. The interface language
(EN/HI/ZH/FR) is switchable from the navbar and persists in `localStorage`.

### How the AI engine works (two modes)

| Mode | When | Notes |
|------|------|-------|
| **LLM engine** (`glm-4.6` via `z-ai-web-dev-sdk`) | Default in the Z.ai sandbox, or locally when SDK credentials are configured | Full generative analysis, ~15–28 s |
| **Offline demo engine** (`src/lib/lexlens/fallback-analyzer.ts`) | Automatic fallback when the LLM is unreachable (timeouts, no credentials, network blocked) | Rule-based pattern matching for the supported notice families + generic mode, responds in milliseconds |

The result page shows which engine produced a report (an "Offline engine" banner appears
when the fallback was used). This is the same degradation strategy described in the TRD:
**the app never hard-fails with a network error.**

Both modes run the same post-processing safety pass:

- citation whitelist (model may only cite the versioned statute corpus in
  `src/lib/lexlens/corpus.ts`)
- deadline recomputation (`days_from_today` derived server-side)
- red-severity guard: strips any "ignore/disregard" language and injects a mandatory
  consult-a-lawyer step in all four languages
- confidence caps: auto-cap to 0.72 when no corpus citation matches; hard ceiling at 0.95
- prompt-injection defense: the notice is wrapped as untrusted data

## Project structure

```
src/
├── app/
│   ├── page.tsx                  # landing page (/)
│   ├── analyze/page.tsx          # upload page (/analyze)
│   ├── processing/page.tsx       # working page (/processing)
│   ├── result/page.tsx           # result page (/result)
│   ├── layout.tsx                # Poppins font + header/footer shell
│   ├── globals.css               # theme tokens + .font-legal (Times) + lang helpers
│   └── api/analyze/route.ts      # POST /api/analyze — LLM + fallback + safety pass
├── components/lexlens/
│   ├── site-header.tsx           # navbar with language switcher
│   ├── site-footer.tsx           # footer with disclaimer
│   ├── language-provider.tsx     # UI i18n context (EN/HI/ZH/FR)
│   ├── pipeline.tsx              # 9-stage animated pipeline visualisation
│   └── …
└── lib/lexlens/
    ├── types.ts                  # analysis schema + UI metadata
    ├── ui-i18n.ts                # interface string dictionary (4 languages)
    ├── run-store.ts              # sessionStorage draft/result passing
    ├── corpus.ts                 # 10-statute versioned mini-corpus (US/IN/ES/EU/UK)
    ├── samples.ts                # 3 fictional demo notices with dynamic dates
    └── fallback-analyzer.ts      # offline rule-based engine (4-language output)
```

## API contract

```
POST /api/analyze   { "text": "<notice text>" }
→ { analysis, processing_ms, pipeline_meta }
```

`analysis` follows the PRD's structured-output schema: `notice_type`, `jurisdiction`,
`language_detected`, `sender`, `demands[]`, `deadlines[]`, `severity`, `citations[]`,
`localized { en, hi, zh, fr }` (summary, key_risk, rights, next_steps),
`overall_confidence`.

## Demo script (for judges)

1. On `/analyze` → **Sample notices** tab → **Cheque bounce legal notice** → watch the
   9-stage pipeline on its own working page → red-severity criminal exposure, 15-day
   countdown, §138 citation with the actual statute text.
2. On the result page switch the explanation between **English / हिन्दी / 中文 / Français**
   — the whole breakdown transcreates (never literal translation).
3. Switch the **interface language** from the navbar — every page translates.
4. Try **Debt collection letter** (FDCPA 30-day validation right, NY default-judgment
   risk) or **Eviction payment demand** (LAU art. 27.2.a + LEC art. 22.2 enervación).
5. Or paste/upload any notice text of your own and hit **Analyze**.

## Disclaimer

LexLens provides **legal information, not legal advice**. Demo notices are fictional. No
attorney-client relationship is created. For decisions with legal consequences, consult a
qualified lawyer in your jurisdiction.
