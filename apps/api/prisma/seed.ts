import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'node:path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
const db = new PrismaClient();
const catalogue: Record<string, string[]> = {
  Programming: ['Python', 'JavaScript', 'TypeScript', 'Java', 'C++', 'React', 'HTML & CSS', 'Git', 'SQL', 'Algorithms'],
  Languages: ['English', 'Kazakh', 'Russian', 'Turkish', 'German', 'French', 'Korean', 'Chinese', 'Spanish', 'Academic Writing'],
  'Data and Office': ['Excel', 'Google Sheets', 'Power BI', 'Tableau', 'Data Analysis', 'Statistics', 'Notion', 'Figma', 'PowerPoint', 'Research Methods'],
  'Career and Soft Skills': ['Public Speaking', 'CV Writing', 'Interview Preparation', 'Time Management', 'Teamwork', 'Leadership', 'Project Management', 'Critical Thinking', 'Networking', 'Presentation Design']
};
const skillId = (name: string) => `skill-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.DEV_SEED === 'true') throw new Error('Fictional student seeding is forbidden in production.');
  for (const [category, names] of Object.entries(catalogue)) for (const name of names) await db.skill.upsert({ where: { name }, create: { id: skillId(name), name, category }, update: {} });
  if (process.env.DEV_SEED !== 'true' || process.env.NODE_ENV === 'production') return;
  if (process.env.NODE_ENV !== 'development') throw new Error('Fictional seed users require NODE_ENV=development.');
  const { loadDemoCredentials } = await import('../../../scripts/demo-credentials.cjs');
  const credentials = loadDemoCredentials() as { email: string; password: string }[];
  const students = [
    { id: 'aitu-demo01', fullName: 'Amina Sadykova', email: credentials[0].email, password: credentials[0].password, faculty: 'Software Engineering', bio: 'I love turning ideas into small Python projects. Let’s build something useful together while I practise my conversational English.', teach: ['Python', 'Figma'], learn: ['English', 'Public Speaking'], year: 2 },
    { id: 'aitu-demo02', fullName: 'Daniyar Omarov', email: credentials[1].email, password: credentials[1].password, faculty: 'Digital Journalism', bio: 'Debate club regular and language enthusiast. I can help you feel more confident in English — you can help me take my first steps in Python.', teach: ['English', 'Public Speaking'], learn: ['Python', 'SQL'], year: 3 }
  ];
  for (const s of students) {
    const existing = await db.user.findUnique({ where: { email: s.email } });
    if (existing && !existing.fictional) throw new Error('Refusing to overwrite a non-fictional account with a seed identity.');
    const passwordHash = await bcrypt.hash(s.password, 12);
    await db.user.upsert({ where: { email: s.email }, update: { passwordHash }, create: {
      id: s.id, email: s.email, passwordHash, emailVerifiedAt: new Date(), fictional: true,
      profile: { create: { fullName: s.fullName, faculty: s.faculty, studyYear: s.year, bio: s.bio } },
      teachingSkills: { create: s.teach.map(name => ({ skillId: skillId(name), proficiency: 'ADVANCED' })) },
      learningSkills: { create: s.learn.map(name => ({ skillId: skillId(name) })) },
      availability: { create: [0, 2, 4].flatMap(day => [10, 11, 12].map(hour => ({ day, hour }))) }
    } });
  }
  console.log('Seed ready: 40 catalogue skills and two fictional AITU development users. No verification messages sent.');
}
main().finally(() => db.$disconnect()).catch(error => { console.error(error); process.exitCode = 1; });
