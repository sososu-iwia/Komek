import { useState } from 'react';
import { ArrowRight, Plus } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth, useLoad } from '../state';
import { Empty, Feedback, Heading, Loading, Pager } from '../ui';
import { ExchangeCard } from '../components/exchange-card';
import type { Exchange, Page } from '../types';
const groups = [['all', 'All exchanges'], ['pending', 'Pending'], ['active', 'Active'], ['completed', 'Completed'], ['declined', 'Declined & cancelled']];
export function ExchangesPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const group = params.get('group') ?? (params.get('status') === 'COMPLETED' ? 'completed' : 'all');
  const list = useLoad<Page<Exchange>>(`/exchanges?limit=12&page=${page}&group=${encodeURIComponent(group)}`);
  return <><Heading eyebrow="A little progress, together" title="My exchanges" description="From a first hello to a skill worth sharing. Every step, in one place." action={<Link to="/matches" className="btn btn-primary"><Plus size={16}/>New exchange</Link>}/><div className="mb-7 flex flex-wrap gap-2" role="group" aria-label="Filter exchanges">{groups.map(([value, label]) => <button key={value} aria-pressed={group === value} className={`filter-tab ${group === value ? 'filter-active' : ''}`} onClick={() => { setPage(1); setParams(value === 'all' ? {} : { group: value }); }}>{label}</button>)}</div><Feedback error={list.error}/>{list.loading ? <Loading cards={4}/> : list.data?.items.length && user ? <div className="grid items-start gap-5 xl:grid-cols-2">{list.data.items.map(exchange => <ExchangeCard key={exchange.id} exchange={exchange} userId={user.id}/>)}</div> : !list.error && <Empty title={group === 'all' ? 'Your next exchange starts with hello.' : `No ${group === 'declined' ? 'declined or cancelled' : group} exchanges yet.`} text="Find someone who can teach you something new — and share a little knowledge in return." action={<Link to="/matches" className="btn btn-primary">Discover students<ArrowRight size={15}/></Link>}/>}<Pager total={list.data?.total ?? 0} page={page} onChange={setPage}/></>;
}
