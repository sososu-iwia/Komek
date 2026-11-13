import nodemailer from 'nodemailer';
import { config } from './config';
const transport = nodemailer.createTransport({
  host: config.SMTP_HOST, port: config.SMTP_PORT, secure: config.SMTP_SECURE === 'true',
  ...(config.SMTP_USER ? { auth: { user: config.SMTP_USER, pass: config.SMTP_PASS } } : {})
});
export async function sendVerification(email: string, token: string) {
  const url = `${config.WEB_ORIGIN}/verify?token=${encodeURIComponent(token)}`;
  await transport.sendMail({ from: config.SMTP_FROM, to: email, subject: 'Verify your Kömek Skills email', text: `Welcome to Kömek Skills. Verify your email within 24 hours: ${url}\nIf you did not register, ignore this email.` });
}
export async function sendNotice(email: string, title: string) {
  if (config.EMAIL_NOTIFICATIONS !== 'true') return;
  await transport.sendMail({ from: config.SMTP_FROM, to: email, subject: title, text: `${title}\nView your exchanges: ${config.WEB_ORIGIN}/exchanges` });
}
