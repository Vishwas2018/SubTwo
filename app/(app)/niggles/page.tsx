import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { NigglesClient } from './niggles-client';

export default async function NigglesPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: niggles } = await supabase
    .from('niggles')
    .select('*')
    .eq('user_id', user.id)
    .order('started_date', { ascending: false });

  return (
    <main className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1">
        ← Dashboard
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Niggles</h1>
        <p className="text-sm text-slate-500 mt-1">Track injuries and pain to stay on top of your recovery.</p>
      </div>

      <NigglesClient initialNiggles={niggles ?? []} />
    </main>
  );
}
