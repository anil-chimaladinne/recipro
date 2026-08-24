# ARCHITECTURE — SkillSwap Campus System Design

```
+----------------------------------------------------------------------------------------------------+
|                                    SKILLSWAP CAMPUS PLATFORM                                       |
+----------------------------------------------------------------------------------------------------+
|  [ Modern Next.js 14+ App Router & Rich Responsive Glassmorphic UI / Tailwind & Vanilla CSS ]      |
|  - Student Hub | Explore (Mode A/B/C) | Live Session & Chat | Skill Graph | AI Study Coach         |
|  - Skill Credits Escrow | Verifiable Credentials | Moderator Hub | Admin & Audit Dashboard         |
+----------------------------------------------------------------------------------------------------+
                                      |                       |
                                      v                       v
+-------------------------------------------------+  +-----------------------------------------------+
|      Next.js REST API & State Engines           |  |           Python ML & Graph Service           |
|  - Role-based Auth (Student/Moderator/Admin)    |  |  (FastAPI / Scikit-Learn / NetworkX)          |
|  - Strict Zod Input Validation & Rate Limiting  |  |  - Isolation Forest Fraud & Sybil Detector    |
|  - Deterministic Search & Known-Person Priority |  |  - Multi-Person Exchange Cycle Discovery      |
|  - Session Lifecycle & Escrow State Machine     |  |  - Hybrid Vector Matching & Explanations      |
|  - Cryptographic Wallet Challenge-Response      |  |  - Fallback: Built-in TypeScript ML Engine    |
+-------------------------------------------------+  +-----------------------------------------------+
                 |                                                           |
                 v                                                           v
+-------------------------------------------------+  +-----------------------------------------------+
|         Relational Persistence Layer            |  |             Web3 & Smart Contracts            |
|       (SQLite / Prisma / Better-SQLite3)        |  |          (Solidity ^0.8.20 / Hardhat)         |
|  - Users, Profiles, Skills, Goals, Availability |  |  - SkillCreditEscrow.sol (Pausable, Lock)     |
|  - Sessions, Ledger, Ratings, Credentials       |  |  - VerifiableCredentialNFT.sol (ERC721/1155)  |
|  - Study Groups, Notes, Flashcards, Disputes    |  |  - SkillSwapAnchor.sol (Merkle Root Anchors)  |
|  - FraudAlerts, AuditLogs, Notifications        |  |  - Dual Mode: Testnet RPC + Ethers/Demo Mode  |
+-------------------------------------------------+  +-----------------------------------------------+
```

## Architectural Principles

1. **Deterministic Search & ML Ranking Hierarchy**:
   - Mode A (Known Person) matches are resolved with exact SQL identity queries and pinned at the top.
   - Mode B candidates pass deterministic availability and skill capability constraints before being vector-ranked.
   - ML ranking is strictly explainable with clear factor weightings.

2. **Session State Machine & Credit Escrow**:
   - `REQUESTED` $\rightarrow$ `ACCEPTED` $\rightarrow$ `SCHEDULED` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `PENDING_CONFIRMATION` $\rightarrow$ `COMPLETED` $\rightarrow$ `CREDIT_SETTLED`.
   - Credit escrow reservations are ACID locked within SQLite transactions.
   - Double settlement and replay attacks are prevented using unique session hashes and idempotency keys.

3. **Web3 Verifiability & Privacy Boundary**:
   - On-chain: Settlement proofs, credential token mints, merkle root anchors.
   - Off-chain: Names, emails, chats, schedules, private notes.
   - Cryptographic wallet ownership is validated via ECDSA signatures (`personal_sign`).

4. **Zero-Downtime Resilience**:
   - Built-in TypeScript fallback engines guarantee full search, matching, and fraud risk functionality even if Python or external AI APIs are unreachable.
