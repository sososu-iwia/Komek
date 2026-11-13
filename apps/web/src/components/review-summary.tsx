import { Stars, Tag } from '../ui';
import type { Review } from '../types';
export function ReviewSummary({ review }: { review: Review }) {
  return <div className="mt-5 rounded-xl border border-accent/25 bg-accent-soft p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[11px] font-semibold text-accent-text">Your review is shared. Thank you!</p><Stars value={review.rating}/></div><p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-foreground">{review.text}</p>{review.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{review.tags.map(tag => <Tag key={tag}>{tag}</Tag>)}</div>}</div>;
}
