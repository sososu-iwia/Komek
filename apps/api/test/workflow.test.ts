import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app';
import { db } from '../src/db';
import { config } from '../src/config';
import type { Exchange, ExchangeSession } from '@prisma/client';

const app = createApp();
type Agent = ReturnType<typeof request.agent>;
const a = request.agent(app);
const b = request.agent(app);
const c = request.agent(app);
const password = 'TestPassword2026!';
let exchange: Exchange & { sessions: ExchangeSession[] };
const profile = (fullName: string, teaching: string, learning: string, hours = [10, 11]) => ({ fullName, faculty: 'Software Engineering', studyYear: 2, bio: 'Fictional automated test student.', teachingSkills: [{ skillId: teaching, proficiency: 'ADVANCED' }], learningSkills: [learning], availability: hours.map(hour => ({ day: 0, hour })) });
async function mutate(agent: Agent, method: 'post' | 'put' | 'delete', path: string, body: object = {}) {
  const csrf = await agent.get('/api/auth/csrf');
  return agent[method](path).set('Origin', 'http://localhost:5173').set('X-CSRF-Token', csrf.body.token).send(body);
}
function proposal() {
  return { receiverId: 'test-b', message: 'Let’s exchange skills.', sessions: [
    { teacherId: 'test-a', learnerId: 'test-b', skillId: 'python', topic: 'Python basics', startsAt: new Date(Date.now() + 86400000).toISOString(), duration: 45, location: 'CAMPUS', locationDetail: 'University library' },
    { teacherId: 'test-b', learnerId: 'test-a', skillId: 'english', topic: 'English conversation', startsAt: new Date(Date.now() + 2 * 86400000).toISOString(), duration: 30, location: 'ONLINE', locationDetail: 'University Teams' }
  ] };
}
beforeAll(async () => {
  if (new URL(process.env.DATABASE_URL!).pathname !== '/komek_test') throw new Error('Tests require the isolated komek_test database.');
  await db.$executeRawUnsafe('TRUNCATE TABLE "User", "Skill" CASCADE');
  await db.skill.createMany({ data: [{ id: 'python', name: 'Python', category: 'Programming' }, { id: 'english', name: 'English', category: 'Languages' }, { id: 'sql', name: 'SQL', category: 'Programming' }] });
  const passwordHash = await bcrypt.hash(password, 12);
  for (const id of ['a', 'b', 'c']) {
    await db.user.create({ data: { id: `test-${id}`, email: `${id}@students.example.test`, passwordHash, emailVerifiedAt: new Date(), profile: { create: { fullName: `Test Student ${id.toUpperCase()}` } } } });
    const agent = { a, b, c }[id as 'a' | 'b' | 'c'];
    expect((await mutate(agent, 'post', '/api/auth/login', { email: `${id}@students.example.test`, password })).status).toBe(200);
  }
});
afterAll(async () => { await db.$disconnect(); });

