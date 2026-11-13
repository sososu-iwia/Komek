import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, post, RequestError } from './api';
import type { User } from './types';
type Auth = { user: User | null; loading: boolean; loggingOut: boolean; error: string; reload: () => Promise<void>; logout: () => Promise<void> };
const AuthContext = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    try { setUser(await api<User>('/auth/me')); setError(''); }
    catch (e) { setUser(null); if (!(e instanceof RequestError && e.status === 401)) setError(e instanceof Error ? e.message : 'Cannot reach server.'); }
    finally { setLoading(false); setLoggingOut(false); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  const logout = async () => { setLoggingOut(true); try { await post('/auth/logout'); setUser(null); } catch (error) { setLoggingOut(false); throw error; } };
  return <AuthContext.Provider value={{ user, loading, loggingOut, error, reload, logout }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('AuthProvider required.'); return value; }
export function useLoad<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion(v => v + 1), []);
  const replace = useCallback((value: T) => { setData(value); setError(''); setVersion(v => v + 1); }, []);
  useEffect(() => {
    let current = true;
    setLoading(true); setError('');
    api<T>(path).then(value => { if (current) setData(value); }).catch(e => { if (current) setError(e instanceof Error ? e.message : 'Could not load data.'); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [path, version]);
  return { data, error, loading, reload, replace };
}
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  async function run(fn: () => Promise<void>, message = '') {
    setBusy(true); setError(''); setSuccess('');
    try { await fn(); setSuccess(message); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); } finally { setBusy(false); }
  }
  return { busy, error, success, run };
}
