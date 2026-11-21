import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma.ts';

function getAdminSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();
  if (!secret) {
    throw new Error(
      'تنظیم امنیتی ADMIN_SESSION_SECRET در متغیرهای محیطی یافت نشد. لطفاً آن را در server/.env با حداقل ۳۲ کاراکتر تعریف کنید.',
    );
  }
  if (secret.length < 32) {
    throw new Error(
      'مقدار ADMIN_SESSION_SECRET بسیار ضعیف است. حداقل ۳۲ کاراکتر (۲۵۶ بیت) برای امضای امن توکن الزامی است.',
    );
  }
  return secret;
}

const SESSION_SECRET = getAdminSessionSecret();

export interface AdminPayload {
  adminId: string;
  username: string;
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  admin?: AdminPayload;
}

/**
 * Verifies a password against the scrypt hash format used in seed.ts:
 * `scrypt:<salt>:<derivedKey>`
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [algo, salt, expectedHash] = storedHash.split(':');
    if (algo !== 'scrypt' || !salt || !expectedHash) {
      return false;
    }

    const expectedBuffer = Buffer.from(expectedHash, 'hex');
    const derivedBuffer = scryptSync(password, salt, expectedBuffer.length);

    return timingSafeEqual(derivedBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

/**
 * Creates a cryptographically signed authentication token.
 * Valid for 24 hours.
 */
export function createAdminToken(admin: { id: string; username: string }): string {
  const payload: AdminPayload = {
    adminId: admin.id,
    username: admin.username,
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', SESSION_SECRET)
    .update(payloadBase64)
    .digest('base64url');

  return `${payloadBase64}.${signature}`;
}

/**
 * Verifies an authentication token and returns its payload if valid.
 */
export function verifyAdminToken(token: string): AdminPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadBase64, signature] = parts;
    const expectedSig = createHmac('sha256', SESSION_SECRET)
      .update(payloadBase64)
      .digest('base64url');

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSig);

    if (sigBuffer.length !== expectedBuffer.length) return null;
    if (!timingSafeEqual(sigBuffer, expectedBuffer)) return null;

    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8')) as AdminPayload;

    if (!payload.adminId || !payload.username || !payload.exp) return null;
    if (payload.exp <= Date.now()) return null;

    return payload;
  } catch {
    return null;
  }
}

/**
 * Express middleware that enforces valid Admin authentication.
 * Checks `Authorization: Bearer <token>` or custom header `X-Admin-Token`.
 */
export async function requireAdminAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (typeof req.headers['x-admin-token'] === 'string') {
    token = req.headers['x-admin-token'].trim();
  }

  if (!token) {
    res.status(401).json({
      message: 'دسترسی غیرمجاز. لطفاً ابتدا وارد حساب مدیریت شوید.',
    });
    return;
  }

  const payload = verifyAdminToken(token);
  if (!payload) {
    res.status(401).json({
      message: 'نشست کاربری شما منقضی یا نامعتبر است. لطفاً دوباره وارد شوید.',
    });
    return;
  }

  // Ensure admin still exists and is active in DB
  const admin = await prisma.admin.findUnique({
    where: { id: payload.adminId },
    select: { id: true, isActive: true },
  });

  if (!admin || !admin.isActive) {
    res.status(401).json({
      message: 'حساب کاربری مدیریت غیرفعال است یا یافت نشد.',
    });
    return;
  }

  req.admin = payload;
  next();
}
