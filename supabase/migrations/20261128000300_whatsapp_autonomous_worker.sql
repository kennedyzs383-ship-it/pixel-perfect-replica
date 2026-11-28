-- Autonomous WhatsApp inbox worker state. This migration is committed to the PR only;
-- it is NOT applied to the active Supabase project.

alter table public.whatsapp_inbox_messages
  add column if not exists assistant_draft text,
  add column if not exists assistant_proposals jsonb not null default '[]'::jsonb,
  add column if not exists draft_status text not null default 'none';

alter table public.whatsapp_inbox_messages
  drop constraint if exists whatsapp_inbox_messages_draft_status_check;
alter table public.whatsapp_inbox_messages
  add constraint whatsapp_inbox_messages_draft_status_check
  check (draft_status in ('none', 'pending_approval', 'approved', 'rejected', 'sent'));

create index if not exists whatsapp_inbox_pending_worker_idx
  on public.whatsapp_inbox_messages (phone_number_id, next_attempt_at, received_at)
  where processing_status in ('pending', 'processing');

-- The scheduled worker runs with the service role, not a browser session.
-- Scope every claim to the configured owner AND Business phone number.
create or replace function public.claim_whatsapp_inbox_messages_for_worker(
  p_owner_id uuid,
  p_phone_number_id text,
  p_limit integer default 10
)
returns setof public.whatsapp_inbox_messages
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_owner_id is null or p_phone_number_id is null or length(p_phone_number_id) not between 5 and 30 then
    raise exception 'A valid owner and Business phone number are required' using errcode = '22023';
  end if;
  if p_limit < 1 or p_limit > 20 then
    raise exception 'p_limit must be between 1 and 20' using errcode = '22023';
  end if;

  return query
  with candidates as (
    select id
    from public.whatsapp_inbox_messages
    where owner_id = p_owner_id
      and phone_number_id = p_phone_number_id
      and draft_status = 'none'
      and next_attempt_at <= now()
      and (
        processing_status = 'pending'
        or (processing_status = 'processing' and locked_at < now() - interval '5 minutes')
      )
    order by received_at asc
    for update skip locked
    limit p_limit
  )
  update public.whatsapp_inbox_messages m
  set processing_status = 'processing',
      attempt_count = m.attempt_count + 1,
      locked_at = now(),
      updated_at = now()
  from candidates
  where m.id = candidates.id
  returning m.*;
end;
$$;

revoke all on function public.claim_whatsapp_inbox_messages_for_worker(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.claim_whatsapp_inbox_messages_for_worker(uuid, text, integer) to service_role;
