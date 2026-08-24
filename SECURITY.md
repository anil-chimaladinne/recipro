# SECURITY — SkillSwap Campus Security & Trust Model

## Security Architecture Overview

SkillSwap Campus enforces defense-in-depth across the application, API, ML, and smart contract layers.

### 1. Authentication & Authorization
- **Password Hashing**: Bcrypt with 10 salt rounds.
- **Session Tokens**: JWT signed with HS256 and minimum 32-byte secret key.
- **Cookie Security**: `HttpOnly`, `SameSite=Lax`, and `Secure` flags in production.
- **Role-Based Access Control (RBAC)**:
  - `STUDENT`: Profile, skills, sessions, credits, ratings, reports.
  - `MODERATOR`: Dispute resolution, fraud alerts queue, account restrictions.
  - `ADMIN`: Emergency pause, smart contract configuration, system health, audit logs.
- **Server-Side Enforcement**: Client role claims are never trusted; every privileged endpoint calls `requireRole` and verifies against the live database user record.

### 2. Invariant & Ledger Security
- **Atomic Credit Operations**: Credit transfers run inside SQLite transactions to eliminate race conditions and negative balances.
- **Idempotency Keys**: All state transitions require unique idempotency keys to prevent double-booking or duplicate credit releases.
- **Double Settlement Guard**: Settlement checks `settledSessions` and database state locks.

### 3. Sybil Defense & Fraud Prevention
- **Progressive Trust**: New student accounts start with limited credit transaction velocities.
- **Reciprocal Ring Detection**: Monitors mutual 5-star rating loops (A rates B, B rates A back-to-back).
- **Credit Velocity Monitoring**: Flags accounts exceeding >10 transactions within a 24-hour window.
- **Wallet Reuse Check**: Detects multiple accounts linking the same public wallet address.
- **Human Moderation Policy**: ML risk scores flag accounts into the moderator review queue; ML never automatically executes permanent account bans.

### 4. Smart Contract Security
- OpenZeppelin `Ownable`, `Pausable`, and `ReentrancyGuard` components.
- Checks-Effects-Interactions pattern on all state transitions.
- Rejection of `tx.origin` for authorization.
- Zero private user data stored on-chain.
