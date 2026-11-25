-- Harden SECURITY DEFINER RPC functions flagged by Supabase Security Advisor (lints 0028 & 0029)
-- Restricts execution to service_role only so anon/authenticated cannot invoke them directly via PostgREST.

DO $$
BEGIN
  IF to_regprocedure('public.flexexa_applications(text, text, jsonb)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.flexexa_applications(text, text, jsonb) FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.flexexa_applications(text, text, jsonb) FROM anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.flexexa_applications(text, text, jsonb) TO service_role;
  END IF;

  IF to_regprocedure('public.flexexa_platform_charging_inventory(uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.flexexa_platform_charging_inventory(uuid) FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.flexexa_platform_charging_inventory(uuid) FROM anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.flexexa_platform_charging_inventory(uuid) TO service_role;
  END IF;
END
$$;
