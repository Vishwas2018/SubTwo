import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: access } = await supabase
    .from('viewer_access')
    .select('id')
    .eq('viewer_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (!access) redirect('/dashboard');

  return <>{children}</>;
}
