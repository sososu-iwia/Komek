import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db, exchangeInclude, transaction } from './db';
import { ApiError, route } from './http';
import { emailNotice, ensureUnblocked, blockedIds } from './people';
import { overlappingSessions, pagingSchema, proposalSchema, rescheduleSchema, reviewSchema } from './validation';

type Tx = Prisma.TransactionClient;
async function exchangeFor(tx: Tx, id: string, userId: string) {
  const exchange = await tx.exchange.findUnique({ where: { id }, include: exchangeInclude });
  if (!exchange || ![exchange.senderId, exchange.receiverId].includes(userId)) throw new ApiError(404, 'Exchange not found.');
  await ensureUnblocked(exchange.senderId, exchange.receiverId, tx);
  return exchange;
}
async function notify(tx: Tx, userId: string, type: string, title: string, exchangeId: string) {
  await tx.notification.create({ data: { userId, type, title, exchangeId } });
}
export const exchangeRouter = Router();
exchangeRouter.post('/exchanges', route(async (req, res) => {
  const input = proposalSchema.parse(req.body);
  if (input.receiverId === req.user.id) throw new ApiError(400, 'Choose another student.');
  if (overlappingSessions(input.sessions)) throw new ApiError(400, 'The two sessions cannot overlap.');
  const expected = [[req.user.id, input.receiverId], [input.receiverId, req.user.id]];
  input.sessions.forEach((s, i) => {
    if (s.teacherId !== expected[i][0] || s.learnerId !== expected[i][1]) throw new ApiError(400, 'Include exactly two sessions in opposite teaching directions, with the proposer teaching first.');
  });
  const exchange = await transaction(async tx => {
    await ensureUnblocked(req.user.id, input.receiverId, tx);
    const receiver = await tx.user.findUnique({ where: { id: input.receiverId } });
    if (!receiver?.emailVerifiedAt) throw new ApiError(404, 'Student not found.');
    for (const s of input.sessions) {
      const [teaching, learning] = await Promise.all([
        tx.userTeachingSkill.findUnique({ where: { userId_skillId: { userId: s.teacherId, skillId: s.skillId } } }),
        tx.userLearningSkill.findUnique({ where: { userId_skillId: { userId: s.learnerId, skillId: s.skillId } } })
      ]);
      if (!teaching || !learning) throw new ApiError(400, 'Both students must have reciprocal teaching and learning skills.');
    }
    const created = await tx.exchange.create({ data: {
      senderId: req.user.id, receiverId: input.receiverId, nextResponderId: input.receiverId, message: input.message,
      sessions: { create: input.sessions.map((s, i) => ({ ...s, startsAt: new Date(s.startsAt), ordinal: i + 1 })) }
    }, include: exchangeInclude });
    await notify(tx, input.receiverId, 'PROPOSAL', 'You have a new skill exchange proposal', created.id);
    return created;
  });
  void emailNotice(input.receiverId, 'You have a new skill exchange proposal');
  res.status(201).json(exchange);
}));
exchangeRouter.get('/exchanges', route(async (req, res) => {
  const { page, limit } = pagingSchema.parse(req.query);
  const excluded = await blockedIds(req.user.id);
  const status = z.enum(['PROPOSED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'DECLINED', 'CANCELLED', 'DISPUTED']).optional().parse(req.query.status);
  const group = z.enum(['all', 'pending', 'active', 'completed', 'declined']).default('all').parse(req.query.group);
  const groups = { all: undefined, pending: ['PROPOSED'], active: ['ACCEPTED', 'IN_PROGRESS', 'DISPUTED'], completed: ['COMPLETED'], declined: ['DECLINED', 'CANCELLED'] } as const;
  const statuses = groups[group];
  const where: Prisma.ExchangeWhereInput = { OR: [{ senderId: req.user.id }, { receiverId: req.user.id }], senderId: { notIn: excluded }, receiverId: { notIn: excluded }, ...(status ? { status } : statuses ? { status: { in: [...statuses] } } : {}) };
  const [items, total] = await Promise.all([db.exchange.findMany({ where, include: exchangeInclude, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * limit, take: limit }), db.exchange.count({ where })]);
  res.json({ items, total, page, limit });
}));
exchangeRouter.get('/exchanges/:id', route(async (req, res) => {
  res.json(await transaction(tx => exchangeFor(tx, req.params.id, req.user.id)));
}));
exchangeRouter.post('/exchanges/:id/respond', route(async (req, res) => {
  const { decision } = z.object({ decision: z.enum(['ACCEPT', 'DECLINE']) }).parse(req.body);
  const exchange = await transaction(async tx => {
    const current = await exchangeFor(tx, req.params.id, req.user.id);
    if (current.nextResponderId !== req.user.id) throw new ApiError(403, 'Only the student receiving the current proposal can respond.');
    if (current.status !== 'PROPOSED') throw new ApiError(409, 'This proposal has already been decided.');
    if (decision === 'ACCEPT' && current.sessions.some(s => s.startsAt <= new Date())) throw new ApiError(409, 'These times have passed. Suggest new times before accepting.');
    const status = decision === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED';
    const updated = await tx.exchange.update({ where: { id: current.id }, data: { status }, include: exchangeInclude });
    const other = req.user.id === current.senderId ? current.receiverId : current.senderId;
    await notify(tx, other, status, `Your exchange proposal was ${status.toLowerCase()}`, current.id);
    return updated;
  });
  void emailNotice(req.user.id === exchange.senderId ? exchange.receiverId : exchange.senderId, `Exchange ${exchange.status.toLowerCase()}`);
  res.json(exchange);
}));
exchangeRouter.post('/exchanges/:id/reschedule', route(async (req, res) => {
  const input = rescheduleSchema.parse(req.body);
  if (overlappingSessions(input.sessions)) throw new ApiError(400, 'The two sessions cannot overlap.');
  const exchange = await transaction(async tx => {
    const current = await exchangeFor(tx, req.params.id, req.user.id);
    if (!['PROPOSED', 'ACCEPTED'].includes(current.status) || current.sessions.some(s => s.confirmations.length)) throw new ApiError(409, 'This exchange can no longer be rescheduled.');
    for (let i = 0; i < 2; i++) {
      await tx.exchangeSession.update({ where: { id: current.sessions[i].id }, data: { ...input.sessions[i], startsAt: new Date(input.sessions[i].startsAt) } });
    }
    const other = req.user.id === current.senderId ? current.receiverId : current.senderId;
    await notify(tx, other, 'RESCHEDULE', 'New times suggested for your exchange', current.id);
    return tx.exchange.update({ where: { id: current.id }, data: { status: 'PROPOSED', nextResponderId: other, responseNote: input.note }, include: exchangeInclude });
  });
  res.json(exchange);
}));
exchangeRouter.post('/exchanges/:id/cancel', route(async (req, res) => {
  const exchange = await transaction(async tx => {
    const current = await exchangeFor(tx, req.params.id, req.user.id);
    if (!['PROPOSED', 'ACCEPTED', 'IN_PROGRESS', 'DISPUTED'].includes(current.status)) throw new ApiError(409, 'This exchange cannot be cancelled.');
    const other = req.user.id === current.senderId ? current.receiverId : current.senderId;
    await notify(tx, other, 'CANCELLED', 'An exchange was cancelled', current.id);
    return tx.exchange.update({ where: { id: current.id }, data: { status: 'CANCELLED' }, include: exchangeInclude });
  });
  res.json(exchange);
}));
exchangeRouter.post('/exchanges/:id/dispute', route(async (req, res) => {
  const { reason } = z.object({ reason: z.string().trim().min(10).max(1000) }).parse(req.body);
  const exchange = await transaction(async tx => {
    const current = await exchangeFor(tx, req.params.id, req.user.id);
    if (!['ACCEPTED', 'IN_PROGRESS'].includes(current.status)) throw new ApiError(409, 'Only active accepted exchanges can be disputed.');
    const other = req.user.id === current.senderId ? current.receiverId : current.senderId;
    await tx.userReport.create({ data: { reporterId: req.user.id, reportedId: other, reason } });
    await notify(tx, other, 'DISPUTED', 'An exchange is awaiting administrator review', current.id);
    return tx.exchange.update({ where: { id: current.id }, data: { status: 'DISPUTED' }, include: exchangeInclude });
  });
  res.json(exchange);
}));
exchangeRouter.post('/sessions/:id/confirm', route(async (req, res) => {
  const exchange = await transaction(async tx => {
    const session = await tx.exchangeSession.findUnique({ where: { id: req.params.id } });
    if (!session || ![session.teacherId, session.learnerId].includes(req.user.id)) throw new ApiError(404, 'Session not found.');
    const current = await exchangeFor(tx, session.exchangeId, req.user.id);
    if (!['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(current.status)) throw new ApiError(409, 'Only accepted sessions can be confirmed.');
    if (session.startsAt.getTime() + session.duration * 60000 > Date.now()) throw new ApiError(409, 'Confirm after the session has ended.');
    const existing = await tx.sessionConfirmation.findUnique({ where: { sessionId_userId: { sessionId: session.id, userId: req.user.id } } });
    if (!existing) {
      await tx.sessionConfirmation.create({ data: { sessionId: session.id, userId: req.user.id } });
      const other = session.teacherId === req.user.id ? session.learnerId : session.teacherId;
      await notify(tx, other, 'CONFIRMATION', 'Your partner confirmed a session', current.id);
    }
    const count = await tx.sessionConfirmation.count({ where: { sessionId: session.id } });
    if (count === 2 && !session.completedAt) await tx.exchangeSession.update({ where: { id: session.id }, data: { completedAt: new Date() } });
    const sessions = await tx.exchangeSession.findMany({ where: { exchangeId: current.id } });
    const status = sessions.length === 2 && sessions.every(s => s.completedAt) ? 'COMPLETED' : 'IN_PROGRESS';
    if (status === 'COMPLETED' && current.status !== 'COMPLETED') {
      for (const id of [current.senderId, current.receiverId]) await notify(tx, id, 'COMPLETED', 'Exchange complete. Thank you for sharing your skills!', current.id);
    }
    return tx.exchange.update({ where: { id: current.id }, data: { status }, include: exchangeInclude });
  });
  res.json(exchange);
}));
exchangeRouter.get('/reviews', route(async (req, res) => {
  const { page, limit } = pagingSchema.parse(req.query);
  const view = z.enum(['pending', 'given', 'received']).default('pending').parse(req.query.view);
  const excluded = await blockedIds(req.user.id);
  if (view === 'pending') {
    const where: Prisma.ExchangeSessionWhereInput = { completedAt: { not: null }, OR: [{ teacherId: req.user.id }, { learnerId: req.user.id }], reviews: { none: { authorId: req.user.id } }, exchange: { senderId: { notIn: excluded }, receiverId: { notIn: excluded } } };
    const [items, total] = await Promise.all([db.exchangeSession.findMany({ where, include: { skill: true, confirmations: true, reviews: true, exchange: { select: { id: true, sender: exchangeInclude.sender, receiver: exchangeInclude.receiver } } }, orderBy: { completedAt: 'desc' }, skip: (page - 1) * limit, take: limit }), db.exchangeSession.count({ where })]);
    return res.json({ items, total, page, limit });
  }
  const where: Prisma.ReviewWhereInput = { ...(view === 'given' ? { authorId: req.user.id, subjectId: { notIn: excluded } } : { subjectId: req.user.id, authorId: { notIn: excluded } }) };
  const [items, total] = await Promise.all([db.review.findMany({ where, include: { author: exchangeInclude.sender, subject: exchangeInclude.receiver, session: { select: { topic: true, skill: true, exchangeId: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }), db.review.count({ where })]);
  res.json({ items, total, page, limit });
}));
exchangeRouter.post('/reviews', route(async (req, res) => {
  const input = reviewSchema.parse(req.body);
  const review = await transaction(async tx => {
    const session = await tx.exchangeSession.findUnique({ where: { id: input.sessionId }, include: { confirmations: true } });
    if (!session || ![session.teacherId, session.learnerId].includes(req.user.id)) throw new ApiError(404, 'Session not found.');
    const subjectId = session.teacherId === req.user.id ? session.learnerId : session.teacherId;
    await ensureUnblocked(req.user.id, subjectId, tx);
    if (!session.completedAt || session.confirmations.length !== 2) throw new ApiError(409, 'Both students must confirm this session before reviewing.');
    return tx.review.create({ data: { ...input, authorId: req.user.id, subjectId } });
  });
  res.status(201).json(review);
}));
