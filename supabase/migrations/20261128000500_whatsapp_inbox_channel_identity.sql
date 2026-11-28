-- Persist the verified tenant channel identity on every new inbox message.
-- Existing legacy messages remain readable; new webhook deliveries set channel_id.
alter table public.whatsapp_inbox_messages
  add column if not exists channel_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'whatsapp_inbox_messages_owner_channel_fk'
      and conrelid = 'public.whatsapp_inbox_messages'::regclass
  ) then
    alter table public.whatsapp_inbox_messages
      add constraint whatsapp_inbox_messages_owner_channel_fk
      foreign key (owner_id, channel_id)
      references public.whatsapp_business_channels(owner_id, id)
      on delete cascade;
  end if;
end;
$$;

update public.whatsapp_inbox_messages m
set channel_id = c.id
from public.whatsapp_business_channels c
where m.channel_id is null
  and m.owner_id = c.owner_id
  and m.phone_number_id = c.phone_number_id;

create index if not exists whatsapp_inbox_channel_received_idx
  on public.whatsapp_inbox_messages (channel_id, received_at desc)
  where channel_id is not null;

comment on column public.whatsapp_inbox_messages.channel_id is
  'Verified WhatsApp Business channel resolved from the signed Meta webhook; null only for legacy inbox rows.';
