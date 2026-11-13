import { useState } from 'react';
import { ArrowRight, Bell, CheckCheck, ShieldCheck } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { post } from './api';
import { useAction, useAuth, useLoad } from './state';
import { Button, Empty, Feedback, Heading, Loading, Pager, Tag, date } from './ui';
import type { Notice, Page, Person } from './types';
export function NotificationsPage() {
  const [page, setPage] = useState(1);
  const list = useLoad<Page<Notice>>(`/notifications?limit=12&page=${page}`);
  const action = useAction();
  return <><Heading eyebrow="Stay in the loop" title="Notifications" description="Proposals, confirmations, and good news from your learning community." action={<Button variant="secondary" disabled={action.busy || !list.data?.unread} onClick={() => void action.run(async () => { await post('/notifications/read'); list.reload(); })}><CheckCheck size={15}/>Mark all read</Button>}/><Feedback error={action.error || list.error}/>{list.loading ? <Loading/> : list.data?.items.length ? <div className="card divide-y divide-border">{list.data.items.map(n => <article key={n.id} className={`flex items-start gap-4 p-5 ${!n.readAt ? 'bg-brand-soft/50' : ''}`}><span className="rounded-xl bg-brand-soft p-3 text-brand-text"><Bell size={18}/></span><div className="min-w-0 flex-1"><h2 className="text-sm font-medium">{n.title}</h2><p className="mt-2 text-xs text-muted">{date(n.createdAt)}</p>{n.exchangeId && <Link to={`/exchanges/${n.exchangeId}`} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-text">View exchange <ArrowRight size={13}/></Link>}</div>{!n.readAt && <button className="text-xs text-brand-text" disabled={action.busy} onClick={() => void action.run(async () => { await post('/notifications/read', { id: n.id }); list.reload(); })}>Mark read</button>}</article>)}</div> : <Empty title="All quiet, in a good way" text="We’ll let you know when someone proposes an exchange, responds, or confirms a session."/>}<Pager limit={12} page={page} total={list.data?.total ?? 0} onChange={setPage}/></>;
}
type Report = { id: string; reason: string; createdAt: string; status: string; reporter: Person; reported: Person };
export function AdminPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('OPEN');
  const reports = useLoad<Page<Report>>(`/admin/reports?limit=12&page=${page}&status=${status}`);
  const action = useAction();
  if (user?.role !== 'ADMIN') return <Navigate to="/dashboard" replace/>;
  return <><Heading eyebrow="Community care" title="Report queue." description="Review concerns and help keep your campus community safe."/><div className="mb-6 flex gap-2">{['OPEN', 'RESOLVED', 'DISMISSED'].map(s => <button key={s} className={`filter-tab ${status === s ? 'filter-active' : ''}`} onClick={() => { setStatus(s); setPage(1); }}>{s.toLowerCase()}</button>)}</div><Feedback error={reports.error || action.error}/>{reports.loading ? <Loading/> : reports.data?.items.length ? <div className="space-y-4">{reports.data.items.map(r => <article key={r.id} className="card p-6"><div className="flex justify-between gap-3"><h2 className="text-sm font-semibold">{r.reporter.profile.fullName} reported {r.reported.profile.fullName}</h2><Tag tone="gray">{r.status.toLowerCase()}</Tag></div><p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-muted">{r.reason}</p><p className="mt-3 text-xs text-muted">{date(r.createdAt)}</p>{r.status === 'OPEN' && <div className="mt-5 flex gap-3"><Button disabled={action.busy} onClick={() => void action.run(async () => { await post(`/admin/reports/${r.id}`, { status: 'RESOLVED' }); reports.reload(); })}><ShieldCheck size={14}/>Resolve report</Button><Button variant="secondary" disabled={action.busy} onClick={() => void action.run(async () => { await post(`/admin/reports/${r.id}`, { status: 'DISMISSED' }); reports.reload(); })}>Dismiss</Button></div>}</article>)}</div> : <Empty title="Nothing in this queue" text="Reports with this status will appear here for administrator review."/>}<Pager limit={12} page={page} total={reports.data?.total ?? 0} onChange={setPage}/></>;
}
