import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { LinkWalletSchema } from '@/lib/validations';
import { verifyWalletSignature, getBlockchainStatus, reconcileBlockchainTransactions } from '@/lib/web3';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  const authRes = requireAuth(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const db = getDb();

  const wallet = db.prepare('SELECT address, chain_id, is_verified, linked_at FROM wallets WHERE user_id = ?').get(user.userId);
  const status = await getBlockchainStatus();
  const reconciliation = reconcileBlockchainTransactions();

  // Generate unique challenge nonce for signature verification
  const nonce = `skillswap-nonce-${crypto.randomBytes(8).toString('hex')}`;

  return NextResponse.json({
    wallet: wallet || null,
    challengeNonce: nonce,
    blockchainStatus: status,
    reconciliation,
  });
}

export async function POST(req: NextRequest) {
  const authRes = requireAuth(req);
  if ('errorResponse' in authRes) return authRes.errorResponse;

  const { user } = authRes;
  const db = getDb();

  try {
    const body = await req.json();
    const parsed = LinkWalletSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid wallet proof payload', details: parsed.error.format() }, { status: 400 });
    }

    const { address, chainId, signature, nonce } = parsed.data;

    // Cryptographic signature validation
    const isValid = verifyWalletSignature(address, nonce, signature);
    if (!isValid) {
      return NextResponse.json({
        error: 'Cryptographic signature verification failed. Wallet ownership could not be verified.',
        code: 'INVALID_SIGNATURE'
      }, { status: 400 });
    }

    // Save linked wallet
    db.prepare(`
      INSERT INTO wallets (id, user_id, address, chain_id, signature_proof, is_verified)
      VALUES (?, ?, ?, ?, ?, 1)
      ON CONFLICT(user_id) DO UPDATE SET
        address = excluded.address,
        chain_id = excluded.chain_id,
        signature_proof = excluded.signature_proof,
        linked_at = CURRENT_TIMESTAMP
    `).run(
      `wallet-${user.userId}`,
      user.userId,
      address,
      chainId,
      signature
    );

    return NextResponse.json({
      success: true,
      message: `Wallet ${address.substring(0, 6)}...${address.substring(38)} verified and linked successfully!`,
      wallet: {
        address,
        chainId,
        isVerified: true,
      }
    });
  } catch (err: any) {
    console.error('Wallet Link Error:', err);
    return NextResponse.json({ error: 'Failed to link wallet' }, { status: 500 });
  }
}
