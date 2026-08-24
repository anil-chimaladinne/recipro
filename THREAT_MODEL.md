# THREAT MODEL — SkillSwap Campus STRIDE Analysis

| Threat (STRIDE) | Vector / Risk | Mitigation & Defense |
| :--- | :--- | :--- |
| **Spoofing** | Attacker claims someone else's Ethereum wallet address | Cryptographic challenge nonce signed with `personal_sign` and verified via `ethers.verifyMessage` |
| **Tampering** | User modifies session state to settle credits without completion | Server-side state machine validates valid state transitions and requires mutual confirmation |
| **Repudiation** | Mentor denies receiving credits or conducting session | On-chain settlement transaction hashes and immutable audit logs record all actions |
| **Information Disclosure** | Private student schedules or messages exposed on blockchain | Strict off-chain storage for private data; only cryptographic hashes and credentials stored on-chain |
| **Denial of Service** | Bot flooding search API or booking requests | Input length limits in Zod schemas, rate limits, and maximum daily session caps |
| **Elevation of Privilege** | Student attempts moderator or admin actions | Server-side `requireRole(['MODERATOR', 'ADMIN'])` validates authenticated user role against DB |
| **Sybil Rating Farming** | Two fake accounts trade 5-star reviews to inflate reputation | Isolation Forest & Reciprocity Index flags circular rating patterns for campus moderation |
| **Prompt Injection** | Malicious text in skill submission tries to hijack AI system | Untrusted user data is strictly separated in the system prompt with JSON response schemas |
