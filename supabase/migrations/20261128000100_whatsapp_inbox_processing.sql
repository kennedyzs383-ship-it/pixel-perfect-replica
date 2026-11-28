-- Durable processing state and atomic, owner-scoped inbox claims.
alter table public.whatsapp_inbox_messages
  add column if not exists processing_status text not null default 'pending',
  add column if not exists attempt_count integer not null default 0,
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists locked_at timestamptz,
  add column if not exists processed_at timestamptz,
  add column if not exists last_error text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.whatsapp_inbox_messages
  drop constraint if exists whatsapp_inbox_messages_processing_status_check;
alter table public.whatsapp_inbox_messages
  add constraint whatsapp_inbox_messages_processing_status_check
  check (processing_status in ('pending', 'processing', 'processed', 'failed'));

create index if not exists whatsapp_inbox_pending_claim_idx
  on public.whatsapp_inbox_messages (owner_id, next_attempt_at, received_at)
  where processing_status in ('pending', 'processing');

create or replace function public.claim_whatsapp_inbox_messages(p_limit integer default 20)
returns setof public.whatsapp_inbox_messages
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
begin
  if v_owner is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_limit < 1 or p_limit > 50 then
    raise exception 'p_limit must be between 1 and 50' using errcode = '22023';
  end if;

  return query
  with candidates as (
    select id
    from public.whatsapp_inbox_messages
    where owner_id = v_owner
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

create or replace function public.complete_whatsapp_inbox_message(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_count integer;
begin
  if v_owner is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  update public.whatsapp_inbox_messages
  set processing_status = 'processed',
      processed_at = now(),
      locked_at = null,
      last_error = null,
      updated_at = now()
  where id = p_id and owner_id = v_owner and processing_status = 'processing';
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

create or replace function public.fail_whatsapp_inbox_message(p_id uuid, p_error text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_count integer;
begin
  if v_owner is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  update public.whatsapp_inbox_messages
  set processing_status = case when attempt_count >= 8 then 'failed' else 'pending' end,
      next_attempt_at = case
        when attempt_count >= 8 then next_attempt_at
        else now() + make_interval(secs => least(3600, (power(2, least(attempt_count, 10))::integer) * 5))
      end,
      locked_at = null,
      last_error = left(coalesce(p_error, 'Processing failed'), 1000),
      updated_at = now()
  where id = p_id and owner_id = v_owner and processing_status = 'processing';
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

revoke all on function public.claim_whatsapp_inbox_messages(integer) from public, anon;
revoke all on function public.complete_whatsapp_inbox_message(uuid) from public, anon;
revoke all on function public.fail_whatsapp_inbox_message(uuid, text) from public, anon;
grant execute on function public.claim_whatsapp_inbox_messages(integer) to authenticated;
grant execute on function public.complete_whatsapp_inbox_message(uuid) to authenticated;
grant execute on function public.fail_whatsapp_inbox_message(uuid, text) to authenticated;
