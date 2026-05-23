import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database.types';

export type Profile = Database['public']['Tables']['profiles']['Row'];

/** Get current authenticated user, or null if not signed in. Never throws. */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Get current user's profile row, or null if not signed in / profile missing. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  return data;
}

/** Require auth — redirects to /login if not signed in or suspended. */
export async function requireUser() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  if (profile.suspended) redirect('/login');
  return profile;
}

/**
 * Require admin — returns notFound() for non-admins (hides the route exists).
 * Non-authenticated users are also 404'd, not redirected to /login.
 */
export async function requireAdmin(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_admin) notFound();
  return profile;
}
