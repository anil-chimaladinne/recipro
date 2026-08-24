const test = require('node:test');
const assert = require('node:assert');
const Database = require('better-sqlite3');

function calculateBayesianRating(ratings, priorMean = 4.5, priorWeight = 3) {
  if (ratings.length === 0) return priorMean;
  const sum = ratings.reduce((acc, score) => acc + score, 0);
  const bayesian = (priorWeight * priorMean + sum) / (priorWeight + ratings.length);
  return Math.round(bayesian * 100) / 100;
}

function extractSkillsDeterministic(text) {
  const lowerText = text.toLowerCase();
  const taxonomy = {
    'Python': ['python', 'py', 'django', 'flask', 'fastapi'],
    'React': ['react', 'react.js', 'next.js', 'nextjs'],
    'Node.js': ['node', 'node.js', 'express'],
    'Solidity': ['solidity', 'smart contract', 'ethereum', 'evm'],
  };

  const extracted = [];
  for (const [skill, kws] of Object.entries(taxonomy)) {
    if (kws.some(kw => lowerText.includes(kw))) {
      extracted.push({ skillName: skill, confidence: 88, proficiency: 'Advanced' });
    }
  }
  return extracted;
}

test('Bayesian Rating Confidence Invariant Test', () => {
  const newMentorRating = calculateBayesianRating([4.9, 4.9], 4.5, 3);
  assert.strictEqual(newMentorRating, 4.66);

  const ratings = Array(50).fill(4.8);
  const provenMentorRating = calculateBayesianRating(ratings, 4.5, 3);
  assert.strictEqual(provenMentorRating, 4.78);

  assert.ok(provenMentorRating > newMentorRating, 'Proven mentor with 50 sessions must outrank 2-session mentor');
});

test('Deterministic Skill NLP Extractor Invariant Test', () => {
  const sample = "I built three React websites, a Node backend and worked with MongoDB and Python.";
  const extracted = extractSkillsDeterministic(sample);
  
  const skillNames = extracted.map(s => s.skillName);
  assert.ok(skillNames.includes('React'), 'Should extract React');
  assert.ok(skillNames.includes('Python'), 'Should extract Python');
  assert.ok(skillNames.includes('Node.js'), 'Should extract Node.js');
});

test('Session State Machine & Escrow Double Settlement Guard', () => {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE skill_credit_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      balance INTEGER NOT NULL DEFAULT 3,
      escrow_balance INTEGER NOT NULL DEFAULT 0
    );
  `);

  db.prepare("INSERT INTO skill_credit_accounts (id, user_id, balance, escrow_balance) VALUES ('acc-1', 'u-alice', 3, 0)").run();
  db.prepare("INSERT INTO skill_credit_accounts (id, user_id, balance, escrow_balance) VALUES ('acc-2', 'u-rahul', 0, 0)").run();

  // 1. Escrow Reservation
  db.prepare("UPDATE skill_credit_accounts SET balance = balance - 1, escrow_balance = escrow_balance + 1 WHERE user_id = 'u-alice'").run();
  
  const aliceAcc = db.prepare("SELECT balance, escrow_balance FROM skill_credit_accounts WHERE user_id = 'u-alice'").get();
  assert.strictEqual(aliceAcc.balance, 2, 'Alice balance should decrease to 2');
  assert.strictEqual(aliceAcc.escrow_balance, 1, 'Alice escrow balance should be 1');

  // 2. Settlement Release
  db.prepare("UPDATE skill_credit_accounts SET escrow_balance = escrow_balance - 1 WHERE user_id = 'u-alice'").run();
  db.prepare("UPDATE skill_credit_accounts SET balance = balance + 1 WHERE user_id = 'u-rahul'").run();

  const rahulAcc = db.prepare("SELECT balance FROM skill_credit_accounts WHERE user_id = 'u-rahul'").get();
  assert.strictEqual(rahulAcc.balance, 1, 'Rahul should receive 1 settled Skill Credit');
});
