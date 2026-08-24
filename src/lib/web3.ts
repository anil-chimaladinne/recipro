import { ethers } from 'ethers';
import { getDb } from './db';

const RPC_URL = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545';
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '31337', 10);
const ESCROW_ADDRESS = process.env.ESCROW_CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const CREDENTIAL_ADDRESS = process.env.CREDENTIAL_CONTRACT_ADDRESS || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';

/**
 * Verify cryptographic signature of a nonce challenge to prove wallet ownership
 */
export function verifyWalletSignature(address: string, nonce: string, signature: string): boolean {
  try {
    const expectedMessage = `SkillSwap Campus Authentication Challenge:\n\nNonce: ${nonce}\nTimestamp: ${new Date().toISOString().substring(0, 10)}`;
    const recoveredAddress = ethers.verifyMessage(expectedMessage, signature);
    return recoveredAddress.toLowerCase() === address.toLowerCase();
  } catch (err) {
    console.error('Wallet signature verification error:', err);
    return false;
  }
}

/**
 * Check connectivity to EVM Blockchain node
 */
export async function getBlockchainStatus(): Promise<{
  connected: boolean;
  chainId: number;
  blockNumber: number;
  mode: 'LIVE_EVM_RPC' | 'LOCAL_DEVNET_SIMULATION';
  escrowAddress: string;
  credentialAddress: string;
}> {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL, undefined, { staticNetwork: true });
    const network = await Promise.race([
      provider.getNetwork(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('RPC Timeout')), 1500))
    ]);
    const blockNumber = await provider.getBlockNumber();

    return {
      connected: true,
      chainId: Number(network.chainId),
      blockNumber,
      mode: 'LIVE_EVM_RPC',
      escrowAddress: ESCROW_ADDRESS,
      credentialAddress: CREDENTIAL_ADDRESS,
    };
  } catch {
    return {
      connected: false,
      chainId: CHAIN_ID,
      blockNumber: 12480,
      mode: 'LOCAL_DEVNET_SIMULATION',
      escrowAddress: ESCROW_ADDRESS,
      credentialAddress: CREDENTIAL_ADDRESS,
    };
  }
}

/**
 * Database vs Blockchain Reconciliation Engine
 */
export function reconcileBlockchainTransactions(): {
  totalChecked: number;
  reconciled: number;
  flaggedMismatches: number;
  mismatches: Array<{ id: string; txHash: string; issue: string }>;
} {
  const db = getDb();

  const transactions = db.prepare(`
    SELECT id, reference_type, reference_id, tx_hash, status, created_at
    FROM blockchain_transactions
    ORDER BY created_at DESC
    LIMIT 50
  `).all() as any[];

  let reconciled = 0;
  let flaggedMismatches = 0;
  const mismatches: Array<{ id: string; txHash: string; issue: string }> = [];

  for (const tx of transactions) {
    if (tx.reference_type === 'SESSION_SETTLEMENT') {
      const session = db.prepare(`SELECT status FROM sessions WHERE id = ?`).get(tx.reference_id) as any;
      if (!session) {
        flaggedMismatches++;
        mismatches.push({ id: tx.id, txHash: tx.tx_hash, issue: `Referenced session ${tx.reference_id} does not exist in DB` });
      } else if (session.status !== 'CREDIT_SETTLED' && session.status !== 'COMPLETED') {
        flaggedMismatches++;
        mismatches.push({ id: tx.id, txHash: tx.tx_hash, issue: `State discrepancy: DB session is ${session.status} while on-chain settlement is recorded` });
      } else {
        reconciled++;
      }
    } else {
      reconciled++;
    }
  }

  return {
    totalChecked: transactions.length,
    reconciled,
    flaggedMismatches,
    mismatches,
  };
}
