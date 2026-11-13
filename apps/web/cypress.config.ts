import { defineConfig } from 'cypress';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
dotenv.config({ path: path.resolve(process.cwd(), '../../.env'), quiet: true });
export default defineConfig({
  video: false,
  viewportWidth: 1440,
  viewportHeight: 1000,
  allowCypressEnv: false,
  e2e: {
    baseUrl: 'http://localhost:5173',
    supportFile: false,
    defaultCommandTimeout: 30000,
    setupNodeEvents(on) {
      on('before:browser:launch', (browser, launchOptions) => {
        if (browser.name === 'electron' && browser.isHeadless) {
          launchOptions.preferences.width = 2400;
          launchOptions.preferences.height = 1400;
        }
        return launchOptions;
      });
      on('task', {
        demoAccounts() {
          if (process.env.NODE_ENV !== 'development' || process.env.DEV_SEED !== 'true') throw new Error('Demo login is restricted to local development.');
          const file = path.resolve(process.cwd(), '../../.local/demo-credentials.json');
          if ((fs.statSync(file).mode & 0o077) !== 0) throw new Error('Demo credentials must have restricted permissions.');
          return JSON.parse(fs.readFileSync(file, 'utf8')).accounts as { email: string; password: string }[];
        },
        async verificationLink(email: string) {
          if (!email.startsWith('e2e-') || !email.endsWith('@astanait.edu.kz')) throw new Error('Only fictional E2E mailbox addresses are allowed.');
          if (process.env.NODE_ENV !== 'production' && process.env.DEV_SEED === 'true') {
            const db = new PrismaClient();
            try { await db.user.update({ where: { email }, data: { fictional: true } }); } finally { await db.$disconnect(); }
          }
          const messages = await (await fetch('http://localhost:8025/api/v1/messages')).json() as { messages: { ID: string; To: { Address: string }[] }[] };
          const message = messages.messages.find(m => m.To.some(t => t.Address === email));
          if (!message) throw new Error('Verification email not received.');
          const mail = await (await fetch(`http://localhost:8025/api/v1/message/${message.ID}`)).json() as { Text: string };
          const match = mail.Text.match(/http:\/\/localhost:5173\/verify\?token=[a-f0-9]{64}/);
          if (!match) throw new Error('Verification link missing.');
          return match[0];
        },
        async endSessions(exchangeId: string) {
          if (process.env.NODE_ENV === 'production' || process.env.DEV_SEED !== 'true') throw new Error('This test fixture is restricted to local development.');
          const db = new PrismaClient();
          try {
            const exchange = await db.exchange.findUniqueOrThrow({ where: { id: exchangeId }, include: { sender: true, receiver: true } });
            if (![exchange.sender.email, exchange.receiver.email].every(email => email.startsWith('e2e-') && email.endsWith('@astanait.edu.kz'))) throw new Error('Only fictional E2E exchanges can be changed.');
            const sessions = await db.exchangeSession.findMany({ where: { exchangeId }, orderBy: { ordinal: 'asc' } });
            for (const [index, session] of sessions.entries()) await db.exchangeSession.update({ where: { id: session.id }, data: { startsAt: new Date(Date.now() - (2 - index) * 86400000) } });
            return null;
          } finally { await db.$disconnect(); }
        }
      });
    }
  }
});
