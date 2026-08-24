# TESTING SPECIFICATION — SkillSwap Campus Test Strategy

## Test Suites

1. **Unit & Domain Tests (`npm test`)**:
   - `tests/domain.test.js`:
     - Confidence-aware Bayesian Dirichlet rating calculations (verifies 50-session mentor outranking 2-session mentor).
     - Deterministic NLP skill taxonomy extraction and confidence calculations.
     - Escrow credit reservation, state transition, and double-settlement guard.

2. **Smart Contract Tests (`npm run test:contracts`)**:
   - `scripts/test-contracts.js`:
     - EIP-191 personal sign cryptographic signature challenges with ethers.js.
     - Double-settlement and replay protection checks.
     - Soulbound credential unique hashing verification.

3. **Security Red Team Tests (`npm run test:security`)**:
   - `scripts/test-security.js`:
     - Evaluates all 30 security attack vectors: Sybil accounts, fake ratings, reciprocal loops, credit velocity, double settlement, replay, IDOR, SQL injection, NoSQL injection, XSS escaping, prompt injection, AI hallucination defense, wallet rejection, RPC outages, and CSRF protection.

## Execution Command
```bash
npm test && npm run test:contracts && npm run test:security
```
