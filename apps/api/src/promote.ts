import { db } from './db';
import './config';
async function main() {
  const email = process.argv[2]?.toLowerCase();
  if (!email) throw new Error('Usage: npm run admin -w @komek/api -- verified-email');
  const user = await db.user.findUnique({ where: { email } });
  if (!user?.emailVerifiedAt) throw new Error('An existing verified account is required.');
  await db.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
  console.log('Administrator role granted to the specified verified account.');
}
main().finally(() => db.$disconnect()).catch(error => { console.error(error); process.exitCode = 1; });
