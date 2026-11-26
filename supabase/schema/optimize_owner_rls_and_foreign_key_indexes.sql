-- Applied to Supabase project emcdkxxmfqgejfmfpxwe on 2026-11-26.
-- Optimizes existing owner RLS policies and adds covering indexes for flagged foreign keys.
-- No rows are deleted or rewritten.

ALTER POLICY "activity owner access" ON public.activity_log
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));
ALTER POLICY "projects owner access" ON public.client_projects
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));
ALTER POLICY "conversations owner access" ON public.conversations
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));
ALTER POLICY "leads owner access" ON public.leads
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));
ALTER POLICY "payments owner access" ON public.payments
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));
ALTER POLICY "profile owner access" ON public.profiles
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS client_projects_lead_id_idx ON public.client_projects (lead_id);
CREATE INDEX IF NOT EXISTS conversations_lead_id_idx ON public.conversations (lead_id);
CREATE INDEX IF NOT EXISTS messages_owner_id_idx ON public.messages (owner_id);
CREATE INDEX IF NOT EXISTS payments_project_id_idx ON public.payments (project_id);
CREATE INDEX IF NOT EXISTS tasks_lead_id_idx ON public.tasks (lead_id);
CREATE INDEX IF NOT EXISTS tasks_project_id_idx ON public.tasks (project_id);
