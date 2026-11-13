const path = require('node:path');
const { spawnSync } = require('node:child_process');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const { PrismaClient } = require('@prisma/client');
async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Test database setup is restricted to development.');
  const target = new URL(process.env.TEST_DATABASE_URL || 'postgresql://komek:komek_local_only@localhost:5433/komek_test?schema=public');
  if (target.pathname !== '/komek_test') throw new Error('Test database must be named komek_test.');
  const controlUrl = new URL(target); controlUrl.pathname = '/postgres';
  const db = new PrismaClient({ datasourceUrl: controlUrl.toString() });
  try {
    const exists = await db.$queryRaw`SELECT 1 FROM pg_database WHERE datname = 'komek_test'`;
    if (!exists.length) await db.$executeRawUnsafe('CREATE DATABASE "komek_test"');
  } finally { await db.$disconnect(); }
  const result = spawnSync(process.execPath, [path.resolve(__dirname, 'prisma.cjs'), 'migrate', 'deploy', '--schema', path.resolve(__dirname, '../apps/api/prisma/schema.prisma')], { stdio: 'inherit', env: { ...process.env, DATABASE_URL: target.toString() } });
  if (result.status !== 0) throw new Error('Test database migrations failed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
