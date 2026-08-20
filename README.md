# JSON-Driven Resume Builder

A pixel-faithful, fully JSON-driven reproduction of an A4 resume template with a
single-page constraint engine and a bulletproof `@media print` pipeline.

## Run

```bash
npm install
npm run dev:all   # frontend (5173) + agent backend (8788)
# or separately: npm run dev   /   npm run server
```

Architecture: React + Firebase (Auth, Firestore storage) on the client; a **Node
+ Express tailoring-agent** backend for AI. The client PDF→JSON upload still uses
Firebase AI Logic; résumé *tailoring* now goes through the agent. See
**Firebase setup** and **Tailoring agent (backend)** below.

## How it works

- **`src/data/restrictions.json`** — the reverse-engineered design system + layout
  tolerances (colors→Tailwind, font pairing, type/spacing scales, column layout,
  and per-section character / bullet / row limits that keep the sheet on one A4 page).
- **`src/data/profiles/*.json`** — content profiles. `atharva` is extracted from the
  source PDF and satisfies every rule; `priya` is a clean second profile; `overflow-demo`
  deliberately breaches constraints to exercise the validator.
- **`src/utils/validation.js`** — checks a profile against `restrictions.json` and returns
  path-keyed flags (bold `**...**` markup is stripped before counting).
- **`src/components/ResumeCanvas.jsx`** — the render tree. Section order, column placement,
  labels, and styling all come from `restrictions.json`; content comes from the profile.
- **`src/index.css`** — Tailwind layers + the A4 print engine (`@page { size: A4; margin: 0 }`,
  hides sidebar/toolbar/warnings, hard-locks the sheet to 210×297mm with zero bleed).

## Print

Click **Print / Save PDF** (or Ctrl/Cmd-P). Sidebar, toolbar, and all validation
indicators are stripped; the sheet renders as exactly one A4 portrait page.

## Firebase (auth + storage + AI)

The app is fully serverless. Everything is wired in `src/firebase.js`:

- **Authentication** — Google sign-in. The app is gated behind sign-in; nothing
  loads until a user authenticates.
- **Firestore** — each resume is a document in the `resumes` collection carrying
  the owner's `uid`. All reads are filtered by the signed-in `uid`, and
  `firestore.rules` enforces that a user can only ever read/write their own
  documents — so a user only sees their own resumes.
- **Firebase AI Logic** (`firebase/ai`) — Gemini is called directly from the
  browser with no exposed API key.

### One-time Firebase console setup

1. **Authentication → Sign-in method** → enable **Google**.
2. **Firestore Database** → create it (production mode is fine — rules below lock it).
3. **Build → AI Logic** → **enable** it (Gemini Developer API backend).
4. Deploy the security rules:
   ```bash
   firebase deploy --only firestore:rules   # uses firestore.rules
   ```
   (`localhost` is already an authorized auth domain by default.)

Then `npm run dev`, sign in, add a resume from a template, and use **Tailor with Gemini**.

## Tailoring agent (backend)

Pick a **base résumé**, paste a **job description**, and the **Express agent**
re-emphasises your *real* experience for that role — **without inventing or
exaggerating anything** — then shows a **JD-fit score**, coverage, and a change
log. It optimises for relevance by running distinct reasoning stages instead of
one monolithic call:

```
server/
  index.js               # Express: /api/health, /api/quota, /api/tailor
  config.js              # task-routed models + agent knobs (server/.env)
  llm/gemini.js          # Gemini client: fallback chain, JSON repair, thinking control
  agent/tailorAgent.js   # the pipeline (below)
  prompts/agentPrompts.js# JD-parse, critique, and improve prompts
  auth/                  # Firebase ID-token verification (Admin SDK)
  quota.js               # airtight server-side daily limit (Admin Firestore)
# reuses from src/: resumeCustomization.js (prompt), integrityGuards.js, validation.js, restrictions.json
```

**Agent pipeline** (`agent/tailorAgent.js`):
1. **parse** — turn the JD into structured requirements *(cheap model)*
2. **tailor** — rewrite toward those requirements *(strong model)*
3. **guard + validate** — deterministic integrity guards + restriction checks
4. **critique** — an LLM reviewer scores fit/quality and lists concrete fixes
5. **improve** — apply the fixes; re-guard/validate/critique; keep the best draft

**Truthfulness** is still defense-in-depth: the governing prompt (HARD vs FLEXIBLE
rules), deterministic guards (identity/education/dates locked; skills policy), and
restriction validation — now reinforced by the critique stage rejecting unsupported
claims.

### Backend setup

```bash
cp server/.env.example server/.env    # set GEMINI_API_KEY (from Google AI Studio)
npm run dev:all
```

- `GEMINI_API_KEY` is **server-held** (never shipped to the browser).
- Auth: the client sends its Firebase ID token; the server verifies it (Admin SDK,
  works with just the project id). `AUTH_DISABLED=true` bypasses it for local dev.
- Model routing via `GEMINI_TAILOR_MODEL` / `GEMINI_PARSE_MODEL` / `GEMINI_CRITIQUE_MODEL`;
  agent behaviour via `AGENT_TARGET_SCORE`, `AGENT_MAX_IMPROVES`.

### Daily tailor limit (now airtight, server-side)

The limit is enforced **inside the backend** (`/api/tailor` reserves before the
run, refunds on failure) via **Admin Firestore** — the client can no longer
bypass it. Enable it by pointing `GOOGLE_APPLICATION_CREDENTIALS` at a service-
account JSON; without credentials the server runs but leaves the quota
unenforced (dev). Default is **1/day**; raise it per user with a
`userLimits/{uid}` doc `{ dailyTailorLimit: N }`, or change the default in
`server/quota.js`. `firestore.rules` remains a second guard on the stored count.
