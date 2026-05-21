import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database.types';

export type PlannedSession = Database['public']['Tables']['planned_sessions']['Row'];
export type Run = Database['public']['Tables']['runs']['Row'];

export type ActivePlanData = {
  id: string;
  status: string;
  race_distance_km: number;
  race_name: string | null;
  race_date: string;
  start_date: string;
  total_weeks: number;
  experience_level: string;
  goal_time_seconds: number | null;
  pace_zones: Database['public']['Tables']['plans']['Row']['pace_zones'];
  current_version_id: string | null;
  sessions: PlannedSession[];
};

export type SessionDetailData = {
  session: PlannedSession;
  plan: {
    id: string;
    race_name: string | null;
    race_date: string;
    race_distance_km: number;
    total_weeks: number;
    goal_time_seconds: number | null;
    pace_zones: Database['public']['Tables']['plans']['Row']['pace_zones'];
  };
  linkedRun: Run | null;
};

/**
 * Returns the user's active plan with all sessions for its current version.
 * Returns null if no active plan exists.
 */
export async function getActivePlan(userId: string): Promise<ActivePlanData | null> {
  const supabase = await createClient();

  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (planError || !plan) return null;

  if (!plan.current_version_id) return { ...plan, sessions: [] };

  const { data: sessions, error: sessError } = await supabase
    .from('planned_sessions')
    .select('*')
    .eq('plan_id', plan.id)
    .eq('plan_version_id', plan.current_version_id)
    .order('week_number', { ascending: true })
    .order('day_of_week', { ascending: true });

  if (sessError) return { ...plan, sessions: [] };

  return { ...plan, sessions: sessions ?? [] };
}

/**
 * Returns a single session with plan context and linked run.
 * Returns null if not found or not owned by userId.
 */
export async function getSessionById(
  sessionId: string,
  userId: string,
): Promise<SessionDetailData | null> {
  const supabase = await createClient();

  const { data: session, error: sessError } = await supabase
    .from('planned_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (sessError || !session) return null;

  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('id, race_name, race_date, race_distance_km, total_weeks, goal_time_seconds, pace_zones, user_id')
    .eq('id', session.plan_id)
    .single();

  if (planError || !plan) return null;
  if (plan.user_id !== userId) return null;

  const { data: run } = await supabase
    .from('runs')
    .select('*')
    .eq('planned_session_id', sessionId)
    .is('deleted_at', null)
    .maybeSingle();

  return {
    session,
    plan: {
      id: plan.id,
      race_name: plan.race_name,
      race_date: plan.race_date,
      race_distance_km: plan.race_distance_km,
      total_weeks: plan.total_weeks,
      goal_time_seconds: plan.goal_time_seconds,
      pace_zones: plan.pace_zones,
    },
    linkedRun: run ?? null,
  };
}
