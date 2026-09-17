# LexLens — Legal Notice Intelligence (MVP)

> Any legal notice. Any language. Understood in 60 seconds.

LexLens converts legal notices (debt-collection letters, cheque-bounce notices, eviction
demands) into a plain-language, citation-verified breakdown — sender, demands, deadlines,
severity, your rights and an action plan — in **English, Hindi or Spanish**.

Built from the LexLens PRD/TRD as a hackathon-demo MVP on Next.js 16 (App Router).

## Quick start (local VS Code)

```bash
# 1. install dependencies (bun or npm both work)
bun install        # or: npm install

# 2. run the dev server
bun run dev        # or: npm run dev

# 3. open http://localhost:3000
```

That's it — no database, no external API keys required to try the demo.

### How the AI engine works (two modes)

| Mode | When | Notes |
|------|------|-------|
| **LLM engine** (`glm-4.6` via `z-ai-web-dev-sdk`) | Default in the Z.ai sandbox, or locally when SDK credentials are configured | Full generative analysis, ~15–30 s |
| **Offline demo engine** (`src/lib/lexlens/fallback-analyzer.ts`) | Automatic fallback when the LLM is unreachable (timeouts, no credentials, network blocked) | Rule-based pattern matching for the three supported notice families + generic mode, responds in milliseconds |

The UI shows which engine produced a result in the pipeline-meta footer
(`offline engine (LLM unreachable)` tag when the fallback is used). This is the same
degradation strategy described in the TRD: **the demo never hard-fails.**

Both modes run the same post-processing safety pass:

- citation whitelist (model may only cite the versioned statute corpus in
  `src/lib/lexlens/corpus.ts`)
- deadline recomputation (`days_from_today` derived server-side)
- red-severity guard: strips any "ignore/disregard" language and injects a mandatory
  consult-a-lawyer step in all three languages
- confidence auto-cap to 0.72 when no corpus citation matches → triggers the
  "consult a lawyer" banner

## Project structure

```
src/
├── app/
│   ├── page.tsx                  # single-page app (navbar, hero, demo, results)
│   ├── layout.tsx                # fonts + metadata
│   ├── globals.css               # theme tokens + custom styles
│   └── api/analyze/route.ts      # POST /api/analyze — LLM + fallback + safety pass
├── components/lexlens/
│   ├── pipeline.tsx              # 9-stage animated pipeline visualisation
│   └── result.tsx                # result dashboard (severity, deadlines, rights, i18n)
└── lib/lexlens/
    ├── types.ts                  # analysis schema + UI metadata
    ├── corpus.ts                 # 10-statute versioned mini-corpus (US/IN/ES/EU/UK)
    ├── samples.ts                # 3 fictional demo notices with dynamic dates
    └── fallback-analyzer.ts      # offline rule-based engine (local VS Code mode)
```

## API contract

```
POST /api/analyze   { "text": "<notice text>" }
→ { analysis, processing_ms, pipeline_meta }
```

`analysis` follows the PRD's structured-output schema: `notice_type`, `jurisdiction`,
`language_detected`, `sender`, `demands[]`, `deadlines[]`, `severity`, `citations[]`,
`localized { en, hi, es }` (summary, key_risk, rights, next_steps), `overall_confidence`.

## Demo script (for judges)

1. Click **"Debt collection letter"** → watch the 10-stage pipeline → severity, 30-day
   FDCPA validation right, $2,340.55 demand, corpus citations.
2. Switch the summary to **हिन्दी** and **Español** — the whole breakdown transcreates.
3. Click **"Cheque bounce legal notice"** → red-severity criminal exposure, mandatory
   lawyer step, §138 citation with the actual statute text.
4. Paste any notice text of your own and hit **Analyze**.

## Disclaimer

LexLens provides **legal information, not legal advice**. Demo notices are fictional. No
attorney-client relationship is created. For decisions with legal consequences, consult a
qualified lawyer in your jurisdiction.
