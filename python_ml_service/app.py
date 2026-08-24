from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
import numpy as np
from sklearn.ensemble import IsolationForest
import networkx as nx

app = FastAPI(
    title="SkillSwap Campus ML Intelligence Service",
    version="1.0.0",
    description="Microservice providing Isolation Forest Fraud Scoring, Hybrid Vector Candidate Matching, and Directed Graph Cycle Finding."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------------
# 1. Hybrid Candidate Match Engine
# -------------------------------------------------------------
class CandidateFeatures(BaseModel):
    user_id: str
    display_name: str
    skill_score: float = Field(..., ge=0, le=100)
    availability_score: float = Field(..., ge=0, le=100)
    proficiency_score: float = Field(..., ge=0, le=100)
    goal_score: float = Field(..., ge=0, le=100)
    reliability_score: float = Field(..., ge=0, le=100)
    reputation_score: float = Field(..., ge=0, le=100)
    style_score: float = Field(..., ge=0, le=100)

class MatchRequest(BaseModel):
    candidates: List[CandidateFeatures]
    weights: Optional[Dict[str, float]] = None

class MatchResponseItem(BaseModel):
    user_id: str
    display_name: str
    match_score: int
    breakdown: Dict[str, float]
    explanation: List[str]

@app.post("/match", response_model=List[MatchResponseItem])
def rank_candidates(payload: MatchRequest):
    w = payload.weights or {
        "skill": 0.30,
        "availability": 0.20,
        "proficiency": 0.15,
        "goal": 0.10,
        "reliability": 0.10,
        "reputation": 0.10,
        "style": 0.05
    }

    results = []
    for c in payload.candidates:
        score = (
            c.skill_score * w.get("skill", 0.30) +
            c.availability_score * w.get("availability", 0.20) +
            c.proficiency_score * w.get("proficiency", 0.15) +
            c.goal_score * w.get("goal", 0.10) +
            c.reliability_score * w.get("reliability", 0.10) +
            c.reputation_score * w.get("reputation", 0.10) +
            c.style_score * w.get("style", 0.05)
        )
        final_score = int(np.clip(np.round(score), 0, 100))

        explanations = []
        if c.skill_score >= 80:
            explanations.append(f"High domain proficiency ({c.skill_score:.0f}%)")
        if c.availability_score >= 80:
            explanations.append("Strong schedule compatibility")
        if c.reputation_score >= 85:
            explanations.append(f"Top peer rating ({c.reputation_score:.0f}%)")
        if c.reliability_score >= 90:
            explanations.append("High completion and reliability rate")

        results.append(MatchResponseItem(
            user_id=c.user_id,
            display_name=c.display_name,
            match_score=final_score,
            breakdown={
                "skill": c.skill_score,
                "availability": c.availability_score,
                "proficiency": c.proficiency_score,
                "goal": c.goal_score,
                "reliability": c.reliability_score,
                "reputation": c.reputation_score,
                "style": c.style_score
            },
            explanation=explanations
        ))

    results.sort(key=lambda x: x.match_score, reverse=True)
    return results


# -------------------------------------------------------------
# 2. Isolation Forest Fraud & Sybil Detector
# -------------------------------------------------------------
class FraudEvaluationRequest(BaseModel):
    user_id: str
    reciprocity_index: float = Field(..., ge=0, le=1.0)
    rating_concentration: float = Field(..., ge=0, le=1.0)
    daily_session_velocity: float
    cancellation_rate: float = Field(..., ge=0, le=100.0)
    credit_velocity: float
    wallet_reuse: bool
    account_age_days: float

class FraudEvaluationResponse(BaseModel):
    user_id: str
    risk_score: int
    risk_level: str
    anomaly_reasons: List[str]
    is_anomaly: bool

# Seed baseline normal behavior distribution for Isolation Forest
synthetic_normal_data = np.array([
    [0.10, 0.20, 0.5, 5.0, 1.0, 0, 30.0],
    [0.15, 0.25, 0.8, 8.0, 2.0, 0, 60.0],
    [0.05, 0.15, 0.3, 0.0, 0.5, 0, 90.0],
    [0.20, 0.30, 1.0, 10.0, 2.5, 0, 45.0],
    [0.00, 0.10, 0.4, 2.0, 1.0, 0, 120.0],
    [0.25, 0.35, 1.2, 12.0, 3.0, 0, 15.0],
])

iso_forest = IsolationForest(contamination=0.15, random_state=42)
iso_forest.fit(synthetic_normal_data)

@app.post("/detect_fraud", response_model=FraudEvaluationResponse)
def detect_fraud(payload: FraudEvaluationRequest):
    reasons = []
    heuristic_risk = 10.0

    if payload.reciprocity_index >= 0.7:
        heuristic_risk += 30.0
        reasons.append(f"High reciprocal rating loop detected ({payload.reciprocity_index*100:.0f}% mutual reviews)")

    if payload.rating_concentration >= 0.75:
        heuristic_risk += 25.0
        reasons.append(f"Suspicious review concentration ({payload.rating_concentration*100:.0f}% from single party)")

    if payload.daily_session_velocity > 6.0:
        heuristic_risk += 30.0
        reasons.append(f"Abnormal session frequency: {payload.daily_session_velocity:.1f} sessions/day")

    if payload.credit_velocity > 10.0:
        heuristic_risk += 20.0
        reasons.append(f"High credit movement velocity: {payload.credit_velocity:.0f} ops in 24h")

    if payload.wallet_reuse:
        heuristic_risk += 35.0
        reasons.append("Sybil Indicator: Wallet address linked to multiple student accounts")

    if payload.cancellation_rate > 35.0:
        heuristic_risk += 15.0
        reasons.append(f"Elevated cancellation rate ({payload.cancellation_rate:.1f}%)")

    feature_vec = np.array([[
        payload.reciprocity_index,
        payload.rating_concentration,
        payload.daily_session_velocity,
        payload.cancellation_rate,
        payload.credit_velocity,
        1 if payload.wallet_reuse else 0,
        payload.account_age_days
    ]])

    pred = iso_forest.predict(feature_vec)
    is_anomaly = bool(pred[0] == -1)

    if is_anomaly and len(reasons) == 0:
        reasons.append("Statistical feature outlier in behavioral pattern")
        heuristic_risk += 25.0

    final_risk = int(np.clip(heuristic_risk, 5, 100))
    if final_risk >= 70:
        level = "HIGH"
    elif final_risk >= 40:
        level = "MEDIUM"
    else:
        level = "LOW"

    return FraudEvaluationResponse(
        user_id=payload.user_id,
        risk_score=final_risk,
        risk_level=level,
        anomaly_reasons=reasons,
        is_anomaly=is_anomaly
    )


# -------------------------------------------------------------
# 3. Directed Graph Multi-Person Cycle Finder
# -------------------------------------------------------------
class EdgeData(BaseModel):
    from_user: str
    to_user: str
    skill_name: str

class GraphCycleRequest(BaseModel):
    edges: List[EdgeData]
    max_cycle_length: Optional[int] = 4

@app.post("/find_cycles")
def find_graph_cycles(payload: GraphCycleRequest):
    G = nx.DiGraph()
    for e in payload.edges:
        G.add_edge(e.from_user, e.to_user, skill_name=e.skill_name)

    raw_cycles = list(nx.simple_cycles(G))
    valid_cycles = []
    
    for c in raw_cycles:
        if 2 <= len(c) <= payload.max_cycle_length:
            cycle_edges = []
            for i in range(len(c)):
                u1 = c[i]
                u2 = c[(i + 1) % len(c)]
                data = G.get_edge_data(u1, u2) or {}
                cycle_edges.append({
                    "from": u1,
                    "to": u2,
                    "skill": data.get("skill_name", "Skill")
                })
            valid_cycles.append({
                "nodes": c,
                "length": len(c),
                "flow": cycle_edges
            })

    return {"cycle_count": len(valid_cycles), "cycles": valid_cycles}


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "SkillSwap Campus ML Intelligence Service",
        "models": ["IsolationForest", "HybridVectorMatcher", "NetworkXCycleFinder"]
    }
