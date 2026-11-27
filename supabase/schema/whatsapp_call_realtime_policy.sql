-- Realtime private broadcast policy for WhatsApp call signaling.
-- The webhook sends SDP only to the owner-scoped private topic.
create policy "authenticated owner receives own WhatsApp call signals"
on realtime.messages
for select
to authenticated
using (
  extension = 'broadcast'
  and realtime.topic() = 'whatsapp-calls:' || (select auth.uid())::text
);
