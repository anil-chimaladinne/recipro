# SKILLSWAP CAMPUS — Implementation Map & Architecture Blueprint

**Project Tagline**: *"Students exchange skills instead of money."*  
**Date**: August 2026  
**Status**: In Progress — Phase 0 Complete, Proceeding to Full Implementation

---

## 1. Executive Summary & Repository Audit

### 1.1 Repository State
- **Initial Workspace State**: Clean slate repository.
- **Runtime Environment**: 
  - Node.js `v22.19.0`, npm `10.9.3`
  - Python `3.13.7`, pip `25.2`
  - Git `2.49.0.windows.1`
  - Windows x64 OS

### 1.2 Architecture Selection & Rationale
To guarantee a production-grade, zero-failure, judge-ready campus platform with real ML, genuine Web3/Solidity smart contracts, deterministic discovery, and rich campus tools, we establish a **Modern Full-Stack Hybrid Architecture**:

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

---

## 2. Core Subsystems & Technical Specifications

### 2.1 Three-Mode Discovery Engine
1. **Mode A — Known Person (Deterministic Exact Identity Match)**:
   - Queries matching username, display name, student ID, or exact handle bypass ML ranking and are pinned at the top.
   - Preserves instant exact lookup without algorithmic dilution.
2. **Mode B — Known Skill, Unknown Person (Deterministic Constraint -> ML Candidate Ranking)**:
   - **Stage 1 (Hard Filters)**: Teaching capability, availability slot intersection, campus verification, minimum trust threshold, session mode (online/in-person).
   - **Stage 2 (ML Feature Scoring)**: 30% Skill match + 20% Schedule overlap + 15% Proficiency compatibility + 10% Goal alignment + 10% Reliability + 10% Bayesian Reputation + 5% Teaching style.
   - **Stage 3 (Explainability)**: Generates human-verifiable match reasons and confidence breakdown.
3. **Mode C — Multi-Person Network Exchange (Graph Cycle Discovery)**:
   - Constructs directed graphs of unmet requests vs available teaching capabilities.
   - Finds cyclic barter paths of length 2, 3, or 4 (e.g., $A \xrightarrow{\text{teaches Python}} B \xrightarrow{\text{teaches UI/UX}} C \xrightarrow{\text{teaches Solidity}} A$).
   - Explicit user opt-in with scheduled feasibility verification.

### 2.2 Skill Credits & Escrow State Machine
- **Rule**: 1 verified teaching hour = 1 Skill Credit; 1 learning hour = 1 Skill Credit.
- **State Machine**:
  $$\text{REQUESTED} \rightarrow \text{ACCEPTED} \rightarrow \text{SCHEDULED} \rightarrow \text{IN\_PROGRESS} \rightarrow \text{PENDING\_CONFIRMATION} \rightarrow \text{COMPLETED} \rightarrow \text{CREDIT\_SETTLED}$$
  *(Alternative branch: $\text{DISPUTED} \rightarrow \text{UNDER\_REVIEW} \rightarrow \text{RESOLVED / CANCELLED}$)*
- **Integrity**: Idempotency keys on all state transfers, double-settlement guard locks, atomic credit ledger entries.

### 2.3 Web3 & Smart Contracts
- **Solidity Smart Contracts**:
  - `SkillCreditEscrow.sol`: Escrows credit authorization hashes, multi-sig completion, automated refund on timeout.
  - `VerifiableCredentialNFT.sol`: Mints soulbound verifiable credential tokens upon deterministic milestone attainment.
  - `SkillSwapAnchor.sol`: Anchor state proofs to EVM chain.
- **No-Fake Policy**: Real ethers.js cryptographic signing, EIP-712/EIP-191 personal signature challenges for wallet linking, real contract bytecode, and explicit testnet / dev-node / simulated ledger reconciliation.

### 2.4 Fraud & Sybil Defense
- **Signals**: Rating reciprocity loops, burst frequency, credit circular velocity, wallet address clustering, account age vs session volume, cancellation rate spikes.
- **ML Anomaly Detection**: Isolation Forest model scoring (Low / Medium / High Risk).
- **Moderator Workflow**: Explanations presented to campus moderators; no automated punitive bans solely from ML scores.

### 2.5 StudySphere Campus Features Integration
- **Study Groups**: Create, join, search campus study circles with scheduled study sessions.
- **Resource Repository**: Notes, past papers, cheat sheets, code snippets with file validation & tags.
- **Flashcards & Quizzes**: Active recall flashcard system with progress tracking.
- **AI Study Coach**: Step-by-step roadmap generator backed by verifiable real-mentor query matching.

