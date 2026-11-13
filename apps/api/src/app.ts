import express, { ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { config } from './config';
import { db } from './db';
import { ApiError, route } from './http';
import { authRouter, authenticated, csrf } from './auth';
import { peopleRouter } from './people';
import { exchangeRouter } from './exchanges';
import { openapi } from './openapi';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: config.WEB_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '64kb' }));
  app.use(cookieParser());
  app.use('/api', rateLimit({ windowMs: 60000, limit: config.NODE_ENV === 'test' ? 5000 : 300, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again shortly.' } } }));
  app.get('/api/health', route(async (_req, res) => {
    await db.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', service: 'komek-skills', apiVersion: 'v1' });
  }));
  app.get('/api/config', (_req, res) => res.json({ allowedEmailDomains: config.domains, localDemo: config.NODE_ENV === 'development' && process.env.DEV_SEED === 'true' }));
  app.get('/api/catalogue', route(async (_req, res) => { res.json(await db.skill.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }], take: 500 })); }));
  app.get('/api/openapi.json', (_req, res) => res.json(openapi));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi));
  app.use('/api', csrf);
  app.use(['/api/auth', '/api/v1/auth'], authRouter);
  app.use(['/api/v1', '/api'], authenticated, peopleRouter, exchangeRouter);
  app.use((_req, _res, next) => next(new ApiError(404, 'Endpoint not found.')));
  const errors: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    if (error instanceof ZodError) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(' '), fields: error.flatten() } });
    if (error instanceof ApiError) return res.status(error.status).json({ error: { code: error.code, message: error.message } });
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') return res.status(409).json({ error: { code: 'DUPLICATE', message: 'This email, review, or record already exists.' } });
      if (['P2025', 'P2003'].includes(error.code)) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Related record not found.' } });
    }
    if (error instanceof SyntaxError) return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request must contain valid JSON.' } });
    console.error(error);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } });
  };
  app.use(errors);
  return app;
}
