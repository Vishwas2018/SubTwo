-- Migration: 026_rls_audit
-- Refs: P3-02
-- Creates a read-only SECURITY DEFINER function that returns RLS status for all user tables.

CREATE OR REPLACE FUNCTION public.get_rls_audit()
RETURNS TABLE (
  table_name text,
  rls_enabled boolean,
  policy_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.tablename::text AS table_name,
    t.rowsecurity AS rls_enabled,
    COUNT(p.policyname) AS policy_count
  FROM pg_tables t
  LEFT JOIN pg_policies p
    ON p.schemaname = t.schemaname AND p.tablename = t.tablename
  WHERE t.schemaname = 'public'
  GROUP BY t.tablename, t.rowsecurity
  ORDER BY t.tablename;
$$;

GRANT EXECUTE ON FUNCTION public.get_rls_audit() TO service_role;
