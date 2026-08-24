# MACHINE LEARNING & INTELLIGENCE — SkillSwap Campus

## 1. Hybrid Candidate Match Engine

### Architecture
$$\text{Search Query} \rightarrow \text{Deterministic Hard Constraints} \rightarrow \text{Candidate Set} \rightarrow \text{Feature Scoring} \rightarrow \text{Explainable Ranking}$$

### Configurable Feature Weights
- **30% Skill Compatibility**: Proficiency rank (Beginner to Expert), experience years, verification status.
- **20% Availability Overlap**: Jaccard intersection of weekly day/time availability windows.
- **15% Proficiency Gap Alignment**: Harmony between mentor capability and learner target level.
- **10% Learning Goal Reciprocity**: Shared academic interests or mutual goal alignment.
- **10% Reliability Score**: Historical completion rate and punctuality factor.
- **10% Bayesian Reputation**: Confidence-adjusted rating score.
- **5% Teaching Style Compatibility**: Match between hands-on vs theoretical preferences.

### Explainability Engine
Every match score (0-100%) produces verifiable bullet points:
- `✓ Python expertise (Advanced level, 3.5 yrs)`
- `✓ Schedule overlap on Tue/Thu 6-8PM`
- `✓ Strong verified teaching history (4.9⭐ / 27 sessions)`

---

## 2. Fraud & Sybil Defense (Isolation Forest + Rules)

### Feature Vectors
1. **Reciprocity Index**: Ratio of ratings exchanged in closed 2-party loops.
2. **Rating Concentration**: % of total reviews originating from the top counterparty.
3. **Daily Session Velocity**: Number of sessions completed per account age day.
4. **Credit Velocity**: Number of credit transfer operations within the last 24 hours.
5. **Wallet Address Reuse**: Frequency of the same Ethereum public key across multiple student accounts.
6. **Cancellation Rate**: % of booked sessions cancelled after credit reservation.

### Decision Workflow
- Scores are classified into **LOW (<40%)**, **MEDIUM (40-69%)**, or **HIGH (&ge;70%) Risk**.
- High and medium risk alerts enter the `/moderator` queue with full signal explanations.
- Human moderators make final decisions; ML does not perform automatic irreversible account bans.

---

## 3. Multi-Person Network Exchange Engine (Cycle Discovery)
- Constructs a directed barter graph $G = (V, E)$ where an edge $(A, B)$ exists if student $A$ can teach a skill desired by student $B$.
- Uses Johnson's / Tarjan's cycle finding algorithm to detect simple cycles of length 2, 3, or 4 ($A \rightarrow B \rightarrow C \rightarrow A$).
- Evaluates feasibility based on mutual availability and participant trust metrics.
