# DEPLOYMENT & OPERATIONS — SkillSwap Campus

## Deployment Architecture

SkillSwap Campus is container-ready and can be deployed to Vercel, Docker, AWS ECS, or standard Node.js / Linux hosts.

### 1. Build Production Next.js Bundle
```bash
npm run build
```

### 2. Run Database Seeding / Migrations
```bash
npm run seed
```

### 3. Start Production Server
```bash
npm start
```

### 4. Optional: Run Python ML Microservice
```bash
cd python_ml_service
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000
```
*(Note: If the Python service is offline, the platform's built-in TypeScript fallback engine automatically takes over without any degradation.)*

### 5. Health Check Endpoints
- Web App / Health: `GET /api/admin/system`
- ML Service Health: `GET http://localhost:8000/health`
