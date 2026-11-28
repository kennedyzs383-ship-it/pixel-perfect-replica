-- Preserve a truthful terminal state for media messages that are stored but not yet decoded.
alter table public.whatsapp_inbox_messages
  drop constraint if exists whatsapp_inbox_messages_processing_status_check;
alter table public.whatsapp_inbox_messages
  add constraint whatsapp_inbox_messages_processing_status_check
  check (processing_status in ('pending', 'processing', 'processed', 'failed', 'unsupported'));

create or replace function public.skip_whatsapp_inbox_message(p_id uuid, p_reason text default 'Media decoding is not implemented')
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
  set processing_status = 'unsupported',
      processed_at = now(),
      locked_at = null,
      last_error = left(coalesce(p_reason, 'Media decoding is not implemented'), 1000),
      updated_at = now()
  where id = p_id and owner_id = v_owner and processing_status = 'processing';
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

revoke all on function public.skip_whatsapp_inbox_message(uuid, text) from public, anon;
grant execute on function public.skip_whatsapp_inbox_message(uuid, text) to authenticated;
