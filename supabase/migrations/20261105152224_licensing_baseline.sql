-- CML client licensing baseline.
-- Organizations, locations, licenses, documents, and memberships, with
-- tenant isolation enforced in Postgres. Pharmacy users only see rows for
-- organizations they belong to. CML staff are listed in platform_admins.
-- Do not authorize from auth.jwt() user_metadata: that payload is editable
-- by the end user. Staff membership lives in platform_admins.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create type public.organization_status as enum ('active', 'onboarding', 'inactive');
create type public.location_status as enum ('active', 'inactive');
create type public.license_status as enum ('active', 'pending', 'expired', 'suspended');
create type public.membership_role as enum ('pharmacy_admin', 'pharmacy_viewer');
create type public.document_kind as enum (
  'certificate',
  'application',
  'renewal',
  'correspondence',
  'other'
);

comment on type public.license_status is
  'Stored license state. "Expiring" is not stored; the app derives it when status is active and expires_on is within 90 days.';

create table public.organizations (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (char_length(btrim(name)) > 0),
  legal_name text not null check (char_length(btrim(legal_name)) > 0),
  npi text,
  status public.organization_status not null default 'active',
  city text not null,
  state text not null check (state ~ '^[A-Z]{2}$'),
  primary_contact text not null,
  contact_email text not null,
  client_since date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index organizations_name_lower_idx
  on public.organizations (lower(name));

create table public.locations (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) > 0),
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text not null check (state ~ '^[A-Z]{2}$'),
  postal_code text not null,
  phone text,
  dea_number text,
  ncpdp text,
  status public.location_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index locations_organization_id_idx
  on public.locations (organization_id);

create unique index locations_org_name_lower_idx
  on public.locations (organization_id, lower(name));

create table public.licenses (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  location_id uuid references public.locations (id) on delete set null,
  license_number text not null check (char_length(btrim(license_number)) > 0),
  license_type text not null check (char_length(btrim(license_type)) > 0),
  issuing_authority text not null check (char_length(btrim(issuing_authority)) > 0),
  state text not null check (state ~ '^[A-Z]{2}$'),
  status public.license_status not null default 'pending',
  issued_on date,
  expires_on date,
  holder_name text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint licenses_dates_ordered check (
    issued_on is null or expires_on is null or expires_on >= issued_on
  ),
  constraint licenses_identity_unique unique (organization_id, license_number, issuing_authority)
);

create index licenses_organization_id_idx on public.licenses (organization_id);
create index licenses_location_id_idx on public.licenses (location_id);
create index licenses_status_expires_idx on public.licenses (status, expires_on);
create index licenses_state_idx on public.licenses (state);

create table public.documents (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  license_id uuid not null references public.licenses (id) on delete cascade,
  title text not null check (char_length(btrim(title)) > 0),
  kind public.document_kind not null default 'other',
  file_name text,
  mime_type text,
  storage_path text,
  uploaded_on date,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index documents_organization_id_idx on public.documents (organization_id);
create index documents_license_id_idx on public.documents (license_id);

create table public.memberships (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.membership_role not null default 'pharmacy_viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memberships_user_org_unique unique (organization_id, user_id)
);

create index memberships_user_id_idx on public.memberships (user_id);
create index memberships_user_org_idx on public.memberships (user_id, organization_id);

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.platform_admins is
  'CML operators. Insert rows with the service role. Authenticated users can read only their own row.';

comment on table public.memberships is
  'Pharmacy users and the organization they may see. Users cannot insert their own membership.';

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function private.set_updated_at();

create trigger locations_set_updated_at
  before update on public.locations
  for each row execute function private.set_updated_at();

create trigger licenses_set_updated_at
  before update on public.licenses
  for each row execute function private.set_updated_at();

create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function private.set_updated_at();

create trigger memberships_set_updated_at
  before update on public.memberships
  for each row execute function private.set_updated_at();

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_admins as admin
    where admin.user_id = (select auth.uid())
  );
$$;

create or replace function private.user_organization_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select membership.organization_id
  from public.memberships as membership
  where membership.user_id = (select auth.uid());
$$;

