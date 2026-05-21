import { Suspense } from 'react';
import { ReviewContent } from './review-content';

export default function ReviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-slate-500">Loading…</p></div>}>
      <ReviewContent />
    </Suspense>
  );
}
