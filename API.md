# API SPECIFICATION — SkillSwap Campus REST Endpoints

## Authentication & Identity
- `POST /api/auth/register` — Register student account with 3 Starter Skill Credits.
- `POST /api/auth/login` — Authenticate and receive signed JWT session token.
- `GET /api/auth/me` — Retrieve active authenticated user profile, skills, goals, and credit balance.
- `POST /api/auth/logout` — Invalidate session and clear auth cookies.

## Search & Discovery
- `GET /api/search?q={query}&mode={ALL|MODE_A|MODE_B|MODE_C}&skillCategory={cat}&minProficiency={lvl}&dayOfWeek={day}&verifiedOnly={bool}&minRating={rating}`
  - Returns `modeA_knownPerson` (exact identity matches), `modeB_skillMatches` (ML ranked candidates with score and explainability breakdown), and `modeC_exchangeCycles` (directed barter loops).

## Skills & AI Analyzer
- `GET /api/skills` — List skills master catalog.
- `POST /api/skills` — Add teaching skill to student profile.
- `POST /api/skills/extract` — AI & NLP Skill Extractor from freeform text with confidence scores.
- `GET /api/goals` / `POST /api/goals` — Manage student learning goals.
- `GET /api/availability` / `POST /api/availability` — Manage weekly availability timeslots.

## Sessions & Escrow State Machine
- `GET /api/sessions` — List student active, upcoming, and completed sessions.
- `POST /api/sessions` — Book 1-on-1 session and reserve 1 Skill Credit in escrow.
- `POST /api/sessions/:id/action` — Execute state transition (`ACCEPT`, `START`, `CONFIRM_COMPLETION`, `CANCEL`, `DISPUTE`).

## Ratings, Trust & Credentials
- `POST /api/ratings` — Submit peer review, calculate Bayesian trust update, and scan for Sybil loops.
- `GET /api/credentials` — List earned verifiable certificates and soulbound NFT badges.

## Web3 & Wallet
- `GET /api/wallet` — Retrieve linked wallet status, challenge nonce, and reconciliation report.
- `POST /api/wallet` — Link EVM wallet address with cryptographic signature proof.

## StudySphere Campus Hub
- `GET /api/studysphere` — List study circles, course notes/resources, and flashcard decks.
- `POST /api/studysphere` — Join study circle, upvote resource, create group, get deck cards, and update card mastery.
- `POST /api/ai/study-coach` — Generate modular learning roadmap with verified mentor recommendations.

## Moderation & Administration
- `GET /api/moderation` — Retrieve ML fraud queue, open disputes, reports, and audit logs.
- `POST /api/moderation` — Execute moderator action (`CLEAR_ALERT`, `SUSPEND_USER`, `RESOLVE_REFUND`, `RESOLVE_PAYOUT`).
- `GET /api/admin/system` — System observability, database WAL stats, and blockchain contract health.
