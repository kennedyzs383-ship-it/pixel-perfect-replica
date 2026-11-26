-- Nuvem private infrastructure metadata schema.
-- Applied to Supabase project emcdkxxmfqgejfmfpxwe on 2026-11-26.
-- Deliberately isolated from the exposed public schema and inaccessible to anon/authenticated.

create schema if not exists nuvem_private;
revoke all on schema nuvem_private from public, anon, authenticated;
grant usage, create on schema nuvem_private to service_role;

create table if not exists nuvem_private.websites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'draft' check (status in ('draft','ready','deployed','paused','archived')),
  html_content text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists nuvem_private.domains (
  id uuid primary key default gen_random_uuid(),
  website_id uuid references nuvem_private.websites(id) on delete set null,
  hostname text not null unique,
  registrar text,
  status text not null default 'pending_dns' check (status in ('pending_purchase','pending_dns','verifying','active','failed','expired')),
  verification_token text,
  verified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint domains_hostname_lowercase check (hostname = lower(hostname))
);
create table if not exists nuvem_private.domain_dns_records (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid not null references nuvem_private.domains(id) on delete cascade,
  record_type text not null check (record_type in ('A','AAAA','CNAME','TXT','MX','CAA','NS')),
  name text not null,
  value text not null,
  ttl integer not null default 3600 check (ttl between 60 and 86400),
  priority integer,
  is_required boolean not null default true,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists nuvem_private.deployments (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references nuvem_private.websites(id) on delete cascade,
  provider text not null,
  environment text not null default 'production' check (environment in ('production','preview','staging')),
  status text not null default 'not_configured' check (status in ('not_configured','queued','building','live','failed','paused')),
  deployment_url text,
  provider_project_id text,
  last_deployed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists nuvem_private.infrastructure_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  service_type text not null check (service_type in ('hosting','dns','database','storage','email','monitoring')),
  display_name text not null,
  status text not null default 'not_connected' check (status in ('not_connected','connected','degraded','error')),
  external_resource_id text,
  public_endpoint text,
  metadata jsonb not null default '{}'::jsonb,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, service_type, display_name)
);
create index if not exists domains_website_id_idx on nuvem_private.domains(website_id);
create index if not exists dns_records_domain_id_idx on nuvem_private.domain_dns_records(domain_id);
create index if not exists deployments_website_id_idx on nuvem_private.deployments(website_id);
revoke all on all tables in schema nuvem_private from public, anon, authenticated;
revoke all on all sequences in schema nuvem_private from public, anon, authenticated;
grant select, insert, update, delete on all tables in schema nuvem_private to service_role;
grant usage, select on all sequences in schema nuvem_private to service_role;
alter default privileges in schema nuvem_private revoke all on tables from public, anon, authenticated;
alter default privileges in schema nuvem_private grant select, insert, update, delete on tables to service_role;
alter default privileges in schema nuvem_private grant usage, select on sequences to service_role;
