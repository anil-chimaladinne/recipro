# WEB3 & SMART CONTRACTS — SkillSwap Campus

## Smart Contracts Specification

### 1. `SkillCreditEscrow.sol`
- **Purpose**: Trustless on-chain escrow agreement anchor for peer learning sessions.
- **Key Invariants**:
  - `reserveEscrow(bytes32 sessionIdHash, address teacher, uint256 creditsAmount)`
  - `confirmCompletion(bytes32 sessionIdHash)`: Requires dual confirmation (learner + teacher) or authorized oracle.
  - `settleSessionByOracle(bytes32 sessionIdHash, bytes32 txProof)`
  - `refundEscrow(bytes32 sessionIdHash, string reason)`
  - `flagDispute(bytes32 sessionIdHash, string reason)`
- **Security Features**: OpenZeppelin `Ownable`, `Pausable`, `ReentrancyGuard`, checks-effects-interactions, mapping `settledSessions` prevents duplicate settlement.

### 2. `VerifiableCredentialNFT.sol`
- **Purpose**: Soulbound, non-transferrable credential certificates for campus mentors.
- **Key Invariants**:
  - `issueCredential(address recipient, string title, string skillId, string criteriaHash)`
  - `revokeCredential(uint256 tokenId, string reason)`
  - Deterministic unique milestone hashing (`keccak256(recipient + skillId + title)`).

### 3. `SkillSwapAnchor.sol`
- **Purpose**: Batched merkle root commitment anchor for auditable reputation milestones.

---

## Wallet Verification & Cryptographic Challenges
- Students prove ownership of their Ethereum address using EIP-191 personal signatures:
  $$\text{Sign}(\text{"SkillSwap Campus Challenge:\nNonce: "} + \text{nonce})$$
- The server recovers the public key using `ethers.verifyMessage` to verify authenticity.
- **Zero Private Data on Chain**: Names, emails, schedules, and messages remain securely off-chain.
