-- Extensão aditiva do CRM do Caçador.
-- Aplicada no projeto Supabase em 2026-11-26.
-- Não remove nem altera os registos existentes.

alter table public.leads
  add column if not exists website_status text not null default 'not_checked',
  add column if not exists contact_name text,
  add column if not exists next_action text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.leads'::regclass
      and conname = 'leads_website_status_check'
  ) then
    alter table public.leads
      add constraint leads_website_status_check
      check (website_status in ('not_checked','no_website','has_website','website_issue'));
  end if;
end $$;

comment on column public.leads.website_status is 'Estado de verificação da presença digital no Caçador.';
comment on column public.leads.contact_name is 'Nome do contacto empresarial quando disponível publicamente.';
comment on column public.leads.next_action is 'Próxima ação comercial planeada pelo proprietário.';
