import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarClock, Check, CheckCheck, Flag, MessageSquare, ShieldCheck } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { post } from '../api';
import { useAction, useAuth, useLoad } from '../state';
import { Avatar, Button, Feedback, Heading, Loading, Status } from '../ui';
import { exchangePartner, localDate } from '../lib';
import { ConfirmationDialog } from '../components/confirmation-dialog';
import { ExchangeTimeline } from '../components/exchange-timeline';
import { SchedulePicker, schedulesOverlap, type Schedule } from '../components/schedule-picker';
import { SessionCard } from '../components/session-card';
import type { Exchange } from '../types';
export function ExchangeDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const exchange = useLoad<Exchange>(`/exchanges/${id}`);
  const action = useAction();
  const [rescheduling, setRescheduling] = useState(false);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [note, setNote] = useState('');
  const [dispute, setDispute] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState<'decline' | 'cancel' | null>(null);
  const [scheduleError, setScheduleError] = useState('');
  useEffect(() => { const timer = window.setInterval(exchange.reload, 30000); return () => window.clearInterval(timer); }, [exchange.reload]);
  if (exchange.loading && !exchange.data) return <Loading cards={2}/>;
  if (!exchange.data || exchange.error || !user) return <Feedback error={exchange.error || 'Exchange unavailable.'}/>;
  const e = exchange.data;
  const partner = exchangePartner(e, user.id);
  const active = ['PROPOSED', 'ACCEPTED', 'IN_PROGRESS', 'DISPUTED'].includes(e.status);
  const canSchedule = ['PROPOSED', 'ACCEPTED'].includes(e.status) && !e.sessions.some(s => s.confirmations.length);
  const perform = (path: string, body: unknown = {}, message = '') => void action.run(async () => { const updated = await post<Exchange>(path, body); setConfirmation(null); exchange.replace(updated); }, message);
  return <>
    <Link to="/exchanges" className="text-link mb-5 text-muted"><ArrowLeft size={14}/>All exchanges</Link>
    <Heading eyebrow="Two people. Shared progress." title={`Learning with ${partner.profile.fullName.split(' ')[0]}`} description="Two sessions, with time for both of you to teach and learn." action={<Status status={e.status}/>}/>
    <Feedback error={action.error || scheduleError} success={action.success || (location.state?.proposed && e.status === 'PROPOSED' ? 'Your proposal has been sent. Your partner will be notified.' : '')}/>
    <section className="card mb-6 p-5 sm:p-6"><ExchangeTimeline exchange={e}/></section>
    {e.status === 'PROPOSED' && <section className="mb-6 rounded-2xl border border-brand/20 bg-brand-soft p-5 sm:p-6"><h2 className="text-sm font-semibold">{e.nextResponderId === user.id ? 'A new possibility is waiting for your yes.' : 'Your proposal is with your partner.'}</h2><p className="mt-2 text-xs leading-6 text-muted">{e.nextResponderId === user.id ? 'Review both sessions below. Accept the proposal or suggest times that work better.' : 'They can accept, decline, or suggest another time. We’ll let you know when they respond.'}</p>{e.nextResponderId === user.id && <div className="mt-4 flex flex-wrap gap-2"><Button disabled={action.busy} onClick={() => perform(`/exchanges/${id}/respond`, { decision: 'ACCEPT' }, 'Your exchange is accepted. See you at your first session.')}><Check size={15}/>Accept exchange</Button><Button variant="secondary" disabled={action.busy} onClick={() => setConfirmation('decline')}>Decline</Button></div>}</section>}
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-5">
        {e.sessions.map(session => <SessionCard key={session.id} session={session} userId={user.id} partner={partner} status={e.status} busy={action.busy} onConfirm={() => perform(`/sessions/${session.id}/confirm`, {}, 'Your confirmation has been saved.')} refresh={exchange.reload}/>)}
        {e.status === 'COMPLETED' && <div className="rounded-2xl border border-accent/25 bg-accent-soft p-6 text-center"><CheckCheck size={30} className="mx-auto text-accent-text"/><h2 className="mt-4 text-xl font-semibold tracking-tight">A little wiser. A little more connected.</h2><p className="mt-3 text-xs leading-6 text-accent-text">Your exchange is complete. Both students confirmed both sessions.</p><Link to="/matches" className="btn btn-primary mt-5">Find your next exchange<ArrowRight size={14}/></Link></div>}
        {active && <div className="flex flex-wrap gap-2">{canSchedule && <Button variant="secondary" onClick={() => { setRescheduling(v => !v); setSchedules(e.sessions.map(s => ({ startsAt: localDate(new Date(s.startsAt)), duration: s.duration, location: s.location, locationDetail: s.locationDetail }))); setScheduleError(''); }}><CalendarClock size={15}/>Suggest new times</Button>}<Button variant="ghost" onClick={() => setConfirmation('cancel')}>Cancel exchange</Button>{['ACCEPTED', 'IN_PROGRESS'].includes(e.status) && <Button variant="ghost" onClick={() => setDispute(v => !v)}><Flag size={14}/>Report a problem</Button>}</div>}
        {rescheduling && canSchedule && <form className="card p-5 sm:p-6" onSubmit={event => { event.preventDefault(); setScheduleError(''); if (schedulesOverlap(schedules)) { setScheduleError('Your two sessions cannot overlap.'); return; } void action.run(async () => { const updated = await post<Exchange>(`/exchanges/${id}/reschedule`, { sessions: schedules.map(s => ({ ...s, startsAt: new Date(s.startsAt).toISOString() })), note }); setRescheduling(false); exchange.replace(updated); }, 'Your suggested times have been sent. Your partner will need to accept them.'); }}><h2 className="mb-2 text-base font-semibold">Find a time that works.</h2><p className="mb-6 text-xs leading-6 text-muted">Update both sessions. Your partner will receive a new proposal to accept.</p>{schedules.map((schedule, index) => <section className="mb-5 rounded-xl border border-border p-4" key={index}><h3 className="mb-4 text-xs font-semibold">Session {index + 1} · {e.sessions[index].skill.name}</h3><SchedulePicker compact prefix={`Reschedule session ${index + 1}`} value={schedule} onChange={value => setSchedules(v => v.map((s, i) => i === index ? value : s))}/></section>)}<label className="field">A note for your partner<textarea className="input min-h-20" maxLength={500} value={note} onChange={event => setNote(event.target.value)} placeholder="Let them know what changed…"/></label><div className="mt-5 flex flex-wrap gap-2"><Button busy={action.busy}>Send new times</Button><Button type="button" variant="secondary" onClick={() => setRescheduling(false)}>Keep current times</Button></div></form>}
        {dispute && ['ACCEPTED', 'IN_PROGRESS'].includes(e.status) && <form className="card p-5 sm:p-6" onSubmit={event => { event.preventDefault(); void action.run(async () => { const updated = await post<Exchange>(`/exchanges/${id}/dispute`, { reason }); setDispute(false); exchange.replace(updated); }, 'Your concern has been sent to the community administrator.'); }}><h2 className="text-base font-semibold">Tell us what happened.</h2><p className="mb-4 mt-2 text-xs leading-6 text-muted">The exchange will pause for administrator review. Your partner will see its disputed status.</p><label className="field">Your concern<textarea className="input min-h-28" required minLength={10} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)}/><span className="help">10–1000 characters</span></label><div className="mt-5 flex gap-2"><Button busy={action.busy}>Submit concern</Button><Button type="button" variant="secondary" onClick={() => setDispute(false)}>Go back</Button></div></form>}
      </div>
      <aside className="space-y-5 xl:sticky xl:top-24"><section className="card p-5"><p className="eyebrow mb-4">Your learning partner</p><Link to={`/students/${partner.id}`} className="flex items-center gap-3"><Avatar name={partner.profile.fullName} seed={partner.id}/><div className="min-w-0"><h2 className="text-xs font-semibold">{partner.profile.fullName}</h2><p className="mt-1.5 text-[10px] leading-5 text-muted">{partner.profile.faculty}</p></div><ArrowRight size={14} className="ml-auto shrink-0 text-muted"/></Link>{e.message && <div className="mt-5 border-t border-border pt-4"><h3 className="mb-2 flex items-center gap-2 text-[11px] font-semibold"><MessageSquare size={14}/>The first hello</h3><p className="whitespace-pre-wrap break-words text-xs leading-6 text-muted">{e.message}</p></div>}{e.responseNote && <div className="mt-4 rounded-xl bg-warning-soft p-3 text-[11px] leading-6 text-warning">Latest reschedule note: {e.responseNote}</div>}</section><div className="rounded-2xl border border-border p-5"><ShieldCheck size={21} className="text-accent-text"/><h2 className="mt-3 text-xs font-semibold">A fair exchange, every time.</h2><p className="mt-2 text-[11px] leading-6 text-muted">Confirm after you attend. Both confirmations unlock a review. Meet on campus or use your university’s video platform.</p></div></aside>
    </div>
    <ConfirmationDialog open={confirmation !== null} onOpenChange={open => { if (!open) setConfirmation(null); }} title={confirmation === 'decline' ? 'Decline this proposal?' : 'Cancel this exchange?'} description={confirmation === 'decline' ? 'Your partner will be notified. You can find another learning partner whenever you’re ready.' : 'Both participants will see its cancelled status. This stops the remaining sessions in this exchange.'} confirmLabel={confirmation === 'decline' ? 'Decline proposal' : 'Cancel exchange'} danger error={action.error} busy={action.busy} onConfirm={() => confirmation === 'decline' ? perform(`/exchanges/${id}/respond`, { decision: 'DECLINE' }) : perform(`/exchanges/${id}/cancel`)}/>
  </>;
}
