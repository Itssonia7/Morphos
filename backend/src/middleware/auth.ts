import type { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';
import type { DecodedIdToken } from 'firebase-admin/auth';

export interface AuthenticatedRequest extends Request {
  user?: DecodedIdToken;
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization ?? '';
  const hasHeader = authHeader.length > 0;
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  console.info('AUTH MIDDLEWARE: authorization header present:', hasHeader ? 'true' : 'false');

  if (!token) {
    console.warn('AUTH MIDDLEWARE: token verification: FAIL');
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    console.info('AUTH MIDDLEWARE: token verification: PASS');
    console.info('AUTH MIDDLEWARE: decoded UID present:', decodedToken.uid ? 'true' : 'false');
    return next();
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : 'unknown';
    console.warn('AUTH MIDDLEWARE: token verification: FAIL', { code });
    return res.status(401).json({ error: 'Invalid or expired Firebase token.' });
  }
}

