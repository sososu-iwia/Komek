require('dotenv').config({ path: require('node:path').resolve(__dirname, '../../../.env'), quiet: true });
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://komek:komek_local_only@localhost:5433/komek_test?schema=public';
process.env.WEB_ORIGIN = 'http://localhost:5173';
process.env.ALLOWED_EMAIL_DOMAINS = 'students.example.test';
