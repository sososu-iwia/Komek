import dotenv from 'dotenv';
import path from 'node:path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
dotenv.config({ quiet: true });

const env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  ALLOWED_EMAIL_DOMAINS: z.string().min(1),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_FROM: z.string().default('Komek Skills <noreply@students.example.test>'),
  SMTP_SECURE: z.string().default('false'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_NOTIFICATIONS: z.string().default('false'),
  COOKIE_SECURE: z.string().default('false')
}).parse(process.env);

export const config = {
  ...env,
  domains: env.NODE_ENV === 'test' ? env.ALLOWED_EMAIL_DOMAINS.split(',').map(d => d.trim().toLowerCase()).filter(Boolean) : ['astanait.edu.kz'],
  secureCookies: env.NODE_ENV === 'production' || env.COOKIE_SECURE === 'true'
};
if (config.NODE_ENV === 'production' && (config.domains.some(d => d.endsWith('.test')) || !config.WEB_ORIGIN.startsWith('https://'))) {
  throw new Error('Production requires HTTPS WEB_ORIGIN and confirmed university email domains.');
}
