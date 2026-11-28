-- Multi-tenant WhatsApp channel registry.
-- This migration is committed to the PR only; it is NOT applied to any Supabase project.

create table if not exists public.whatsapp_business_channels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 1 and 100),
  waba_id text not null check (waba_id ~ '^[0-9]{5,30}$'),
  phone_number_id text not null unique check (phone_number_id ~ '^[0-9]{5,30}$'),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'paused', 'revoked')),
  brain_provider text not null default 'zrouter'
    check (brain_provider in ('zrouter', 'lovable', 'openai-compatible')),
  brain_model text,
  brain_base_url text,
  brain_api_key_secret_name text,
  meta_access_token_secret_name text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, id),
  check (
    brain_base_url is null
    or (brain_base_url ~ '^https://' and length(brain_base_url) <= 500 and position('@' in brain_base_url) = 0)
  ),
  check (
    (brain_provider <> 'openai-compatible' or (brain_model is not null and brain_base_url is not null))
    and (brain_provider <> 'lovable' or brain_model is not null)
  ),
  check (
    brain_api_key_secret_name is null
    or brain_api_key_secret_name ~ '^cacador_wa_brain_[a-f0-9-]{36}$'
  ),
  check (
    meta_access_token_secret_name is null
    or meta_access_token_secret_name ~ '^cacador_wa_meta_[a-f0-9-]{36}$'
  )
);

-- Message IDs are deduplicated inside the owner + Business channel boundary.
-- The previous owner/message constraint was too broad for multiple channels.
alter table public.whatsapp_inbox_messages
  drop constraint if exists whatsapp_inbox_messages_owner_id_message_id_key;
create unique index if not exists whatsapp_inbox_owner_channel_message_uidx
  on public.whatsapp_inbox_messages (owner_id, phone_number_id, message_id);

create index if not exists whatsapp_business_channels_owner_idx
  on public.whatsapp_business_channels (owner_id, created_at desc);
create index if not exists whatsapp_business_channels_active_phone_idx
  on public.whatsapp_business_channels (phone_number_id)
  where status = 'active';

alter table public.whatsapp_business_channels enable row level security;
revoke all on public.whatsapp_business_channels from public, anon;
grant select, insert, update, delete on public.whatsapp_business_channels to authenticated;
grant all on public.whatsapp_business_channels to service_role;

drop policy if exists "owners manage their WhatsApp Business channels" on public.whatsapp_business_channels;
create policy "owners manage their WhatsApp Business channels"
  on public.whatsapp_business_channels
  for all
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Owners may register, edit, pause, or revoke their own channels, but activation
-- is reserved for a trusted server-side Meta verification flow.
create or replace function public.guard_whatsapp_business_channel()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  request_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
begin
  if tg_op = 'UPDATE' then
    if new.owner_id is distinct from old.owner_id
      or new.phone_number_id is distinct from old.phone_number_id
      or new.waba_id is distinct from old.waba_id then
      raise exception 'Channel owner and Meta identifiers are immutable; register a new channel instead'
        using errcode = '42501';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.status = 'revoked' and new.status <> 'revoked' then
    raise exception 'A revoked WhatsApp channel cannot be reactivated; register a new channel'
      using errcode = '42501';
  end if;

  if new.status = 'active' and (
    new.verified_at is null
    or new.meta_access_token_secret_name is null
    or new.brain_api_key_secret_name is null
  ) then
    raise exception 'Activation requires Meta verification and both channel credentials'
      using errcode = '23514';
  end if;

  if new.status = 'active'
    and (tg_op = 'INSERT' or old.status is distinct from 'active')
    and request_role <> 'service_role' then
    raise exception 'A WhatsApp channel can only be activated by the trusted Meta verification flow'
      using errcode = '42501';
  end if;

  -- Secret references are writable only inside the owner-checked Vault RPC
  -- (whose SECURITY DEFINER context is postgres) or by the trusted service role.
  if request_role <> 'service_role' and current_user <> 'postgres' then
    if tg_op = 'INSERT' and (
      new.brain_api_key_secret_name is not null
      or new.meta_access_token_secret_name is not null
    ) then
      raise exception 'Channel secrets must be registered through the secure Vault RPC'
        using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and (
      new.brain_api_key_secret_name is distinct from old.brain_api_key_secret_name
      or new.meta_access_token_secret_name is distinct from old.meta_access_token_secret_name
      or new.verified_at is distinct from old.verified_at
    ) then
      raise exception 'Channel secret references cannot be modified directly'
        using errcode = '42501';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists guard_whatsapp_business_channel on public.whatsapp_business_channels;
