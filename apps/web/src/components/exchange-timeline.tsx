import { Check, CheckCheck, Circle, Send } from 'lucide-react';
import type { Exchange } from '../types';
export function ExchangeTimeline({ exchange, compact = false }: { exchange: Exchange; compact?: boolean }) {
  const accepted = ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED'].includes(exchange.status);
  const sessions = [...exchange.sessions].sort((a, b) => a.ordinal - b.ordinal);
  const steps = [
    { label: 'Proposed', done: true, icon: Send },
    { label: 'Accepted', done: accepted, icon: Check },
    { label: 'Session 1', done: !!sessions[0]?.completedAt, icon: CheckCheck },
    { label: 'Session 2', done: !!sessions[1]?.completedAt, icon: CheckCheck }
  ];
  return <ol aria-label="Exchange progress" className={`grid grid-cols-4 ${compact ? 'gap-1.5' : 'gap-2 sm:gap-4'}`}>{steps.map(({ label, done, icon: Icon }, i) => <li key={label}><div className={`mb-2 h-1 rounded-full ${done ? 'bg-accent' : 'bg-border'}`}/><div className={`flex items-center gap-1.5 text-[10px] ${done ? 'font-medium text-accent-text' : 'text-muted'}`}>{done ? <Icon size={compact ? 11 : 13} className="shrink-0"/> : <Circle size={compact ? 10 : 12} className="shrink-0"/>}<span>{label}{i >= 2 && !compact && <span className="hidden font-normal sm:inline"> · {sessions[i - 2]?.confirmations.length ?? 0}/2</span>}</span></div></li>)}</ol>;
}
