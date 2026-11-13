import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemeMode } from '../theme';
export const themeOptions = [{ value: 'light', label: 'Light', icon: Sun }, { value: 'dark', label: 'Dark', icon: Moon }, { value: 'system', label: 'System', icon: Monitor }] as const;
export function ThemeToggle() {
  const { mode, resolved, setMode } = useTheme();
  const Icon = resolved === 'dark' ? Moon : Sun;
  return <Dropdown.Root><Dropdown.Trigger asChild><button type="button" className="icon-btn" aria-label="Choose theme" data-testid="theme-toggle"><Icon size={18}/></button></Dropdown.Trigger><Dropdown.Portal><Dropdown.Content className="menu-content" align="end" sideOffset={8}><Dropdown.Label className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Appearance</Dropdown.Label><Dropdown.RadioGroup value={mode} onValueChange={v => setMode(v as ThemeMode)}>{themeOptions.map(({ value, label, icon: OptionIcon }) => <Dropdown.RadioItem key={value} value={value} className="menu-item"><OptionIcon size={16}/>{label}<Dropdown.ItemIndicator className="ml-auto text-brand-text"><Check size={14}/></Dropdown.ItemIndicator></Dropdown.RadioItem>)}</Dropdown.RadioGroup></Dropdown.Content></Dropdown.Portal></Dropdown.Root>;
}
export function ThemePreferences() {
  const { mode, setMode } = useTheme();
  return <fieldset><legend className="mb-4 text-sm font-semibold">Choose your appearance</legend><div className="grid grid-cols-3 gap-3">{themeOptions.map(({ value, label, icon: Icon }) => <label key={value} className={`relative cursor-pointer rounded-xl border p-3 transition-colors sm:p-4 ${mode === value ? 'border-brand bg-brand-soft' : 'border-border hover:bg-elevated'}`}><input type="radio" name="theme" className="peer sr-only" value={value} checked={mode === value} onChange={() => setMode(value)}/><span className="absolute inset-0 rounded-xl peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand"/><span className={`mb-3 flex h-14 items-center justify-center rounded-lg border border-border ${value === 'light' ? 'bg-slate-50 text-slate-600' : value === 'dark' ? 'bg-[#0b1220] text-slate-200' : 'bg-elevated text-muted'}`}><Icon size={22}/></span><span className="flex items-center justify-between gap-1 text-xs font-medium">{label}{mode === value && <Check size={14} className="text-brand-text"/>}</span></label>)}</div><p className="help mt-4">System follows your device. Your choice is saved on this browser.</p></fieldset>;
}
