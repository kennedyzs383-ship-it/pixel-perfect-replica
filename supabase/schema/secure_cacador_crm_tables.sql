-- Secure Caçador CRM communication and task tables.
revoke all on table public.conversations, public.messages, public.tasks from public, anon;
grant select, insert, update, delete on table public.conversations, public.messages, public.tasks to authenticated;

drop policy if exists "messages owner access" on public.messages;
create policy "messages owner access"
on public.messages for all to authenticated
using (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id and c.owner_id = (select auth.uid())
  )
)
with check (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id and c.owner_id = (select auth.uid())
  )
);

drop policy if exists "tasks owner access" on public.tasks;
create policy "tasks owner access"
on public.tasks for all to authenticated
using (owner_id = (select auth.uid()))
with check (
  owner_id = (select auth.uid())
  and (lead_id is null or exists (
    select 1 from public.leads l where l.id = tasks.lead_id and l.owner_id = (select auth.uid())
  ))
  and (project_id is null or exists (
    select 1 from public.client_projects p where p.id = tasks.project_id and p.owner_id = (select auth.uid())
  ))
);
