import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
export type ThemeMode = 'light' | 'dark' | 'system';
type ThemeState = { mode: ThemeMode; resolved: 'light' | 'dark'; setMode: (value: ThemeMode) => void };
const ThemeContext = createContext<ThemeState | null>(null);
const storageKey = 'komek-theme';
function preference(): ThemeMode {
  try { const saved = localStorage.getItem(storageKey); if (saved === 'light' || saved === 'dark') return saved; } catch { return 'system'; }
  return 'system';
}
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(preference);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const resolved = mode === 'system' ? systemDark ? 'dark' : 'light' : mode;
  useEffect(() => {
    const frame = requestAnimationFrame(() => document.documentElement.classList.add('theme-transition'));
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const change = () => setSystemDark(media.matches);
    media.addEventListener('change', change);
    const sync = (event: StorageEvent) => { if (event.key === storageKey) setMode(preference()); };
    window.addEventListener('storage', sync);
    return () => { media.removeEventListener('change', change); window.removeEventListener('storage', sync); };
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
    root.dataset.theme = resolved;
    root.style.colorScheme = resolved;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#0b1220' : '#f8fafc');
    try { localStorage.setItem(storageKey, mode); } catch { return; }
  }, [mode, resolved]);
  return <ThemeContext.Provider value={{ mode, resolved, setMode }}>{children}</ThemeContext.Provider>;
}
export function useTheme() { const state = useContext(ThemeContext); if (!state) throw new Error('ThemeProvider required.'); return state; }