create trigger guard_whatsapp_business_channel
  before insert or update on public.whatsapp_business_channels
  for each row execute function public.guard_whatsapp_business_channel();

-- Save a per-channel credential in Supabase Vault. The secret value never enters
-- the channel row and is never returned to an authenticated browser.
create or replace function public.set_whatsapp_business_channel_secret(
  p_channel_id uuid,
  p_secret_kind text,
  p_secret text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_name text;
  v_secret_id uuid;
begin
  if v_owner is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_secret_kind is null or p_secret_kind not in ('brain_api_key', 'meta_access_token') then
    raise exception 'Unsupported channel secret type' using errcode = '22023';
  end if;
  if p_secret is null or length(p_secret) < 12 or length(p_secret) > 8192 then
    raise exception 'Invalid channel secret length' using errcode = '22023';
  end if;

  select case p_secret_kind
    when 'brain_api_key' then 'cacador_wa_brain_' || id::text
    else 'cacador_wa_meta_' || id::text
  end
  into v_name
  from public.whatsapp_business_channels
  where id = p_channel_id and owner_id = v_owner and status <> 'revoked'
  for update;

  if v_name is null then
    raise exception 'WhatsApp channel not found for this owner' using errcode = 'P0002';
  end if;

  select id into v_secret_id
  from vault.secrets
  where name = v_name
  limit 1;

  if v_secret_id is null then
    perform vault.create_secret(p_secret, v_name, 'Caçador WhatsApp channel credential');
  else
    perform vault.update_secret(v_secret_id, p_secret, v_name, 'Caçador WhatsApp channel credential');
  end if;

  if p_secret_kind = 'brain_api_key' then
    update public.whatsapp_business_channels
      set brain_api_key_secret_name = v_name, updated_at = now()
      where id = p_channel_id and owner_id = v_owner;
  else
    update public.whatsapp_business_channels
      set meta_access_token_secret_name = v_name, updated_at = now()
      where id = p_channel_id and owner_id = v_owner;
  end if;

  return true;
end;
$$;

revoke all on function public.set_whatsapp_business_channel_secret(uuid, text, text) from public, anon;
grant execute on function public.set_whatsapp_business_channel_secret(uuid, text, text) to authenticated;

-- Server-only secret retrieval. EXECUTE is revoked from PUBLIC and all browser roles.
create or replace function public.get_whatsapp_business_channel_secret(
  p_channel_id uuid,
  p_secret_kind text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_secret text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_secret_kind is null or p_secret_kind not in ('brain_api_key', 'meta_access_token') then
    raise exception 'Unsupported channel secret type' using errcode = '22023';
  end if;

  select case p_secret_kind
    when 'brain_api_key' then brain_api_key_secret_name
    else meta_access_token_secret_name
  end
  into v_name
  from public.whatsapp_business_channels
  where id = p_channel_id and status = 'active';

  if v_name is null then
    raise exception 'Active channel secret is not configured' using errcode = 'P0002';
  end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = v_name
  limit 1;

  if v_secret is null then
    raise exception 'Channel secret is missing from Vault' using errcode = 'P0002';
  end if;
  return v_secret;
end;
$$;

revoke all on function public.get_whatsapp_business_channel_secret(uuid, text) from public, anon, authenticated;
grant execute on function public.get_whatsapp_business_channel_secret(uuid, text) to service_role;

comment on table public.whatsapp_business_channels is
  'Owner-scoped WhatsApp Business channels. Meta identifiers are immutable; active status requires trusted server-side verification. Secrets are stored in Supabase Vault.';
