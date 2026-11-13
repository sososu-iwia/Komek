import { Router, RequestHandler } from 'express';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { db, publicUserSelect, transaction } from './db';
import { config } from './config';
import { ApiError, route } from './http';
import { email, loginSchema, registerSchema } from './validation';
import { sendVerification } from './mail';

export const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const cookieOptions = { httpOnly: true, secure: config.secureCookies, sameSite: 'lax' as const, path: '/api', maxAge: 7 * 86400000 };
export const csrf: RequestHandler = (req, _res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.headers.origin && req.headers.origin !== config.WEB_ORIGIN) return next(new ApiError(403, 'Origin is not allowed.', 'CSRF_ERROR'));
  const token = req.headers['x-csrf-token'];
  const cookie = req.cookies.ks_csrf;
  if (typeof token !== 'string' || typeof cookie !== 'string' || !/^[a-f0-9]{64}$/.test(token) || !/^[a-f0-9]{64}$/.test(cookie) || !timingSafeEqual(Buffer.from(token), Buffer.from(cookie))) {
    return next(new ApiError(403, 'Refresh the page and try again.', 'CSRF_ERROR'));
  }
  next();
};
export const requireAuth: RequestHandler = (req, _res, next) => { void (async () => {
  const token: unknown = req.cookies.ks_session;
  if (typeof token !== 'string' || token.length !== 64) throw new ApiError(401, 'Please sign in.', 'UNAUTHENTICATED');
  const session = await db.authSession.findUnique({ where: { tokenHash: hash(token) }, include: { user: { select: { id: true, email: true, role: true, emailVerifiedAt: true, fictional: true } } } });
  if (!session || session.expiresAt < new Date() || !session.user.emailVerifiedAt || (config.NODE_ENV === 'production' && session.user.fictional)) throw new ApiError(401, 'Your session has expired. Please sign in.', 'UNAUTHENTICATED');
  req.user = session.user;
})().then(() => next(), next); };
export const authenticated: RequestHandler = (req, res, next) => { requireAuth(req, res, err => err ? next(err) : next()); };

export const authRouter = Router();
authRouter.get('/csrf', (_req, res) => {
  const token = randomBytes(32).toString('hex');
  res.cookie('ks_csrf', token, cookieOptions).json({ token });
});
const limiter = rateLimit({ windowMs: 15 * 60000, limit: config.NODE_ENV === 'test' ? 1000 : 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again later.' } } });
authRouter.post('/register', limiter, route(async (req, res) => {
  const input = registerSchema.parse(req.body);
  const token = randomBytes(32).toString('hex');
  const passwordHash = await bcrypt.hash(input.password, 12);
  await db.user.create({ data: { email: input.email, passwordHash, profile: { create: { fullName: input.fullName } }, verificationTokens: { create: { tokenHash: hash(token), expiresAt: new Date(Date.now() + 86400000) } } } });
  try { await sendVerification(input.email, token); }
  catch { throw new ApiError(503, 'Account created, but the email service is unavailable. Use resend verification when it is back.', 'MAIL_UNAVAILABLE'); }
  res.status(201).json({ message: 'Check your email to verify your account.' });
}));
authRouter.post('/resend-verification', limiter, route(async (req, res) => {
  const address = email.parse(req.body.email);
  const user = await db.user.findUnique({ where: { email: address } });
  if (user && !user.emailVerifiedAt) {
    const token = randomBytes(32).toString('hex');
    await transaction(async tx => {
      await tx.verificationToken.deleteMany({ where: { userId: user.id } });
      await tx.verificationToken.create({ data: { userId: user.id, tokenHash: hash(token), expiresAt: new Date(Date.now() + 86400000) } });
    });
    await sendVerification(address, token);
  }
  res.json({ message: 'If an unverified account exists, a new verification email has been sent.' });
}));
authRouter.post('/verify-email', limiter, route(async (req, res) => {
  const { token } = z.object({ token: z.string().length(64) }).parse(req.body);
  await transaction(async tx => {
    const record = await tx.verificationToken.findUnique({ where: { tokenHash: hash(token) } });
    if (!record || record.expiresAt < new Date()) throw new ApiError(400, 'Verification link is invalid or expired.');
    await tx.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } });
    await tx.verificationToken.deleteMany({ where: { userId: record.userId } });
  });
  res.json({ message: 'Email verified. You can now sign in.' });
}));
authRouter.post('/login', limiter, route(async (req, res) => {
  const input = loginSchema.parse(req.body);
  const user = await db.user.findUnique({ where: { email: input.email } });
  const valid = await bcrypt.compare(input.password, user?.passwordHash ?? '$2b$12$C6UzMDM.H6dfI/f/IKcEe.5U2ghHYQAEyvrkO9VPOl1WrHDWPRSaW');
  if (!user || !valid || (config.NODE_ENV === 'production' && user.fictional)) throw new ApiError(401, 'Incorrect email or password.');
  if (!user.emailVerifiedAt) throw new ApiError(403, 'Verify your email before signing in.', 'EMAIL_NOT_VERIFIED');
  const token = randomBytes(32).toString('hex');
  await db.authSession.create({ data: { userId: user.id, tokenHash: hash(token), expiresAt: new Date(Date.now() + 7 * 86400000) } });
  res.cookie('ks_session', token, cookieOptions).json({ user: { id: user.id, email: user.email, role: user.role } });
}));
authRouter.post('/logout', route(async (req, res) => {
  if (typeof req.cookies.ks_session === 'string') await db.authSession.deleteMany({ where: { tokenHash: hash(req.cookies.ks_session) } });
  res.clearCookie('ks_session', { ...cookieOptions, maxAge: undefined }).json({ message: 'Signed out.' });
}));
authRouter.get('/me', authenticated, route(async (req, res) => {
  res.json(await db.user.findUniqueOrThrow({ where: { id: req.user.id }, select: { ...publicUserSelect, email: true, role: true } }));
}));
