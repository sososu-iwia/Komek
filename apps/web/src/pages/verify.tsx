import { useState } from 'react';
import { ArrowRight, MailCheck, ShieldCheck } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { post } from '../api';
import { useAction } from '../state';
import { Button, Feedback, Logo } from '../ui';
import { ThemeToggle } from '../components/theme-toggle';
export function VerifyPage() {
  const [search] = useSearchParams();
  const [done, setDone] = useState(false);
  const action = useAction();
  return <div className="flex min-h-screen flex-col bg-background"><header className="public-container flex items-center justify-between py-6"><Logo/><ThemeToggle/></header><main id="main" className="mx-auto my-auto w-full max-w-lg px-5 py-12"><div className="card p-7 text-center sm:p-10"><span className="mb-6 inline-flex rounded-2xl bg-accent-soft p-4 text-accent-text">{done ? <MailCheck size={30}/> : <ShieldCheck size={30}/>}</span><p className="eyebrow mb-3">One step closer</p><h1 className="text-2xl font-bold tracking-tight">{done ? 'You’re all set.' : 'A quick hello to your inbox.'}</h1><p className="mb-6 mt-4 text-xs leading-6 text-muted">{done ? 'Your university email is verified. Sign in to find your first learning partner.' : 'Verify your university email and make yourself at home in the Kömek Skills community.'}</p><Feedback error={action.error}/>{done ? <Link to="/login" className="btn btn-primary w-full">Sign in<ArrowRight size={15}/></Link> : <Button className="w-full" busy={action.busy} disabled={!search.get('token')} onClick={() => void action.run(async () => { await post('/auth/verify-email', { token: search.get('token') }); setDone(true); })}>Verify my email<ArrowRight size={15}/></Button>}{!search.get('token') && <p className="mt-4 text-xs text-danger">Open the complete verification link from your email.</p>}</div></main><footer className="py-6 text-center text-[10px] text-muted">A little sharing starts with a little trust.</footer></div>;
}
