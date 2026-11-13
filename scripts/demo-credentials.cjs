const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
function loadDemoCredentials() {
  if (process.env.NODE_ENV !== 'development' || process.env.DEV_SEED !== 'true') throw new Error('Demo credentials are restricted to local development.');
  const filename = process.env.DEMO_CREDENTIALS_PATH || path.resolve(__dirname, '../.local/demo-credentials.json');
  fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  if (!fs.existsSync(filename)) {
    const accounts = ['aitu.demo01@astanait.edu.kz', 'aitu.demo02@astanait.edu.kz'].map(email => ({ email, password: `${crypto.randomBytes(20).toString('base64url')}aA1!` }));
    fs.writeFileSync(filename, JSON.stringify({ accounts }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  }
  fs.chmodSync(filename, 0o600);
  const result = JSON.parse(fs.readFileSync(filename, 'utf8'));
  if (!Array.isArray(result.accounts) || result.accounts.length !== 2 || result.accounts.some((a, i) => a.email !== `aitu.demo0${i + 1}@astanait.edu.kz` || typeof a.password !== 'string' || a.password.length < 24)) throw new Error('Invalid local demo credential file.');
  return result.accounts;
}
module.exports = { loadDemoCredentials };
if (require.main === module) {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
  loadDemoCredentials();
  console.log('Local demo credentials are ready in the restricted ignored credentials file.');
}
