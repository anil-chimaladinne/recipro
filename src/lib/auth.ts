import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from './db';

const JWT_SECRET = process.env.AUTH_SECRET || 'skillswap-super-secret-jwt-key-for-local-development-min32bytes';
const JWT_EXPIRES_IN = process.env.TOKEN_EXPIRY || '7d';

export interface TokenPayload {
  userId: string;
  email: string;
  role: 'STUDENT' | 'MODERATOR' | 'ADMIN';
  status: string;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export function getAuthUser(req: NextRequest): TokenPayload | null {
  // Check Authorization Bearer header
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return verifyToken(token);
  }

  // Check cookie
  const cookieToken = req.cookies.get('skillswap_token')?.value;
  if (cookieToken) {
    return verifyToken(cookieToken);
  }

  return null;
}

export function requireAuth(req: NextRequest): { user: TokenPayload } | { errorResponse: NextResponse } {
  const user = getAuthUser(req);
  if (!user) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Unauthorized: Authentication token is required', code: 'UNAUTHORIZED' },
        { status: 401 }
      ),
    };
  }

  // Double check user status in DB to ensure account wasn't suspended
  const db = getDb();
  const dbUser = db.prepare('SELECT status, role FROM users WHERE id = ?').get(user.userId) as { status: string; role: string } | undefined;
  
  if (!dbUser) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Account not found', code: 'USER_NOT_FOUND' },
        { status: 401 }
      ),
    };
  }

  if (dbUser.status === 'SUSPENDED') {
    return {
      errorResponse: NextResponse.json(
        { error: 'Account has been suspended by campus moderators', code: 'ACCOUNT_SUSPENDED' },
        { status: 403 }
      ),
    };
  }

  // Keep user role current
  user.role = dbUser.role as TokenPayload['role'];
  user.status = dbUser.status;

  return { user };
}

export function requireRole(req: NextRequest, allowedRoles: ('STUDENT' | 'MODERATOR' | 'ADMIN')[]): { user: TokenPayload } | { errorResponse: NextResponse } {
  const authResult = requireAuth(req);
  if ('errorResponse' in authResult) {
    return authResult;
  }

  const { user } = authResult;
  if (!allowedRoles.includes(user.role)) {
    return {
      errorResponse: NextResponse.json(
        { error: `Forbidden: Requires one of roles: [${allowedRoles.join(', ')}]`, code: 'FORBIDDEN' },
        { status: 403 }
      ),
    };
  }

  return { user };
}

export function requireAdmin(req: NextRequest): { user: TokenPayload } | { errorResponse: NextResponse } {
  return requireRole(req, ['ADMIN']);
}

