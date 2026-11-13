import { z } from 'zod';
import { config } from './config';
export const email = z.string().trim().email().max(254).transform(v => v.toLowerCase());
export const registerSchema = z.object({
  email: email.refine(v => config.domains.includes(v.split('@')[1]), 'Use an email from an allowed university domain.'),
  password: z.string().min(10).max(72).regex(/[a-z]/, 'Include a lowercase letter.').regex(/[A-Z]/, 'Include an uppercase letter.').regex(/[0-9]/, 'Include a number.').refine(v => Buffer.byteLength(v, 'utf8') <= 72, 'Password must be at most 72 UTF-8 bytes.'),
  fullName: z.string().trim().min(2).max(80)
});
export const loginSchema = z.object({ email, password: z.string().min(1).max(72).refine(v => Buffer.byteLength(v, 'utf8') <= 72, 'Password must be at most 72 UTF-8 bytes.') });
const unique = <T>(items: T[]) => new Set(items).size === items.length;
export const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(80), faculty: z.string().trim().max(100),
  studyYear: z.number().int().min(1).max(6), bio: z.string().trim().max(500),
  teachingSkills: z.array(z.object({ skillId: z.string().min(1), proficiency: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']) })).max(15).refine(v => unique(v.map(s => s.skillId)), 'Duplicate teaching skill.'),
  learningSkills: z.array(z.string().min(1)).max(15).refine(unique, 'Duplicate learning skill.'),
  availability: z.array(z.object({ day: z.number().int().min(0).max(6), hour: z.number().int().min(0).max(23) })).max(168).refine(v => unique(v.map(s => `${s.day}:${s.hour}`)), 'Duplicate time slot.')
});
export const scheduleSchema = z.object({
  startsAt: z.string().datetime({ offset: true }).refine(v => new Date(v).getTime() > Date.now(), 'Session must start in the future.'),
  duration: z.number().int().min(30).max(45), location: z.enum(['CAMPUS', 'ONLINE']),
  locationDetail: z.string().trim().min(2).max(200)
});
export const sessionSchema = scheduleSchema.extend({ teacherId: z.string().min(1), learnerId: z.string().min(1), skillId: z.string().min(1), topic: z.string().trim().min(2).max(100) });
export const proposalSchema = z.object({ receiverId: z.string().min(1), message: z.string().trim().max(500).default(''), sessions: z.array(sessionSchema).length(2) });
export const rescheduleSchema = z.object({ note: z.string().trim().min(2).max(300), sessions: z.array(scheduleSchema).length(2) });
export const reviewSchema = z.object({ sessionId: z.string().min(1), rating: z.number().int().min(1).max(5), text: z.string().trim().min(1).max(300), tags: z.array(z.string().trim().min(1).max(24)).max(5).default([]) });
export const pagingSchema = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(20) });
export function overlappingSessions(sessions: { startsAt: string; duration: number }[]) {
  const [a, b] = sessions.map(s => ({ start: new Date(s.startsAt).getTime(), end: new Date(s.startsAt).getTime() + s.duration * 60000 }));
  return a.start < b.end && b.start < a.end;
}
