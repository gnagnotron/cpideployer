-- Enable pgcrypto for gen_random_uuid
create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.environments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  base_url text not null,
  token_url text not null,
  client_id text not null,
  service_key_enc text not null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.presets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  payload jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_members_org on public.organization_members(organization_id);
create index if not exists idx_members_user on public.organization_members(user_id);
create index if not exists idx_env_org on public.environments(organization_id);
create index if not exists idx_presets_org on public.presets(organization_id);
create index if not exists idx_audit_org_created on public.audit_logs(organization_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists trg_environments_updated on public.environments;
create trigger trg_environments_updated
before update on public.environments
for each row
execute function public.set_updated_at();

drop trigger if exists trg_presets_updated on public.presets;
create trigger trg_presets_updated
before update on public.presets
for each row
execute function public.set_updated_at();

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.environments enable row level security;
alter table public.presets enable row level security;
alter table public.audit_logs enable row level security;

-- Members can see their own organization records. Backend currently uses service role,
-- but policies protect data if direct DB access is introduced later.
create policy if not exists organizations_member_read on public.organizations
for select to authenticated
using (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = organizations.id
      and m.user_id = auth.uid()
  )
);

create policy if not exists profiles_self_read on public.profiles
for select to authenticated
using (user_id = auth.uid());

create policy if not exists profiles_self_write on public.profiles
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy if not exists organization_members_member_read on public.organization_members
for select to authenticated
using (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = organization_members.organization_id
      and m.user_id = auth.uid()
  )
);

create policy if not exists environments_member_read on public.environments
for select to authenticated
using (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = environments.organization_id
      and m.user_id = auth.uid()
  )
);

create policy if not exists presets_member_read on public.presets
for select to authenticated
using (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = presets.organization_id
      and m.user_id = auth.uid()
  )
);

create policy if not exists audit_member_read on public.audit_logs
for select to authenticated
using (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = audit_logs.organization_id
      and m.user_id = auth.uid()
  )
);