create or replace function private.can_read_organization(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_admin()
    or exists (
      select 1
      from public.memberships as membership
      where membership.organization_id = target_organization_id
        and membership.user_id = (select auth.uid())
    );
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.is_platform_admin() from public, anon, authenticated;
revoke all on function private.user_organization_ids() from public, anon, authenticated;
revoke all on function private.can_read_organization(uuid) from public, anon, authenticated;

grant execute on function private.set_updated_at() to authenticated;
grant execute on function private.is_platform_admin() to authenticated;
grant execute on function private.user_organization_ids() to authenticated;
grant execute on function private.can_read_organization(uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.organizations force row level security;
alter table public.locations enable row level security;
alter table public.locations force row level security;
alter table public.licenses enable row level security;
alter table public.licenses force row level security;
alter table public.documents enable row level security;
alter table public.documents force row level security;
alter table public.memberships enable row level security;
alter table public.memberships force row level security;
alter table public.platform_admins enable row level security;
alter table public.platform_admins force row level security;

create policy organizations_select
  on public.organizations
  for select
  to authenticated
  using ((select private.can_read_organization(id)));

create policy organizations_insert
  on public.organizations
  for insert
  to authenticated
  with check ((select private.is_platform_admin()));

create policy organizations_update
  on public.organizations
  for update
  to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

create policy organizations_delete
  on public.organizations
  for delete
  to authenticated
  using ((select private.is_platform_admin()));

create policy locations_select
  on public.locations
  for select
  to authenticated
  using ((select private.can_read_organization(organization_id)));

create policy locations_insert
  on public.locations
  for insert
  to authenticated
  with check ((select private.is_platform_admin()));

create policy locations_update
  on public.locations
  for update
  to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

create policy locations_delete
  on public.locations
  for delete
  to authenticated
  using ((select private.is_platform_admin()));

create policy licenses_select
  on public.licenses
  for select
  to authenticated
  using ((select private.can_read_organization(organization_id)));

create policy licenses_insert
  on public.licenses
  for insert
  to authenticated
  with check ((select private.is_platform_admin()));

create policy licenses_update
  on public.licenses
  for update
  to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

create policy licenses_delete
  on public.licenses
  for delete
  to authenticated
  using ((select private.is_platform_admin()));

create policy documents_select
  on public.documents
  for select
  to authenticated
  using ((select private.can_read_organization(organization_id)));

create policy documents_insert
  on public.documents
  for insert
  to authenticated
  with check ((select private.is_platform_admin()));

create policy documents_update
  on public.documents
  for update
  to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

create policy documents_delete
  on public.documents
  for delete
  to authenticated
  using ((select private.is_platform_admin()));

create policy memberships_select
  on public.memberships
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_platform_admin())
  );

create policy memberships_insert
  on public.memberships
  for insert
  to authenticated
  with check ((select private.is_platform_admin()));

create policy memberships_update
  on public.memberships
  for update
  to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

create policy memberships_delete
  on public.memberships
  for delete
  to authenticated
  using ((select private.is_platform_admin()));

create policy platform_admins_select_self
  on public.platform_admins
  for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.organizations from public, anon;
revoke all on table public.locations from public, anon;
revoke all on table public.licenses from public, anon;
revoke all on table public.documents from public, anon;
revoke all on table public.memberships from public, anon;
revoke all on table public.platform_admins from public, anon;

grant select, insert, update, delete on table public.organizations to authenticated;
grant select, insert, update, delete on table public.locations to authenticated;
grant select, insert, update, delete on table public.licenses to authenticated;
grant select, insert, update, delete on table public.documents to authenticated;
grant select, insert, update, delete on table public.memberships to authenticated;
grant select on table public.platform_admins to authenticated;

create view public.license_portfolio
with (security_invoker = true) as
select
  license.id,
  license.organization_id,
  organization.name as organization_name,
  license.location_id,
  location.name as location_name,
  license.license_number,
  license.license_type,
  license.issuing_authority,
  license.state,
  license.status,
  license.issued_on,
  license.expires_on,
  license.holder_name,
  license.notes,
  license.updated_at
from public.licenses as license
join public.organizations as organization
  on organization.id = license.organization_id
left join public.locations as location
  on location.id = license.location_id;

comment on view public.license_portfolio is
  'Read model for the license book. security_invoker keeps the caller inside RLS on the base tables.';

revoke all on table public.license_portfolio from public, anon;
grant select on table public.license_portfolio to authenticated;

insert into storage.buckets (id, name, public)
values ('license-documents', 'license-documents', false)
on conflict (id) do nothing;

create policy license_documents_storage_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'license-documents'
    and (
      (select private.is_platform_admin())
      or (storage.foldername(name))[1] in (
        select organization_id::text from private.user_organization_ids() as organization_id
      )
    )
  );

create policy license_documents_storage_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'license-documents'
    and (select private.is_platform_admin())
  );

create policy license_documents_storage_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'license-documents'
    and (select private.is_platform_admin())
  )
  with check (
    bucket_id = 'license-documents'
    and (select private.is_platform_admin())
  );

create policy license_documents_storage_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'license-documents'
    and (select private.is_platform_admin())
  );
