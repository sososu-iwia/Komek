import { useState } from 'react';
import { Check, Send } from 'lucide-react';
import { post } from '../api';
import { useAction } from '../state';
import { Button, Feedback } from '../ui';
import { RatingInput } from './rating-input';
import { ReviewSummary } from './review-summary';
import type { Review, Session } from '../types';
export function ReviewForm({ session, refresh }: { session: Session; refresh: () => void }) {
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState<Review | null>(null);
  const action = useAction();
  if (submitted) return <ReviewSummary review={submitted}/>;
  return <form className="mt-5 rounded-xl border border-brand/15 bg-background p-4 sm:p-5" onSubmit={event => { event.preventDefault(); void action.run(async () => { const review = await post<Review>('/reviews', { sessionId: session.id, rating, text, tags }); setSubmitted(review); refresh(); }); }}><h3 className="mb-5 text-sm font-semibold">A little appreciation goes a long way.</h3><RatingInput value={rating} onChange={setRating} name={`rating-${session.id}`}/><label className="field mt-5">Your review<textarea className="input min-h-24" aria-label={`Review for ${session.topic}`} maxLength={300} required value={text} onChange={e => setText(e.target.value)} placeholder="What made this session helpful?"/><span className="help">{text.length}/300 characters · Visible on your partner’s profile.</span></label><div className="my-4 flex flex-wrap gap-1.5">{['Patient', 'Well prepared', 'Friendly', 'Clear explanations', 'On time'].map(tag => <button type="button" key={tag} className={`skill-toggle ${tags.includes(tag) ? 'skill-selected-teach' : 'bg-surface'}`} aria-pressed={tags.includes(tag)} onClick={() => setTags(v => v.includes(tag) ? v.filter(t => t !== tag) : [...v, tag])}>{tags.includes(tag) && <Check size={11}/>} {tag}</button>)}</div><Feedback error={action.error}/><Button className="btn-sm" busy={action.busy}><Send size={13}/>Share my review</Button></form>;
}