test('US-01 rejects invalid university domains and weak passwords', async () => {
  expect((await mutate(a, 'post', '/api/auth/register', { email: 'student@gmail.com', password, fullName: 'New Student' })).status).toBe(400);
  expect((await mutate(a, 'post', '/api/auth/register', { email: 'student@students.example.test', password: 'weak', fullName: 'New Student' })).status).toBe(400);
});
test('US-01 register, receive SMTP verification, consume token, login and logout', async () => {
  const agent = request.agent(app);
  const email = 'registered@students.example.test';
  expect((await mutate(agent, 'post', '/api/auth/register', { email, password, fullName: 'Registered Student' })).status).toBe(201);
  expect((await mutate(agent, 'post', '/api/auth/login', { email, password })).status).toBe(403);
  const messages = await (await fetch('http://localhost:8025/api/v1/messages')).json() as { messages: { ID: string; To: { Address: string }[] }[] };
  const message = messages.messages.find(m => m.To.some(t => t.Address === email));
  expect(message).toBeDefined();
  const mail = await (await fetch(`http://localhost:8025/api/v1/message/${message!.ID}`)).json() as { Text: string };
  const token = mail.Text.match(/token=([a-f0-9]{64})/)![1];
  expect((await mutate(agent, 'post', '/api/auth/verify-email', { token })).status).toBe(200);
  expect((await mutate(agent, 'post', '/api/auth/verify-email', { token })).status).toBe(400);
  const login = await mutate(agent, 'post', '/api/auth/login', { email, password });
  expect(login.status).toBe(200);
  expect(login.headers['set-cookie'][0]).toContain('HttpOnly');
  expect(login.headers['set-cookie'][0]).toContain('SameSite=Lax');
  expect((await agent.get('/api/auth/me')).status).toBe(200);
  expect((await mutate(agent, 'post', '/api/auth/logout')).status).toBe(200);
  expect((await agent.get('/api/auth/me')).status).toBe(401);
  expect((await mutate(agent, 'post', '/api/auth/register', { email, password, fullName: 'Duplicate Student' })).status).toBe(409);
});
test('protected endpoints require authentication; CSRF and hostile origins are rejected', async () => {
  expect((await request(app).get('/api/matches')).status).toBe(401);
  expect((await a.post('/api/auth/logout').send({})).status).toBe(403);
  const csrf = await a.get('/api/auth/csrf');
  expect((await a.post('/api/auth/logout').set('X-CSRF-Token', csrf.body.token).set('Origin', 'https://hostile.example').send({})).status).toBe(403);
});
test('US-02/03/04 persist profiles, teaching, learning, and availability', async () => {
  expect((await mutate(a, 'put', '/api/profiles/me', profile('Student A', 'python', 'english'))).status).toBe(200);
  expect((await mutate(b, 'put', '/api/profiles/me', profile('Student B', 'english', 'python'))).status).toBe(200);
  expect((await mutate(c, 'put', '/api/profiles/me', profile('Student C', 'english', 'sql', [10]))).status).toBe(200);
  const saved = await a.get('/api/profiles/me');
  expect(saved.body.teachingSkills[0].skill.name).toBe('Python');
  expect(saved.body.learningSkills[0].skill.name).toBe('English');
  expect(saved.body.availability).toHaveLength(2);
  expect((await mutate(a, 'put', '/api/profiles/me', { ...profile('Student A', 'python', 'english'), learningSkills: ['missing'] })).status).toBe(400);
  expect((await a.get('/api/profiles/me')).body.learningSkills[0].skillId).toBe('english');
});
test('US-05 creates custom tags without case-insensitive duplicates', async () => {
  const body = { name: 'Video Editing', category: 'Career and Soft Skills' };
  const first = await mutate(a, 'post', '/api/skills', body);
  const second = await mutate(b, 'post', '/api/skills', { ...body, name: 'video editing' });
  expect(first.status).toBe(201);
  expect(second.body.id).toBe(first.body.id);
});
test('US-06 requires reciprocal skills, excludes self, and ranks by overlap', async () => {
  const first = await a.get('/api/matches');
  expect(first.body.items.map((u: { id: string }) => u.id)).toEqual(['test-b']);
  await mutate(c, 'put', '/api/profiles/me', profile('Student C', 'english', 'python', [10]));
  const ranked = await a.get('/api/matches');
  expect(ranked.body.items.map((u: { id: string }) => u.id)).toEqual(['test-b', 'test-c']);
  expect(ranked.body.items.map((u: { overlapHours: number }) => u.overlapHours)).toEqual([2, 1]);
  expect(ranked.body.items[0].email).toBeUndefined();
  expect(ranked.body.items[0].passwordHash).toBeUndefined();
});
test('US-16 blocking is reciprocal for discovery and prevents proposals', async () => {
  expect((await mutate(a, 'post', '/api/users/test-c/block')).status).toBe(201);
  expect((await a.get('/api/matches')).body.items.map((u: { id: string }) => u.id)).not.toContain('test-c');
  expect((await c.get('/api/matches')).body.items.map((u: { id: string }) => u.id)).not.toContain('test-a');
  expect((await c.get('/api/users/test-a')).status).toBe(404);
  expect((await mutate(a, 'post', '/api/exchanges', { ...proposal(), receiverId: 'test-c', sessions: proposal().sessions.map(s => ({ ...s, teacherId: s.teacherId === 'test-b' ? 'test-c' : s.teacherId, learnerId: s.learnerId === 'test-b' ? 'test-c' : s.learnerId })) })).status).toBe(404);
});
test('discovery filters real reciprocal candidates before pagination and exposes no invented ratings', async () => {
  const found = await a.get('/api/matches?q=student%20b&category=Languages&proficiency=ADVANCED&minOverlap=2&limit=1');
  expect(found.status).toBe(200);
  expect(found.body.total).toBe(1);
  expect(found.body.items[0].id).toBe('test-b');
  expect(found.body.items[0].averageRating).toBeNull();
  expect(found.body.items[0].reviewCount).toBe(0);
  expect((await a.get('/api/matches?category=Programming')).body.total).toBe(0);
  expect((await a.get('/api/matches?proficiency=BEGINNER')).body.total).toBe(0);
  expect((await a.get('/api/matches?minOverlap=3')).body.total).toBe(0);
  expect((await a.get('/api/matches?category=unknown')).status).toBe(400);
  await db.userLearningSkill.create({ data: { userId: 'test-a', skillId: 'sql' } });
  await db.userTeachingSkill.create({ data: { userId: 'test-b', skillId: 'sql', proficiency: 'BEGINNER' } });
  expect((await a.get('/api/matches?category=Programming&proficiency=ADVANCED')).body.total).toBe(0);
  expect((await a.get('/api/matches?category=Programming&proficiency=BEGINNER')).body.total).toBe(1);
  await db.userLearningSkill.delete({ where: { userId_skillId: { userId: 'test-a', skillId: 'sql' } } });
  await db.userTeachingSkill.delete({ where: { userId_skillId: { userId: 'test-b', skillId: 'sql' } } });
  const catalogue = await request(app).get('/api/catalogue');
  expect(catalogue.status).toBe(200);
  expect(catalogue.body.some((s: { name: string }) => s.name === 'Python')).toBe(true);
});
test('US-09 requires exactly two sessions, opposite directions, correct durations and non-overlap', async () => {
  const data = proposal();
  expect((await mutate(a, 'post', '/api/exchanges', { ...data, sessions: [data.sessions[0]] })).status).toBe(400);
  expect((await mutate(a, 'post', '/api/exchanges', { ...data, sessions: [data.sessions[0], data.sessions[0]] })).status).toBe(400);
  expect((await mutate(a, 'post', '/api/exchanges', { ...data, sessions: data.sessions.map(s => ({ ...s, duration: 60 })) })).status).toBe(400);
  expect((await mutate(a, 'post', '/api/exchanges', { ...data, sessions: data.sessions.map(s => ({ ...s, startsAt: data.sessions[0].startsAt })) })).status).toBe(400);
  const created = await mutate(a, 'post', '/api/exchanges', data);
  expect(created.status).toBe(201);
  exchange = created.body;
  expect(exchange.sessions).toHaveLength(2);
  expect(exchange.sessions[0].teacherId).toBe(exchange.sessions[1].learnerId);
});
test('US-10 rejects sender and unrelated student responses', async () => {
  expect((await mutate(a, 'post', `/api/exchanges/${exchange.id}/respond`, { decision: 'ACCEPT' })).status).toBe(403);
  expect((await mutate(c, 'post', `/api/exchanges/${exchange.id}/respond`, { decision: 'ACCEPT' })).status).toBe(404);
  expect((await c.get(`/api/exchanges/${exchange.id}`)).status).toBe(404);
});
test('US-10 reschedule switches responder and persists both new session times', async () => {
  const schedules = proposal().sessions.map((s, i) => ({ startsAt: new Date(Date.now() + (5 + i) * 86400000).toISOString(), duration: s.duration, location: s.location, locationDetail: s.locationDetail }));
  const response = await mutate(b, 'post', `/api/exchanges/${exchange.id}/reschedule`, { note: 'Could we meet next week instead?', sessions: schedules });
  expect(response.status).toBe(200);
  expect(response.body.nextResponderId).toBe('test-a');
  expect(response.body.sessions.map((s: { startsAt: string }) => s.startsAt)).toEqual(schedules.map(s => s.startsAt));
  expect((await mutate(b, 'post', `/api/exchanges/${exchange.id}/respond`, { decision: 'ACCEPT' })).status).toBe(403);
  expect((await mutate(a, 'post', `/api/exchanges/${exchange.id}/respond`, { decision: 'ACCEPT' })).body.status).toBe('ACCEPTED');
  expect((await mutate(a, 'post', `/api/exchanges/${exchange.id}/respond`, { decision: 'DECLINE' })).status).toBe(409);
});
test('US-12 rejects confirmation before scheduled end and unrelated students', async () => {
  expect((await mutate(a, 'post', `/api/sessions/${exchange.sessions[0].id}/confirm`)).status).toBe(409);
  expect((await mutate(c, 'post', `/api/sessions/${exchange.sessions[0].id}/confirm`)).status).toBe(404);
  await db.exchangeSession.updateMany({ where: { exchangeId: exchange.id }, data: { startsAt: new Date(Date.now() - 2 * 86400000) } });
});
test('US-14 rejects reviews before mutual session confirmation', async () => {
  expect((await mutate(a, 'post', '/api/reviews', { sessionId: exchange.sessions[0].id, rating: 5, text: 'Helpful!' })).status).toBe(409);
});
test('US-12 one confirmation does not complete a session; retries are idempotent', async () => {
  const result = await mutate(a, 'post', `/api/sessions/${exchange.sessions[0].id}/confirm`);
  expect(result.status).toBe(200);
  expect(result.body.status).toBe('IN_PROGRESS');
  expect(result.body.sessions[0].confirmations).toHaveLength(1);
  expect(result.body.sessions[0].completedAt).toBeNull();
  await mutate(a, 'post', `/api/sessions/${exchange.sessions[0].id}/confirm`);
  expect(await db.sessionConfirmation.count({ where: { sessionId: exchange.sessions[0].id } })).toBe(1);
});
test('US-12/13 two confirmations complete one session, but not the whole exchange', async () => {
  const result = await mutate(b, 'post', `/api/sessions/${exchange.sessions[0].id}/confirm`);
  expect(result.body.sessions[0].completedAt).not.toBeNull();
  expect(result.body.sessions[1].completedAt).toBeNull();
  expect(result.body.status).toBe('IN_PROGRESS');
});
test('US-14 allows reviews after a confirmed session and rejects duplicates or invalid ratings', async () => {
  const body = { sessionId: exchange.sessions[0].id, rating: 5, text: 'Excellent explanations.', tags: ['Patient'] };
  expect((await mutate(a, 'post', '/api/reviews', { ...body, rating: 6 })).status).toBe(400);
  expect((await mutate(a, 'post', '/api/reviews', body)).status).toBe(201);
  expect((await mutate(a, 'post', '/api/reviews', body)).status).toBe(409);
  expect((await b.get('/api/users/test-b')).body.reviews[0].text).toBe(body.text);
});
test('US-13 concurrent confirmations complete the exchange only after both sessions are mutual', async () => {
  const results = await Promise.all([mutate(a, 'post', `/api/sessions/${exchange.sessions[1].id}/confirm`), mutate(b, 'post', `/api/sessions/${exchange.sessions[1].id}/confirm`)]);
  expect(results.map(r => r.status)).toEqual([200, 200]);
  const result = await a.get(`/api/exchanges/${exchange.id}`);
  expect(result.body.status).toBe('COMPLETED');
  expect(result.body.sessions.every((s: { completedAt: string; confirmations: unknown[] }) => s.completedAt && s.confirmations.length === 2)).toBe(true);
  expect((await mutate(a, 'post', `/api/exchanges/${exchange.id}/cancel`)).status).toBe(409);
  expect((await mutate(a, 'post', `/api/exchanges/${exchange.id}/reschedule`, { note: 'Changed times', sessions: proposal().sessions })).status).toBe(409);
});
test('TS-02 notifications are persisted and can be marked read only by their owner', async () => {
  const notifications = await b.get('/api/notifications');
  expect(notifications.body.items.some((n: { type: string }) => n.type === 'COMPLETED')).toBe(true);
  expect(notifications.body.unread).toBeGreaterThan(0);
  expect((await mutate(b, 'post', '/api/notifications/read')).status).toBe(200);
  expect((await b.get('/api/notifications')).body.unread).toBe(0);
});
test('review views, activity totals, and exchange groups reflect persisted confirmations and reviews', async () => {
  const pending = await a.get('/api/reviews?view=pending');
  expect(pending.status).toBe(200);
  expect(pending.body.items.map((s: { id: string }) => s.id)).toEqual([exchange.sessions[1].id]);
  const given = await a.get('/api/reviews?view=given');
  expect(given.body.total).toBe(1);
  expect(given.body.items[0].subject.id).toBe('test-b');
  const received = await b.get('/api/reviews?view=received');
  expect(received.body.items[0].rating).toBe(5);
  expect(received.body.items[0].author.id).toBe('test-a');
  expect((await c.get('/api/reviews?view=received')).body.total).toBe(0);
  expect((await a.get('/api/stats')).body).toEqual({ active: 0, completed: 1, pending: 0 });
  expect((await a.get('/api/exchanges?group=completed')).body.items[0].id).toBe(exchange.id);
  expect((await a.get('/api/exchanges?group=active')).body.total).toBe(0);
  const rated = await a.get('/api/matches');
  expect(rated.body.items[0].averageRating).toBe(5);
  expect(rated.body.items[0].reviewCount).toBe(1);
});
test('US-16 reports are private and admin-only operations reject students', async () => {
  expect((await mutate(a, 'post', '/api/users/test-b/report', { reason: 'Fictional report for automated testing.' })).status).toBe(201);
  expect((await a.get('/api/admin/reports')).status).toBe(403);
  await db.user.update({ where: { id: 'test-c' }, data: { role: 'ADMIN' } });
  const reports = await c.get('/api/admin/reports');
  expect(reports.status).toBe(200);
  expect(reports.body.items).toHaveLength(1);
  const id = reports.body.items[0].id;
  expect((await mutate(a, 'post', `/api/admin/reports/${id}`, { status: 'RESOLVED' })).status).toBe(403);
  expect((await mutate(c, 'post', `/api/admin/reports/${id}`, { status: 'RESOLVED' })).status).toBe(200);
});
test('database and login sessions survive a new application instance', async () => {
  const login = await mutate(a, 'post', '/api/auth/login', { email: 'a@students.example.test', password });
  const cookie = login.headers['set-cookie'][0].split(';')[0];
  const restarted = request(createApp());
  const response = await restarted.get(`/api/exchanges/${exchange.id}`).set('Cookie', cookie);
  expect(response.status).toBe(200);
  expect(response.body.status).toBe('COMPLETED');
  expect((await restarted.get('/api/auth/me').set('Cookie', cookie)).body.teachingSkills[0].skillId).toBe('python');
});
test('blocking cancels active proposals and prevents contact via existing exchanges', async () => {
  const created = await mutate(a, 'post', '/api/exchanges', proposal());
  expect(created.status).toBe(201);
  expect((await mutate(b, 'post', '/api/users/test-a/block')).status).toBe(201);
  expect((await a.get(`/api/exchanges/${created.body.id}`)).status).toBe(404);
  expect((await mutate(a, 'post', `/api/exchanges/${created.body.id}/reschedule`, { note: 'Trying again', sessions: proposal().sessions })).status).toBe(404);
  expect((await db.exchange.findUniqueOrThrow({ where: { id: created.body.id } })).status).toBe('CANCELLED');
});

test('fictional development accounts and their sessions are rejected in production', async () => {
  await db.user.update({ where: { id: 'test-a' }, data: { fictional: true } });
  config.NODE_ENV = 'production';
  try {
    expect((await a.get('/api/auth/me')).status).toBe(401);
    expect((await mutate(a, 'post', '/api/auth/login', { email: 'a@students.example.test', password })).status).toBe(401);
  } finally {
    config.NODE_ENV = 'test';
    await db.user.update({ where: { id: 'test-a' }, data: { fictional: false } });
  }
});
