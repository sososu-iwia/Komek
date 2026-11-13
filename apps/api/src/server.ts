import { createApp } from './app';
import { config } from './config';
import { db } from './db';
const server = createApp().listen(config.PORT, '0.0.0.0', () => console.log(`Kömek Skills API http://localhost:${config.PORT}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.close(() => { void db.$disconnect().then(() => process.exit(0)); }); });
