begin;

select plan(6);

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
      and policyname = 'owners manage their WhatsApp Business channels'
      and roles @> array['authenticated']::name[]
  ),
  'Authenticated channel management policy is owner-scoped'
);

select * from finish();

rollback;
