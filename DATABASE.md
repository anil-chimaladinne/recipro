# DATABASE SCHEMA — SkillSwap Campus

## Relational Entity Model (SQLite WAL Mode)

```sql
-- 1. Users & Authentication
users (id, email, password_hash, role, status, campus_id, created_at, updated_at)

-- 2. Profiles
profiles (id, user_id, display_name, avatar, bio, college, major, year, is_verified_student, trust_score, completion_rate, cancellation_rate, hourly_rate_credits, teaching_style, languages, profile_visibility, ml_consent)

-- 3. Skills & Capabilities
skills (id, name, category, icon, description, is_verified)
user_skills (id, user_id, skill_id, proficiency, experience_years, teaching_style, verification_status, evidence_url)
learning_goals (id, user_id, skill_id, target_proficiency, priority, notes)
availability_slots (id, user_id, day_of_week, start_time, end_time, timezone)

-- 4. Sessions & Credits Escrow
sessions (id, title, skill_id, teacher_id, learner_id, status, scheduled_start, scheduled_end, duration_hours, credits_amount, mode, location_or_url, learner_confirmed, teacher_confirmed, idempotency_key, notes, cancellation_reason)
skill_credit_accounts (id, user_id, balance, escrow_balance, lifetime_earned, lifetime_spent)
credit_transactions (id, reference_session_id, sender_id, receiver_id, amount, transaction_type, status, idempotency_key, on_chain_tx_hash)

-- 5. Ratings, Trust & Credentials
ratings (id, session_id, rater_id, ratee_id, score, review, punctuality_score, clarity_score, skills_demonstrated, flagged_suspicious)
reputations (id, user_id, total_reviews, total_sessions_taught, total_sessions_learned, bayesian_rating, reliability_score, teaching_score, reciprocal_rating_ratio)
credentials (id, user_id, title, badge_type, skill_id, token_id, tx_hash, criteria_met, is_revoked, issued_at)

-- 6. Moderation, Audit & Social
reports (id, reporter_id, reported_id, session_id, reason, details, status, resolution_notes, moderator_id)
disputes (id, session_id, initiator_id, reason, status, evidence_url, moderator_id, resolution_notes)
fraud_alerts (id, user_id, risk_score, risk_level, anomaly_reasons, status, reviewed_by, review_notes)
audit_logs (id, actor_id, action, target_type, target_id, previous_state, new_state, ip_address, user_agent)
notifications (id, user_id, title, message, type, link, is_read)
wallets (id, user_id, address, chain_id, signature_proof, is_verified, linked_at)
blockchain_transactions (id, reference_type, reference_id, chain_id, contract_address, tx_hash, status, block_number, payload_json)

-- 7. StudySphere Suite
study_groups (id, name, description, subject, creator_id, meeting_schedule, max_members)
study_group_members (id, group_id, user_id, role, joined_at)
study_resources (id, title, description, subject, author_id, resource_type, file_url, upvotes)
flashcard_decks (id, user_id, title, subject, cards_count, is_public)
flashcards (id, deck_id, front, back, mastery_level)
exchange_proposals (id, cycle_hash, participants_json, skills_flow_json, status, accepted_users_json, expires_at)
```
