import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { db, publicUserSelect, transaction } from './db';
import { route, ApiError } from './http';
import { pagingSchema, profileSchema } from './validation';
import { sendNotice } from './mail';

export async function blockedIds(userId: string) {
  const blocks = await db.userBlock.findMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } });
  return blocks.map(b => b.blockerId === userId ? b.blockedId : b.blockerId);
}
export async function ensureUnblocked(a: string, b: string, tx: Pick<PrismaClient, 'userBlock'> = db) {
  if (await tx.userBlock.findFirst({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] } })) throw new ApiError(404, 'Student is unavailable.');
}
export const peopleRouter = Router();
peopleRouter.get('/stats', route(async (req, res) => {
  const excluded = await blockedIds(req.user.id);
  const visible = { OR: [{ senderId: req.user.id }, { receiverId: req.user.id }], senderId: { notIn: excluded }, receiverId: { notIn: excluded } };
  const [active, completed, pending] = await Promise.all([
    db.exchange.count({ where: { ...visible, status: { in: ['ACCEPTED', 'IN_PROGRESS'] } } }),
    db.exchange.count({ where: { ...visible, status: 'COMPLETED' } }),
    db.exchange.count({ where: { ...visible, status: 'PROPOSED', nextResponderId: req.user.id } })
  ]);
  res.json({ active, completed, pending });
}));
peopleRouter.get('/skills', route(async (req, res) => {
  const query = z.string().max(80).optional().parse(req.query.q);
  res.json(await db.skill.findMany({ where: query ? { name: { contains: query, mode: 'insensitive' } } : {}, orderBy: [{ category: 'asc' }, { name: 'asc' }], take: 500 }));
}));
peopleRouter.post('/skills', route(async (req, res) => {
  const input = z.object({ name: z.string().trim().min(2).max(40), category: z.enum(['Programming', 'Languages', 'Data and Office', 'Career and Soft Skills']) }).parse(req.body);
  const existing = await db.skill.findFirst({ where: { name: { equals: input.name, mode: 'insensitive' } } });
  if (existing) return res.json(existing);
  res.status(201).json(await db.skill.create({ data: { ...input, custom: true } }));
}));
peopleRouter.get('/profiles/me', route(async (req, res) => {
  res.json(await db.user.findUniqueOrThrow({ where: { id: req.user.id }, select: publicUserSelect }));
}));
peopleRouter.put('/profiles/me', route(async (req, res) => {
  const input = profileSchema.parse(req.body);
  const ids = [...new Set([...input.teachingSkills.map(s => s.skillId), ...input.learningSkills])];
  if (await db.skill.count({ where: { id: { in: ids } } }) !== ids.length) throw new ApiError(400, 'One or more skills do not exist.');
  await transaction(async tx => {
    await tx.profile.upsert({ where: { userId: req.user.id }, create: { userId: req.user.id, fullName: input.fullName, faculty: input.faculty, studyYear: input.studyYear, bio: input.bio }, update: { fullName: input.fullName, faculty: input.faculty, studyYear: input.studyYear, bio: input.bio } });
    await tx.userTeachingSkill.deleteMany({ where: { userId: req.user.id } });
    await tx.userLearningSkill.deleteMany({ where: { userId: req.user.id } });
    await tx.availabilitySlot.deleteMany({ where: { userId: req.user.id } });
    await tx.userTeachingSkill.createMany({ data: input.teachingSkills.map(s => ({ ...s, userId: req.user.id })) });
    await tx.userLearningSkill.createMany({ data: input.learningSkills.map(skillId => ({ skillId, userId: req.user.id })) });
    await tx.availabilitySlot.createMany({ data: input.availability.map(s => ({ ...s, userId: req.user.id })) });
  });
  res.json(await db.user.findUniqueOrThrow({ where: { id: req.user.id }, select: publicUserSelect }));
}));
peopleRouter.get('/users/:id', route(async (req, res) => {
  await ensureUnblocked(req.user.id, req.params.id);
  const user = await db.user.findFirst({ where: { id: req.params.id, emailVerifiedAt: { not: null } }, select: publicUserSelect });
  if (!user) throw new ApiError(404, 'Student not found.');
  const excluded = await blockedIds(req.user.id);
  const where = { subjectId: user.id, authorId: { notIn: excluded } };
  const [reviews, ratings] = await Promise.all([db.review.findMany({ where, include: { author: { select: { id: true, profile: { select: { fullName: true } } } } }, orderBy: { createdAt: 'desc' }, take: 50 }), db.review.aggregate({ where, _avg: { rating: true }, _count: { rating: true } })]);
  res.json({ ...user, reviews, averageRating: ratings._avg.rating, reviewCount: ratings._count.rating });
}));
peopleRouter.get('/matches', route(async (req, res) => {
  const { page, limit } = pagingSchema.parse(req.query);
  const me = await db.user.findUniqueOrThrow({ where: { id: req.user.id }, select: publicUserSelect });
  const filters = z.object({ q: z.string().trim().max(100).default(''), category: z.enum(['Programming', 'Languages', 'Data and Office', 'Career and Soft Skills']).optional(), proficiency: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(), minOverlap: z.coerce.number().int().min(0).max(168).default(0) }).parse(req.query);
  const excluded = await blockedIds(me.id);
  const candidates = await db.user.findMany({ where: {
    id: { notIn: [me.id, ...excluded] }, emailVerifiedAt: { not: null },
    teachingSkills: { some: { skillId: { in: me.learningSkills.map(s => s.skillId) } } },
    learningSkills: { some: { skillId: { in: me.teachingSkills.map(s => s.skillId) } } }
  }, select: publicUserSelect });
  const slots = new Set(me.availability.map(s => `${s.day}:${s.hour}`));
  const results = candidates.map(user => ({ ...user,
    overlapHours: user.availability.filter(s => slots.has(`${s.day}:${s.hour}`)).length,
    youCanLearn: user.teachingSkills.filter(s => me.learningSkills.some(l => l.skillId === s.skillId)),
    youCanTeach: me.teachingSkills.filter(s => user.learningSkills.some(l => l.skillId === s.skillId))
  })).filter(user => user.overlapHours >= filters.minOverlap && user.youCanLearn.some(s => (!filters.category || s.skill.category === filters.category) && (!filters.proficiency || s.proficiency === filters.proficiency)) && (!filters.q || [user.profile?.fullName, user.profile?.faculty, ...user.teachingSkills.map(s => s.skill.name), ...user.learningSkills.map(s => s.skill.name)].join(' ').toLowerCase().includes(filters.q.toLowerCase()))).sort((a, b) => b.overlapHours - a.overlapHours || (a.profile?.fullName ?? '').localeCompare(b.profile?.fullName ?? '') || a.id.localeCompare(b.id));
  const items = results.slice((page - 1) * limit, page * limit);
  const ratings = await db.review.groupBy({ by: ['subjectId'], where: { subjectId: { in: items.map(u => u.id) }, authorId: { notIn: excluded } }, _avg: { rating: true }, _count: { rating: true } });
  res.json({ items: items.map(user => { const rating = ratings.find(r => r.subjectId === user.id); return { ...user, averageRating: rating?._avg.rating ?? null, reviewCount: rating?._count.rating ?? 0 }; }), total: results.length, page, limit });
}));
peopleRouter.post('/users/:id/block', route(async (req, res) => {
  if (req.user.id === req.params.id) throw new ApiError(400, 'You cannot block yourself.');
  if (!await db.user.findUnique({ where: { id: req.params.id } })) throw new ApiError(404, 'Student not found.');
  await transaction(async tx => {
    await tx.userBlock.upsert({ where: { blockerId_blockedId: { blockerId: req.user.id, blockedId: req.params.id } }, create: { blockerId: req.user.id, blockedId: req.params.id }, update: {} });
    await tx.exchange.updateMany({ where: { status: { in: ['PROPOSED', 'ACCEPTED', 'IN_PROGRESS', 'DISPUTED'] }, OR: [{ senderId: req.user.id, receiverId: req.params.id }, { receiverId: req.user.id, senderId: req.params.id }] }, data: { status: 'CANCELLED' } });
  });
  res.status(201).json({ message: 'Student blocked. Active exchanges have been cancelled.' });
}));
peopleRouter.get('/blocks', route(async (req, res) => {
  res.json(await db.userBlock.findMany({ where: { blockerId: req.user.id }, select: { blockedId: true, blocked: { select: { profile: { select: { fullName: true } } } } } }));
}));
peopleRouter.delete('/users/:id/block', route(async (req, res) => {
  await db.userBlock.deleteMany({ where: { blockerId: req.user.id, blockedId: req.params.id } });
  res.json({ message: 'Student unblocked.' });
}));
peopleRouter.post('/users/:id/report', route(async (req, res) => {
  const { reason } = z.object({ reason: z.string().trim().min(10).max(1000) }).parse(req.body);
  if (req.params.id === req.user.id) throw new ApiError(400, 'You cannot report yourself.');
  if (!await db.user.findUnique({ where: { id: req.params.id } })) throw new ApiError(404, 'Student not found.');
  await db.userReport.create({ data: { reporterId: req.user.id, reportedId: req.params.id, reason } });
  res.status(201).json({ message: 'Report submitted for administrator review.' });
}));
peopleRouter.get('/notifications', route(async (req, res) => {
  const { page, limit } = pagingSchema.parse(req.query);
  const where = { userId: req.user.id };
  const [items, total, unread] = await Promise.all([
    db.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    db.notification.count({ where }), db.notification.count({ where: { ...where, readAt: null } })
  ]);
  res.json({ items, total, unread, page, limit });
}));
peopleRouter.post('/notifications/read', route(async (req, res) => {
  const { id } = z.object({ id: z.string().optional() }).parse(req.body);
  await db.notification.updateMany({ where: { userId: req.user.id, ...(id ? { id } : {}), readAt: null }, data: { readAt: new Date() } });
  res.json({ message: 'Notifications marked as read.' });
}));
peopleRouter.get('/admin/reports', route(async (req, res) => {
  if (req.user.role !== 'ADMIN') throw new ApiError(403, 'Administrator access required.');
  const { page, limit } = pagingSchema.parse(req.query);
  const where = { status: z.enum(['OPEN', 'RESOLVED', 'DISMISSED']).default('OPEN').parse(req.query.status) };
  const [items, total] = await Promise.all([db.userReport.findMany({ where, include: { reporter: { select: { id: true, profile: true } }, reported: { select: { id: true, profile: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }), db.userReport.count({ where })]);
  res.json({ items, total, page, limit });
}));
peopleRouter.post('/admin/reports/:id', route(async (req, res) => {
  if (req.user.role !== 'ADMIN') throw new ApiError(403, 'Administrator access required.');
  const { status } = z.object({ status: z.enum(['RESOLVED', 'DISMISSED']) }).parse(req.body);
  res.json(await db.userReport.update({ where: { id: req.params.id }, data: { status } }));
}));
export async function emailNotice(userId: string, title: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (user) await sendNotice(user.email, title).catch(() => console.error('Notification email delivery failed.'));
}
