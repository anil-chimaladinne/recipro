import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { getBlockchainStatus, reconcileBlockchainTransactions } from '@/lib/web3';

export async function GET(req: NextRequest) {
  const authRes = requireRole(req, ['ADMIN', 'MODERATOR']);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const db = getDb();

  // 1. Database Health
  let dbStatus = 'HEALTHY';
  let dbStats: any = {};
  try {
    const counts = {
      users: (db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c,
      sessions: (db.prepare('SELECT COUNT(*) as c FROM sessions').get() as any).c,
      skills: (db.prepare('SELECT COUNT(*) as c FROM skills').get() as any).c,
      creditTxs: (db.prepare('SELECT COUNT(*) as c FROM credit_transactions').get() as any).c,
      credentials: (db.prepare('SELECT COUNT(*) as c FROM credentials').get() as any).c,
      fraudAlerts: (db.prepare('SELECT COUNT(*) as c FROM fraud_alerts').get() as any).c,
    };
    dbStats = counts;
  } catch {
    dbStatus = 'DEGRADED';
  }

  // 2. Python ML Service Health
  let mlStatus = 'FALLBACK_READY';
  let mlInfo: any = { mode: 'TypeScript Built-in Hybrid Engine' };
  try {
    const mlRes = await Promise.race([
      fetch('http://localhost:8000/health'),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 800))
    ]);
    if (mlRes.ok) {
      const mlData = await mlRes.json();
      mlStatus = 'ONLINE';
      mlInfo = mlData;
    }
  } catch {
    mlStatus = 'FALLBACK_ACTIVE';
  }

  // 3. Blockchain RPC Status
  const blockchainStatus = await getBlockchainStatus();
  const reconciliation = reconcileBlockchainTransactions();

  // 4. Recent Audit Logs
  const auditLogs = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 30').all();

  return NextResponse.json({
    systemStatus: 'OPERATIONAL',
    timestamp: new Date().toISOString(),
    components: {
      database: {
        status: dbStatus,
        driver: 'Better-SQLite3 (WAL Mode)',
        stats: dbStats,
      },
      mlIntelligence: {
        status: mlStatus,
        details: mlInfo,
        fallbackEnabled: true,
      },
      blockchain: {
        status: blockchainStatus.connected ? 'ONLINE_EVM_RPC' : 'LOCAL_DEVNET_MODE',
        chainId: blockchainStatus.chainId,
        blockNumber: blockchainStatus.blockNumber,
        escrowContract: blockchainStatus.escrowAddress,
        credentialContract: blockchainStatus.credentialAddress,
      },
      reconciliation,
    },
    auditLogs,
  });
}
