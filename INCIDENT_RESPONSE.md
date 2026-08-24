# INCIDENT RESPONSE — SkillSwap Campus Operations

## Incident Workflow: Detect $\rightarrow$ Contain $\rightarrow$ Recover $\rightarrow$ Verify

1. **Detect**:
   - High-risk alerts triggered by the Isolation Forest service ($\text{Risk Score} \ge 70\%$).
   - Failed transaction receipts or state discrepancies detected by the reconciliation engine.
   - User harassment or dispute reports submitted to `/api/reports`.

2. **Contain**:
   - **Emergency Escrow Pause**: Admins toggle emergency pause to freeze all pending credit transfers.
   - **Account Restriction**: Moderator flags user as `RESTRICTED` or `SUSPENDED` in `/moderator`.
   - **Fallback Activation**: If Python ML microservice or external AI API goes offline, the platform automatically switches to the built-in TypeScript deterministic matcher.

3. **Recover**:
   - Resolve disputes via `/api/moderation` with explicit refund to learner or payout to mentor.
   - Reconcile off-chain session states with blockchain transaction receipts.

4. **Verify & Postmortem**:
   - Check audit log stream (`audit_logs` table).
   - Verify zero un-reconciled transactions before lifting emergency pause.
