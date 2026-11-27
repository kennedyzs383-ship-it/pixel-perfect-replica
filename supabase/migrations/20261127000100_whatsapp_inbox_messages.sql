-- Durable, owner-scoped WhatsApp inbox. Webhook writes with the service role;
-- authenticated clients can read only their own messages.
create table if not exists public.whatsapp_inbox_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  message_id text not null,
  from_phone text not null,
  contact_name text,
  message_type text not null,
  text_body text,
  media_id text,
  media_mime_type text,
  meta_timestamp timestamptz,
  phone_number_id text not null,
  raw_message jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (owner_id, message_id)
);

create index if not exists whatsapp_inbox_owner_received_idx
  on public.whatsapp_inbox_messages (owner_id, received_at desc);

alter table public.whatsapp_inbox_messages enable row level security;

drop policy if exists "owners read their WhatsApp inbox" on public.whatsapp_inbox_messages;
create policy "owners read their WhatsApp inbox"
  on public.whatsapp_inbox_messages
  for select
  to authenticated
  using (owner_id = (select auth.uid()));

revoke all on public.whatsapp_inbox_messages from anon, authenticated;
grant select on public.whatsapp_inbox_messages to authenticated;
grant all on public.whatsapp_inbox_messages to service_role;
