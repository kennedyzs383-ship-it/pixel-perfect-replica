begin;

select plan(11);

select has_table(
  'public',
  'whatsapp_business_channels',
  'Registry of owner-scoped WhatsApp Business channels exists'
);

select has_index(
  'public',
  'whatsapp_inbox_messages',
  'whatsapp_inbox_owner_channel_message_uidx',
  'Inbox event deduplication is scoped to owner and Business channel'
);

select has_column(
  'public',
  'whatsapp_business_channels',
  'phone_number_id',
  'Each channel is mapped to its Meta phone number identifier'
);

select has_column(
  'public',
  'whatsapp_business_channels',
  'brain_api_key_secret_name',
  'Brain credentials are referenced by Vault name, not stored in plaintext'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.whatsapp_business_channels'::regclass),
  'RLS is enabled on the WhatsApp channel registry'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'whatsapp_business_channels'
      and policyname = 'owners read their WhatsApp Business channels'
      and roles @> array['authenticated']::name[]
  ),
  'Authenticated channel management policy is owner-scoped'
);

select ok(
  not has_function_privilege('anon', 'public.get_whatsapp_business_channel_secret(uuid,text)', 'EXECUTE'),
  'Anonymous users cannot retrieve channel secrets'
);

select ok(
  not has_function_privilege('authenticated', 'public.get_whatsapp_business_channel_secret(uuid,text)', 'EXECUTE'),
  'Authenticated owners cannot retrieve decrypted channel secrets'
);

select ok(
  not has_table_privilege('authenticated', 'public.whatsapp_business_channels', 'DELETE'),
  'Owners revoke channels instead of deleting channel audit history'
);

-- Prove row-level isolation with two distinct authenticated owners.
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated',
   'wa-owner-one@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated',
   'wa-owner-two@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.whatsapp_business_channels (
  owner_id, display_name, waba_id, phone_number_id
) values
  ('11111111-1111-4111-8111-111111111111', 'Owner one channel', '100000000000001', '700000000000001'),
  ('22222222-2222-4222-8222-222222222222', 'Owner two channel', '100000000000002', '700000000000002');

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select is(
  (select count(*)::integer from public.whatsapp_business_channels),
  1,
  'Owner one can only see their own WhatsApp channel'
);

set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
select is(
  (select count(*)::integer from public.whatsapp_business_channels),
  1,
  'Owner two can only see their own WhatsApp channel'
);
reset role;

select * from finish();

rollback;
