import type { Exchange, User } from './types';
export function profileCompletion(user: User) {
  const fields = [!!user.profile.fullName, !!user.profile.faculty, user.profile.studyYear > 0, !!user.profile.bio, user.teachingSkills.length > 0, user.learningSkills.length > 0, user.availability.length > 0];
  return Math.round(fields.filter(Boolean).length / fields.length * 100);
}
export function exchangePartner(exchange: Exchange, userId: string) { return exchange.senderId === userId ? exchange.receiver : exchange.sender; }
export function localDate(date: Date) { return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
export const skillCategories = ['Programming', 'Languages', 'Data and Office', 'Career and Soft Skills'] as const;
