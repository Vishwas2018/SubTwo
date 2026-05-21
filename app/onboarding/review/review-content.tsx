'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function ReviewContent() {
  const params = useSearchParams();
  const planId = params.get('plan');

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl text-slate-900">🎉 Plan generated!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-600">
              Your training plan is ready. The full review screen is coming in Day 11.
            </p>
            {planId && (
              <p className="text-xs text-slate-400 font-mono break-all">
                Plan ID: {planId}
              </p>
            )}
            <div className="pt-2">
              <Button
                render={<Link href="/dashboard" />}
                className="bg-emerald-600 hover:bg-emerald-700 text-white w-full"
              >
                Go to Dashboard →
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
