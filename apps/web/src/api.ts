let csrf: Promise<string> | null = null;
export class RequestError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}
async function token() {
  csrf ??= fetch('/api/auth/csrf', { credentials: 'include' }).then(async response => {
    if (!response.ok) throw new Error('Could not establish a secure connection.');
    return (await response.json()).token as string;
  }).catch(error => { csrf = null; throw error; });
  return csrf;
}
export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const response = await fetch(`/api${path}`, { method, credentials: 'include', headers: { ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' ? { 'X-CSRF-Token': await token() } : {}) }, ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}) });
  const data = await response.json();
  if (!response.ok) {
    if (data.error?.code === 'CSRF_ERROR') csrf = null;
    throw new RequestError(data.error?.message ?? 'Request failed. Please try again.', response.status, data.error?.code);
  }
  return data as T;
}
export const post = <T>(path: string, body: unknown = {}) => api<T>(path, { method: 'POST', body });
