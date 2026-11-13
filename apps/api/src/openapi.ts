type Schema = Record<string, unknown>;
const string = { type: 'string' };
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const object = (properties: Schema, required: string[] = Object.keys(properties)): Schema => ({ type: 'object', properties, required });
const array = (items: Schema): Schema => ({ type: 'array', items });
const schedule = { startsAt: { type: 'string', format: 'date-time' }, duration: { type: 'integer', minimum: 30, maximum: 45 }, location: { enum: ['CAMPUS', 'ONLINE'] }, locationDetail: { type: 'string', minLength: 2, maxLength: 200 } };
const two = (items: Schema) => ({ type: 'array', minItems: 2, maxItems: 2, items });
const schemas: Schema = {
  Register: object({ email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 10, maxLength: 72 }, fullName: string }),
  Login: object({ email: { type: 'string', format: 'email' }, password: string }),
  Profile: object({ fullName: string, faculty: string, studyYear: { type: 'integer', minimum: 1, maximum: 6 }, bio: { type: 'string', maxLength: 500 }, teachingSkills: array(object({ skillId: string, proficiency: { enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] } })), learningSkills: array(string), availability: array(object({ day: { type: 'integer', minimum: 0, maximum: 6 }, hour: { type: 'integer', minimum: 0, maximum: 23 } })) }),
  Proposal: object({ receiverId: string, message: string, sessions: two(object({ ...schedule, teacherId: string, learnerId: string, skillId: string, topic: string })) }, ['receiverId', 'sessions']),
  Reschedule: object({ note: string, sessions: two(object(schedule)) }),
  Review: object({ sessionId: string, rating: { type: 'integer', minimum: 1, maximum: 5 }, text: { type: 'string', maxLength: 300 }, tags: array(string) }, ['sessionId', 'rating', 'text']),
  Error: object({ error: object({ code: string, message: string }) })
};
const paths: Record<string, Record<string, unknown>> = {};
function endpoint(method: string, path: string, summary: string, body?: Schema, anonymous = false, paginate = false) {
  const parameters: Schema[] = [...path.matchAll(/\{(\w+)\}/g)].map(m => ({ name: m[1], in: 'path', required: true, schema: string }));
  if (method !== 'get') parameters.push({ name: 'X-CSRF-Token', in: 'header', required: true, schema: string, description: 'Token returned by GET /auth/csrf; keep its cookie.' });
  if (paginate) parameters.push({ name: 'page', in: 'query', schema: { type: 'integer', default: 1 } }, { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 50 } });
  paths[path] ??= {};
  paths[path][method] = { summary, tags: [path.split('/')[1]], security: anonymous ? [] : [{ cookieAuth: [] }], parameters, ...(body ? { requestBody: { required: true, content: { 'application/json': { schema: body } } } } : {}), responses: { '200': { description: 'Success' }, '201': { description: 'Created' }, '400': { description: 'Validation error', content: { 'application/json': { schema: ref('Error') } } }, '401': { description: 'Sign-in required' }, '403': { description: 'Forbidden or CSRF mismatch' }, '404': { description: 'Not found or unavailable' }, '409': { description: 'Duplicate or invalid state transition' } } };
}
endpoint('get', '/auth/csrf', 'Create CSRF cookie and return its token', undefined, true);
endpoint('post', '/auth/register', 'Register with a verified AITU university domain', ref('Register'), true);
endpoint('post', '/auth/login', 'Create an HTTP-only session cookie', ref('Login'), true);
endpoint('post', '/auth/logout', 'Revoke current session', object({}), true);
endpoint('post', '/auth/verify-email', 'Consume one-time email verification token', object({ token: string }), true);
endpoint('post', '/auth/resend-verification', 'Resend verification email', object({ email: string }), true);
endpoint('get', '/auth/me', 'Current signed-in student');
endpoint('get', '/catalogue', 'Public skill catalogue', undefined, true);
endpoint('get', '/stats', 'Your active, completed, and pending exchange counts');
endpoint('get', '/skills', 'List skill catalogue');
endpoint('post', '/skills', 'Create a custom skill', object({ name: string, category: { enum: ['Programming', 'Languages', 'Data and Office', 'Career and Soft Skills'] } }));
endpoint('get', '/profiles/me', 'Get your profile');
endpoint('put', '/profiles/me', 'Replace profile, skills, and UTC weekly availability', ref('Profile'));
endpoint('get', '/users/{id}', 'Student profile and latest 50 visible reviews');
endpoint('get', '/matches', 'Reciprocal matches ordered by UTC availability overlap', undefined, false, true);
endpoint('get', '/exchanges', 'List your visible exchanges', undefined, false, true);
endpoint('post', '/exchanges', 'Propose exactly two opposite-direction sessions', ref('Proposal'));
endpoint('get', '/exchanges/{id}', 'Get exchange and both sessions');
endpoint('post', '/exchanges/{id}/respond', 'Accept or decline a pending proposal', object({ decision: { enum: ['ACCEPT', 'DECLINE'] } }));
endpoint('post', '/exchanges/{id}/reschedule', 'Suggest two new times; other participant must respond', ref('Reschedule'));
endpoint('post', '/exchanges/{id}/cancel', 'Cancel an active exchange', object({}));
endpoint('post', '/exchanges/{id}/dispute', 'Dispute an active exchange and create admin report', object({ reason: string }));
endpoint('post', '/sessions/{id}/confirm', 'Confirm an ended session; completion requires both participants', object({}));
endpoint('get', '/reviews', 'Your pending, given, or received session reviews', undefined, false, true);
endpoint('post', '/reviews', 'Review a mutually confirmed session, once per author', ref('Review'));
endpoint('get', '/blocks', 'List students you blocked');
endpoint('post', '/users/{id}/block', 'Block student and cancel active exchanges', object({}));
endpoint('delete', '/users/{id}/block', 'Unblock student');
endpoint('post', '/users/{id}/report', 'Report another student', object({ reason: { type: 'string', minLength: 10, maxLength: 1000 } }));
endpoint('get', '/notifications', 'List notifications and unread count', undefined, false, true);
endpoint('post', '/notifications/read', 'Mark one or all notifications read', object({ id: string }, []));
endpoint('get', '/admin/reports', 'Admin report queue', undefined, false, true);
endpoint('post', '/admin/reports/{id}', 'Admin: resolve or dismiss report', object({ status: { enum: ['RESOLVED', 'DISMISSED'] } }));
for (const [path, entries] of Object.entries({ '/matches': [{ name: 'q', schema: { type: 'string', maxLength: 100 } }, { name: 'category', schema: { enum: ['Programming', 'Languages', 'Data and Office', 'Career and Soft Skills'] } }, { name: 'proficiency', schema: { enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] } }, { name: 'minOverlap', schema: { type: 'integer', minimum: 0, maximum: 168 } }], '/exchanges': [{ name: 'group', schema: { enum: ['all', 'pending', 'active', 'completed', 'declined'] } }, { name: 'status', schema: { enum: ['PROPOSED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'DECLINED', 'CANCELLED', 'DISPUTED'] } }], '/reviews': [{ name: 'view', schema: { enum: ['pending', 'given', 'received'] } }] })) {
  (paths[path].get as { parameters: Schema[] }).parameters.push(...entries.map(entry => ({ ...entry, in: 'query' })));
}
export const openapi = { openapi: '3.0.3', info: { title: 'Kömek Skills API', version: '1.0.0', description: 'University peer skill exchange. Cookie authentication with double-submit CSRF. Availability uses UTC: day 0 = Monday. Sessions can only be confirmed after their scheduled end. /api and /api/v1 are supported.' }, servers: [{ url: '/api/v1' }], paths, components: { schemas, securitySchemes: { cookieAuth: { type: 'apiKey', in: 'cookie', name: 'ks_session' } } } };