---

## 3. Database Schema Blueprint

```sql
-- Core Entities
Users (id, email, password_hash, role, status, campus_id, created_at, updated_at)
Profiles (id, user_id, display_name, avatar, bio, college, major, year, trust_score, completion_rate, hourly_rate_credits, privacy_settings)
Skills (id, name, category, icon, description, is_verified)
UserSkills (id, user_id, skill_id, proficiency, experience_years, teaching_style, verification_status, evidence_url)
LearningGoals (id, user_id, skill_id, target_proficiency, notes, priority)
AvailabilitySlots (id, user_id, day_of_week, start_time, end_time, timezone)

-- Sessions & Credits
Sessions (id, title, skill_id, teacher_id, learner_id, status, scheduled_start, scheduled_end, duration_hours, credits_amount, idempotency_key, meeting_url, notes)
SkillCreditAccounts (id, user_id, balance, escrow_balance, lifetime_earned, lifetime_spent)
CreditTransactions (id, reference_session_id, sender_id, receiver_id, amount, transaction_type, status, idempotency_key, on_chain_tx_hash)

-- Reputation & Credentials
Ratings (id, session_id, rater_id, ratee_id, score, review, skills_demonstrated, flagged_suspicious)
Reputations (id, user_id, total_reviews, bayesian_rating, reliability_score, teaching_score)
Credentials (id, user_id, title, badge_type, skill_id, token_id, tx_hash, criteria_met, issued_at)

-- Moderation, Security & Social
CampusVerifications (id, user_id, student_email, document_url, status, verified_at)
Reports (id, reporter_id, reported_id, session_id, reason, details, status, resolution_notes)
Disputes (id, session_id, initiator_id, reason, status, evidence_url, moderator_id, resolution)
FraudAlerts (id, user_id, risk_score, risk_level, anomaly_reasons, status, reviewed_by)
AuditLogs (id, actor_id, action, target_type, target_id, previous_state, new_state, ip_address, timestamp)
Notifications (id, user_id, title, message, type, link, is_read, created_at)
Wallets (id, user_id, address, chain_id, signature_proof, is_verified, linked_at)

-- StudySphere Features
StudyGroups (id, name, description, subject, creator_id, meeting_schedule, max_members)
StudyGroupMembers (id, group_id, user_id, role, joined_at)
StudyResources (id, title, description, subject, author_id, resource_type, file_url, upvotes)
FlashcardDecks (id, user_id, title, subject, cards_count, is_public)
Flashcards (id, deck_id, front, back, mastery_level)
```

---

## 4. Phased Implementation Roadmap

1. **Phase 1**: Full Stack Core Setup (Next.js 14+ App Router, Tailwind & Custom Glassmorphism Theme, Database ORM & Migrations, Authentication & Session Guards).
2. **Phase 2**: Comprehensive Seed Data & Domain Models (25+ realistic students, cross-campus skills, availability, pre-existing sessions, trust metrics).
3. **Phase 3**: Discovery & 3-Mode Search Engine (Exact Known-Person lookup, Known-Skill filter + ML scoring, Network Exchange Graph Cycle Finder).
4. **Phase 4**: AI Skill Analyzer & ML Recommendation Service (Skill parser with confidence + deterministic fallback, explainable match engine).
5. **Phase 5**: Session Lifecycle, Escrow Ledger & State Machine (Strict state transitions, credit reservation, completion, dispute resolution).
6. **Phase 6**: Web3 / Smart Contract Suite (Solidity contracts, Hardhat test suite, EIP-712/191 signature wallet verification, transaction reconciliation).
7. **Phase 7**: Reputation, Ratings & Verifiable Credentials (Bayesian trust calculations, rating loop anomaly defense, verifiable certificates).
8. **Phase 8**: Fraud & Sybil Defense Engine (Multi-signal risk score, Isolation Forest / heuristic rules, Moderator Review Dashboard).
9. **Phase 9**: StudySphere Campus Suite (Study Groups, Resource Repository, Flashcards, AI Study Coach Roadmap).
10. **Phase 10**: Security Hardening, Audit Logs, Rate Limiting & Error Boundaries.
11. **Phase 11**: Automated Unit, Contract, ML, Chaos & Red Team Tests.
12. **Phase 12**: Documentation, Verification Map & Final Polish.
