import { useState } from 'react';
import { ArrowRight, MessageSquareHeart, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth, useLoad } from '../state';
import { Avatar, Empty, Feedback, Heading, Loading, Pager, Stars, Tag, date } from '../ui';
import { ReviewForm } from '../components/review-form';
import type { Page, Person, Review, Session, Skill } from '../types';
type PendingReview = Session & { exchange: { id: string; sender: Person; receiver: Person } };
type WrittenReview = Review & { author: Person; subject: Person; session: { topic: string; skill: Skill; exchangeId: string } };
export function ReviewsPage() {
  const { user } = useAuth();
  const [view, setView] = useState('pending');
  const [page, setPage] = useState(1);
  const list = useLoad<Page<PendingReview | WrittenReview>>(`/reviews?view=${view}&limit=12&page=${page}`);
  return <><Heading eyebrow="Kind words. Real progress." title="Reviews & appreciation" description="Share what helped you learn. Every review comes from a mutually confirmed session."/><div className="mb-7 flex flex-wrap gap-2" role="group" aria-label="Filter reviews">{[['pending', 'Ready to review'], ['received', 'Received'], ['given', 'Given']].map(([value, label]) => <button key={value} aria-pressed={view === value} className={`filter-tab ${view === value ? 'filter-active' : ''}`} onClick={() => { setView(value); setPage(1); }}>{label}</button>)}</div><Feedback error={list.error}/>{list.loading ? <Loading cards={2}/> : list.data?.items.length ? <div className="grid items-start gap-5 xl:grid-cols-2">{list.data.items.map(item => {
    if ('exchange' in item) { const partner = item.exchange.sender.id === user?.id ? item.exchange.receiver : item.exchange.sender; return <article className="card p-5 sm:p-6" key={item.id}><div className="flex items-center gap-3"><Avatar name={partner.profile.fullName}/><div><h2 className="text-sm font-semibold">Your session with {partner.profile.fullName}</h2><p className="mt-1.5 text-[10px] text-muted">{item.skill.name} · {date(item.startsAt)}</p></div></div><ReviewForm session={item} refresh={list.reload}/><Link to={`/exchanges/${item.exchange.id}`} className="text-link mt-4 text-[11px]">View exchange<ArrowRight size={13}/></Link></article>; }
    const person = view === 'given' ? item.subject : item.author;
    return <article className="card p-5 sm:p-6" key={item.id}><div className="flex flex-wrap items-start justify-between gap-3"><Link className="flex items-center gap-3" to={`/students/${person.id}`}><Avatar name={person.profile.fullName}/><div><h2 className="text-xs font-semibold">{view === 'given' ? 'To ' : 'From '}{person.profile.fullName}</h2><p className="mt-1.5 text-[10px] text-muted">{item.session.skill.name} · {date(item.createdAt)}</p></div></Link><Stars value={item.rating}/></div><p className="my-5 whitespace-pre-wrap text-sm leading-7">{item.text}</p><div className="flex flex-wrap gap-1.5">{item.tags.map(tag => <Tag key={tag}>{tag}</Tag>)}</div><div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"><span className="flex items-center gap-1.5 text-[10px] text-accent-text"><ShieldCheck size={13}/>Confirmed session</span><Link to={`/exchanges/${item.session.exchangeId}`} className="text-link text-[10px]">View exchange<ArrowRight size={12}/></Link></div></article>;
  })}</div> : !list.error && <Empty title={view === 'pending' ? 'Good feedback starts with a shared session.' : 'Your kind words will live here.'} text={view === 'pending' ? 'Complete a session and confirm it with your partner. Then take a moment to share what made it helpful.' : 'Reviews appear here after a confirmed session. No ratings are added before someone shares a real review.'} action={<Link to="/exchanges" className="btn btn-secondary"><MessageSquareHeart size={15}/>My exchanges</Link>}/>}<Pager total={list.data?.total ?? 0} page={page} onChange={setPage}/></>;
}
