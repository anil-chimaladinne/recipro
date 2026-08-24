# ENVIRONMENT VARIABLES — SkillSwap Campus Configuration

| Variable | Description | Default / Example Value |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_APP_NAME` | Application Title | `SkillSwap Campus` |
| `NEXT_PUBLIC_APP_URL` | Base Application URL | `http://localhost:3000` |
| `NODE_ENV` | Runtime Environment | `development` / `production` |
| `AUTH_SECRET` | Secret key for HS256 JWT tokens | `skillswap-super-secret-jwt-key-...` |
| `DATABASE_URL` | SQLite database file path | `./data/skillswap.db` |
| `ML_SERVICE_URL` | Python FastAPI ML service endpoint | `http://localhost:8000` |
| `ENABLE_ML_FALLBACK` | Fallback to built-in TypeScript engine | `true` |
| `AI_API_KEY` | Optional Google Gemini / AI API key | `AIzaSy...` (Falls back to NLP if empty) |
| `BLOCKCHAIN_RPC_URL` | EVM RPC Provider | `http://127.0.0.1:8545` |
| `CHAIN_ID` | EVM Chain Identifier | `31337` (Local DevNet) |
| `ESCROW_CONTRACT_ADDRESS` | Deployed Escrow Contract | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| `CREDENTIAL_CONTRACT_ADDRESS` | Deployed Soulbound Credential NFT | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` |
| `ADMIN_WALLET_ADDRESS` | Admin / Oracle Wallet Public Key | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` |
