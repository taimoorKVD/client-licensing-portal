-- Access control for CML staff and pharmacy tenants.
-- Authorization lives in these tables. Do not read auth.jwt() user_metadata
-- or raw_user_meta_data: end users can edit that payload. app_metadata is not
-- used for roles either, so a permission change applies on the next request
-- without waiting for a token refresh. The JWT aal claim is read only to
-- require a second factor for staff sessions.
--
-- hello@redtamarosan.com is the designated protected super admin. This
-- migration does not create that auth user and does not set a password.
-- After the user exists, run: select private.bootstrap_protected_admin();

create type public.actor_kind as enum ('staff', 'tenant');

create table public.permissions (
  key text primary key,
  scope public.actor_kind not null,
  label text not null,
  description text not null
);

create table public.roles (
  id uuid primary key,
  scope public.actor_kind not null,
  key text not null,
  name text not null,
  description text not null default '',
  system boolean not null default false,
  protected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roles_scope_key_unique unique (scope, key)
);

create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_key text not null references public.permissions (key) on delete restrict,
  primary key (role_id, permission_key)
);

create index role_permissions_permission_key_idx
  on public.role_permissions (permission_key);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null,
  actor_kind public.actor_kind not null,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_present check (char_length(btrim(email)) > 3),
  constraint profiles_display_name_present check (char_length(btrim(display_name)) > 0)
);

create unique index profiles_email_lower_idx
  on public.profiles (lower(email));

create index profiles_active_kind_idx
  on public.profiles (actor_kind)
  where disabled_at is null;

create table public.staff_assignments (
  user_id uuid primary key references public.profiles (user_id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete restrict,
  protected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index staff_assignments_role_id_idx
  on public.staff_assignments (role_id);

create table public.audit_events (
  id uuid primary key default extensions.gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  organization_id uuid,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  constraint audit_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index audit_events_occurred_at_idx
  on public.audit_events (occurred_at desc);

create index audit_events_organization_id_idx
  on public.audit_events (organization_id);

comment on table public.audit_events is
  'Append-only record of directory and book changes. Authenticated users can read it only with audit.read. Inserts go through security definer triggers.';

comment on table public.platform_admins is
  'Legacy. Authorization uses staff_assignments and role_permissions. Inserting here does not grant access.';

insert into public.permissions (key, scope, label, description) values
  ('organizations.read', 'staff', 'View organizations', 'See every pharmacy organization.'),
  ('organizations.write', 'staff', 'Edit organizations', 'Create and update pharmacy organizations.'),
  ('locations.read', 'staff', 'View locations', 'See every pharmacy location.'),
  ('locations.write', 'staff', 'Edit locations', 'Create and update pharmacy locations.'),
  ('licenses.read', 'staff', 'View licenses', 'See the full license book.'),
  ('licenses.write', 'staff', 'Edit licenses', 'Change license records and stored status.'),
  ('licenses.import', 'staff', 'Import rosters', 'Add organizations, locations, and licenses from a roster.'),
  ('documents.read', 'staff', 'View documents', 'See license documents for every pharmacy.'),
  ('documents.write', 'staff', 'Edit documents', 'Upload, replace, and remove license documents.'),
  ('users.read', 'staff', 'View people', 'See CML staff and pharmacy users.'),
  ('users.manage', 'staff', 'Manage people', 'Create users and assign roles the actor already holds.'),
  ('roles.read', 'staff', 'View roles', 'See staff and pharmacy roles.'),
  ('roles.manage', 'staff', 'Manage roles', 'Create and edit roles without granting permissions the actor lacks.'),
  ('audit.read', 'staff', 'View audit', 'Read the append-only audit trail.'),
  ('org.records.read', 'tenant', 'View pharmacy book', 'See this pharmacy''s organizations, locations, licenses, and documents.'),
  ('org.users.read', 'tenant', 'View pharmacy people', 'See users in this pharmacy.'),
  ('org.users.manage', 'tenant', 'Manage pharmacy people', 'Create and assign pharmacy users inside this pharmacy.');

insert into public.roles (id, scope, key, name, description, system, protected) values
  ('11111111-1111-4111-8111-111111111111', 'staff', 'super_admin', 'Super admin', 'Every CML permission. The protected admin keeps this role.', true, true),
  ('22222222-2222-4222-8222-222222222222', 'staff', 'cml_operator', 'CML operator', 'Works the license book and can import rosters. Cannot administer people or roles.', true, false),
  ('33333333-3333-4333-8333-333333333333', 'staff', 'cml_viewer', 'CML viewer', 'Reads the book, people, roles, and audit trail.', true, false),
  ('44444444-4444-4444-8444-444444444444', 'tenant', 'pharmacy_admin', 'Pharmacy admin', 'Reviews one pharmacy and manages its users.', true, false),
  ('55555555-5555-4555-8555-555555555555', 'tenant', 'pharmacy_viewer', 'Pharmacy viewer', 'Reviews one pharmacy. Cannot manage users.', true, false);

-- role:super_admin
insert into public.role_permissions (role_id, permission_key)
select '11111111-1111-4111-8111-111111111111', permission.key
from public.permissions as permission
where permission.scope = 'staff';

-- role:cml_operator
insert into public.role_permissions (role_id, permission_key)
select '22222222-2222-4222-8222-222222222222', permission.key
from public.permissions as permission
where permission.key in (
  'organizations.read',
  'organizations.write',
  'locations.read',
  'locations.write',
  'licenses.read',
  'licenses.write',
  'licenses.import',
  'documents.read',
  'documents.write',
  'audit.read'
);

-- role:cml_viewer
insert into public.role_permissions (role_id, permission_key)
select '33333333-3333-4333-8333-333333333333', permission.key
from public.permissions as permission
where permission.key in (
  'organizations.read',
  'locations.read',
  'licenses.read',
  'documents.read',
  'users.read',
  'roles.read',
  'audit.read'
);

-- role:pharmacy_admin
insert into public.role_permissions (role_id, permission_key)
select '44444444-4444-4444-8444-444444444444', permission.key
from public.permissions as permission
where permission.key in (
  'org.records.read',
  'org.users.read',
  'org.users.manage'
);

-- role:pharmacy_viewer
insert into public.role_permissions (role_id, permission_key)
select '55555555-5555-4555-8555-555555555555', permission.key
from public.permissions as permission
where permission.key in ('org.records.read');

alter table public.memberships
  add column role_id uuid references public.roles (id) on delete restrict;

delete from public.memberships as membership
using public.platform_admins as admin
where membership.user_id = admin.user_id;

update public.memberships as membership
set role_id = role.id
from public.roles as role
where role.scope = 'tenant'
  and role.key = membership.role::text;

do $$
begin
  if exists (select 1 from public.memberships where role_id is null) then
    raise exception 'A membership role could not be mapped to a pharmacy role.';
  end if;
end $$;

alter table public.memberships alter column role_id set not null;
alter table public.memberships drop column role;
drop type public.membership_role;

create index memberships_role_id_idx on public.memberships (role_id);

insert into public.profiles (user_id, email, display_name, actor_kind)
select
  users.id,
  coalesce(users.email, 'staff-' || users.id::text || '@users.invalid'),
  coalesce(nullif(btrim(users.email), ''), 'CML staff'),
  'staff'
from public.platform_admins as admin
join auth.users as users on users.id = admin.user_id
on conflict (user_id) do nothing;

insert into public.staff_assignments (user_id, role_id, protected)
select
  admin.user_id,
  '11111111-1111-4111-8111-111111111111',
  lower(coalesce(users.email, '')) = 'hello@redtamarosan.com'
from public.platform_admins as admin
join auth.users as users on users.id = admin.user_id
on conflict (user_id) do nothing;

insert into public.profiles (user_id, email, display_name, actor_kind)
select distinct
  users.id,
  coalesce(users.email, 'pharmacy-' || users.id::text || '@users.invalid'),
  coalesce(nullif(btrim(users.email), ''), 'Pharmacy user'),
  'tenant'
from public.memberships as membership
join auth.users as users on users.id = membership.user_id
on conflict (user_id) do nothing;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create trigger roles_set_updated_at
  before update on public.roles
  for each row execute function private.set_updated_at();

create trigger staff_assignments_set_updated_at
  before update on public.staff_assignments
  for each row execute function private.set_updated_at();

create or replace function private.protected_admin_email()
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select 'hello@redtamarosan.com'::text;
$$;

create or replace function private.is_designated_admin(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select lower(coalesce((
    select users.email from auth.users as users where users.id = target_user_id
  ), '')) = private.protected_admin_email()
  or lower(coalesce((
    select profile.email from public.profiles as profile where profile.user_id = target_user_id
  ), '')) = private.protected_admin_email();
$$;

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    join public.staff_assignments as assignment
      on assignment.user_id = profile.user_id
    where profile.user_id = (select auth.uid())
      and profile.actor_kind = 'staff'
      and profile.disabled_at is null
  );
$$;

create or replace function private.has_staff_permission(requested_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_assignments as assignment
    join public.profiles as profile
      on profile.user_id = assignment.user_id
    join public.roles as role
      on role.id = assignment.role_id
    join public.role_permissions as granted
      on granted.role_id = assignment.role_id
    join public.permissions as permission
      on permission.key = granted.permission_key
    where assignment.user_id = (select auth.uid())
      and profile.actor_kind = 'staff'
      and profile.disabled_at is null
      and role.scope = 'staff'
      and permission.scope = 'staff'
      and granted.permission_key = requested_permission
  );
$$;

create or replace function private.has_tenant_permission(
  target_organization_id uuid,
  requested_permission text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships as membership
    join public.profiles as profile
      on profile.user_id = membership.user_id
    join public.roles as role
      on role.id = membership.role_id
    join public.role_permissions as granted
      on granted.role_id = membership.role_id
    join public.permissions as permission
      on permission.key = granted.permission_key
    where membership.user_id = (select auth.uid())
      and membership.organization_id = target_organization_id
      and profile.actor_kind = 'tenant'
      and profile.disabled_at is null
      and role.scope = 'tenant'
      and permission.scope = 'tenant'
      and granted.permission_key = requested_permission
  );
$$;

create or replace function private.caller_may_use_data()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.user_id = (select auth.uid())
      and profile.disabled_at is null
      and (
        profile.actor_kind = 'tenant'
        or coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
      )
  );
$$;

create or replace function private.can_read_organization(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.caller_may_use_data()
    and (
      private.has_staff_permission('organizations.read')
      or private.has_staff_permission('organizations.write')
      or private.has_staff_permission('locations.read')
      or private.has_staff_permission('locations.write')
      or private.has_staff_permission('licenses.read')
      or private.has_staff_permission('licenses.write')
      or private.has_staff_permission('licenses.import')
      or private.has_staff_permission('documents.read')
      or private.has_staff_permission('documents.write')
      or private.has_staff_permission('users.manage')
      or private.has_tenant_permission(target_organization_id, 'org.records.read')
    );
$$;

create or replace function private.current_permissions()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    array_agg(granted.permission_key order by granted.permission_key),
    '{}'::text[]
  )
  from (
    select distinct role_permission.permission_key
    from public.profiles as profile
    join public.role_permissions as role_permission
      on role_permission.role_id in (
        select assignment.role_id
        from public.staff_assignments as assignment
        where assignment.user_id = profile.user_id
          and profile.actor_kind = 'staff'
        union
        select membership.role_id
        from public.memberships as membership
        where membership.user_id = profile.user_id
          and profile.actor_kind = 'tenant'
      )
    where profile.user_id = (select auth.uid())
      and profile.disabled_at is null
  ) as granted;
$$;

create or replace function private.actor_can_assign_role(
  target_role_id uuid,
  target_organization_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  role_scope public.actor_kind;
  missing boolean;
begin
  select role.scope into role_scope
  from public.roles as role
  where role.id = target_role_id;

  if role_scope is null then
    return false;
  end if;

  if private.has_staff_permission('users.manage') and private.caller_may_use_data() then
    if role_scope = 'tenant' then
      return true;
    end if;
    select exists (
      select 1
      from public.role_permissions as granted
      join public.permissions as permission
        on permission.key = granted.permission_key
      where granted.role_id = target_role_id
        and permission.scope = 'staff'
        and not private.has_staff_permission(granted.permission_key)
    ) into missing;
    return not missing;
  end if;

  if target_organization_id is not null
     and role_scope = 'tenant'
     and private.has_tenant_permission(target_organization_id, 'org.users.manage') then
    select exists (
      select 1
      from public.role_permissions as granted
      join public.permissions as permission
        on permission.key = granted.permission_key
      where granted.role_id = target_role_id
        and permission.scope = 'tenant'
        and not private.has_tenant_permission(target_organization_id, granted.permission_key)
    ) into missing;
    return not missing;
  end if;

  return false;
end;
$$;

create or replace function private.record_admin_event(
  event_action text,
  event_entity_type text,
  event_entity_id text,
  event_organization_id uuid,
  event_summary text,
  event_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'Not signed in.';
  end if;
  if event_metadata ? 'password'
     or event_metadata ? 'secret'
     or event_metadata ? 'token'
     or event_metadata ? 'access_token'
     or event_metadata ? 'refresh_token' then
    raise exception 'Refusing to store a secret in the audit log.';
  end if;

  select
    private.has_staff_permission('users.manage')
    or private.has_staff_permission('roles.manage')
    or exists (
      select 1
      from public.memberships as membership
      where membership.user_id = (select auth.uid())
        and private.has_tenant_permission(membership.organization_id, 'org.users.manage')
    )
  into allowed;

  if not allowed or not private.caller_may_use_data() then
    raise exception 'You cannot write the audit log.';
  end if;

  insert into public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    organization_id,
    summary,
    metadata
  ) values (
    (select auth.uid()),
    event_action,
    event_entity_type,
    event_entity_id,
    event_organization_id,
    event_summary,
    coalesce(event_metadata, '{}'::jsonb)
  );
end;
$$;

create or replace function public.record_admin_event(
  event_action text,
  event_entity_type text,
  event_entity_id text,
  event_organization_id uuid,
  event_summary text,
  event_metadata jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.record_admin_event(
    event_action,
    event_entity_type,
    event_entity_id,
    event_organization_id,
    event_summary,
    event_metadata
  );
end;
$$;

create or replace function private.protect_profiles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  protected_assignment boolean;
begin
  if tg_op = 'DELETE' then
    select exists (
      select 1
      from public.staff_assignments as assignment
      where assignment.user_id = old.user_id
        and assignment.protected
    ) into protected_assignment;
    if protected_assignment or lower(old.email) = private.protected_admin_email() then
      raise exception 'The protected super admin cannot be deleted.';
    end if;
    return old;
  end if;

  if lower(new.email) = private.protected_admin_email()
     and (new.actor_kind <> 'staff' or new.disabled_at is not null) then
    raise exception 'hello@redtamarosan.com is reserved as the protected super admin.';
  end if;

  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      raise exception 'Profile identity cannot be changed.';
    end if;
    if old.actor_kind is distinct from new.actor_kind
       and lower(new.email) is distinct from private.protected_admin_email() then
      raise exception 'Staff and pharmacy accounts stay in their own directory.';
    end if;
    select exists (
      select 1
      from public.staff_assignments as assignment
      where assignment.user_id = old.user_id
        and assignment.protected
    ) into protected_assignment;
    if protected_assignment and (
      new.disabled_at is not null
      or new.actor_kind <> 'staff'
      or lower(new.email) is distinct from private.protected_admin_email()
    ) then
      raise exception 'The protected super admin cannot be demoted or disabled.';
    end if;
    if new.disabled_at is distinct from old.disabled_at
       and old.user_id = (select auth.uid()) then
      raise exception 'You cannot disable your own account.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.enforce_membership_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  kind public.actor_kind;
  role_scope public.actor_kind;
begin
  if tg_op = 'DELETE' then
    if old.user_id = (select auth.uid()) then
      raise exception 'You cannot remove your own access.';
    end if;
    return old;
  end if;

  select profile.actor_kind into kind
  from public.profiles as profile
  where profile.user_id = new.user_id;
  select role.scope into role_scope
  from public.roles as role
  where role.id = new.role_id;

  if kind is distinct from 'tenant' then
    raise exception 'Pharmacy memberships are only for pharmacy users.';
  end if;
  if role_scope is distinct from 'tenant' then
    raise exception 'Pharmacy memberships require a pharmacy role.';
  end if;
  if tg_op = 'UPDATE' and new.user_id = (select auth.uid()) and (
    new.role_id is distinct from old.role_id
    or new.organization_id is distinct from old.organization_id
  ) then
    raise exception 'You cannot change your own role.';
  end if;
  return new;
end;
$$;

create or replace function private.enforce_staff_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  kind public.actor_kind;
  role_scope public.actor_kind;
  super_id uuid := '11111111-1111-4111-8111-111111111111';
begin
  if tg_op = 'DELETE' then
    if old.protected then
      raise exception 'The protected super admin cannot be deleted.';
    end if;
    if old.user_id = (select auth.uid()) then
      raise exception 'You cannot remove your own access.';
    end if;
    return old;
  end if;

  select profile.actor_kind into kind
  from public.profiles as profile
  where profile.user_id = new.user_id;
  select role.scope into role_scope
  from public.roles as role
  where role.id = new.role_id;

  if kind is distinct from 'staff' then
    raise exception 'CML staff roles are only for CML staff.';
  end if;
  if role_scope is distinct from 'staff' then
    raise exception 'CML staff require a staff role.';
  end if;

  if private.is_designated_admin(new.user_id) then
    if not new.protected or new.role_id is distinct from super_id then
      raise exception 'The protected super admin cannot be demoted.';
    end if;
  elsif new.protected then
    raise exception 'Only hello@redtamarosan.com can be the protected super admin.';
  end if;

  if tg_op = 'UPDATE' and old.protected and (
    not new.protected
    or new.role_id is distinct from old.role_id
    or new.user_id is distinct from old.user_id
  ) then
    raise exception 'The protected super admin cannot be demoted.';
  end if;

  if tg_op = 'INSERT'
     and new.user_id = (select auth.uid())
     and session_user = 'authenticated' then
    raise exception 'You cannot assign your own role.';
  end if;

  if tg_op = 'UPDATE'
     and old.user_id = (select auth.uid())
     and (
       new.role_id is distinct from old.role_id
       or new.protected is distinct from old.protected
     ) then
    raise exception 'You cannot change your own role.';
  end if;

  return new;
end;
$$;

create or replace function private.protect_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.system or old.protected then
      raise exception 'System roles cannot be deleted.';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.protected or new.system then
      raise exception 'System roles are created by migrations only.';
    end if;
    return new;
  end if;

  if new.key is distinct from old.key
     or new.scope is distinct from old.scope
     or new.protected is distinct from old.protected
     or new.system is distinct from old.system
     or new.id is distinct from old.id then
    raise exception 'Role identity cannot be changed.';
  end if;

  if old.protected and (
    new.name is distinct from old.name
    or new.description is distinct from old.description
  ) then
    raise exception 'The super admin role cannot be edited.';
  end if;

  return new;
end;
$$;

create or replace function private.protect_role_permissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_role_id uuid;
  is_protected boolean;
  role_scope public.actor_kind;
  permission_scope public.actor_kind;
begin
  target_role_id := coalesce(new.role_id, old.role_id);
  select role.protected, role.scope
  into is_protected, role_scope
  from public.roles as role
  where role.id = target_role_id;

  if is_protected then
    raise exception 'The super admin role permissions are fixed.';
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select permission.scope into permission_scope
    from public.permissions as permission
    where permission.key = new.permission_key;
    if permission_scope is distinct from role_scope then
      raise exception 'A role can only include permissions from its own scope.';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function private.protect_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_protected boolean;
begin
  select exists (
    select 1
    from public.staff_assignments as assignment
    where assignment.user_id = old.id
      and assignment.protected
  ) into is_protected;

  if is_protected and tg_op = 'DELETE' then
    raise exception 'The protected super admin cannot be deleted.';
  end if;

  if is_protected and tg_op = 'UPDATE' and new.email is distinct from old.email then
    raise exception 'The protected super admin email cannot be changed.';
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function private.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_id uuid;
  entity text;
  event_summary text;
  meta jsonb := '{}'::jsonb;
begin
  if tg_table_name = 'organizations' then
    org_id := coalesce(new.id, old.id);
    entity := coalesce(new.id, old.id)::text;
    event_summary := tg_op || ' organization ' || coalesce(new.name, old.name);
  elsif tg_table_name = 'staff_assignments' then
    entity := coalesce(new.user_id, old.user_id)::text;
    event_summary := tg_op || ' staff role';
    meta := jsonb_build_object(
      'role_id', coalesce(new.role_id, old.role_id),
      'protected', coalesce(new.protected, old.protected)
    );
  elsif tg_table_name = 'profiles' then
    entity := coalesce(new.user_id, old.user_id)::text;
    event_summary := tg_op || ' profile ' || coalesce(new.email, old.email);
    meta := jsonb_build_object(
      'actor_kind', coalesce(new.actor_kind, old.actor_kind)::text,
      'disabled', coalesce(new.disabled_at, old.disabled_at) is not null
    );
  elsif tg_table_name = 'roles' then
    entity := coalesce(new.id, old.id)::text;
    event_summary := tg_op || ' role ' || coalesce(new.key, old.key);
  elsif tg_table_name = 'role_permissions' then
    entity := coalesce(new.role_id, old.role_id)::text;
    event_summary := tg_op || ' permission ' || coalesce(new.permission_key, old.permission_key);
  else
    org_id := coalesce(new.organization_id, old.organization_id);
    entity := coalesce(new.id, old.id)::text;
    event_summary := tg_op || ' ' || tg_table_name;
    if tg_table_name = 'licenses' and tg_op = 'UPDATE' then
      meta := jsonb_build_object(
        'license_number', new.license_number,
        'from', old.status,
        'to', new.status
      );
      event_summary := 'License ' || new.license_number || ' status ' || old.status::text || ' -> ' || new.status::text;
    end if;
  end if;

  insert into public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    organization_id,
    summary,
    metadata
  ) values (
    (select auth.uid()),
    lower(tg_op) || '.' || tg_table_name,
    tg_table_name,
    entity,
    org_id,
    event_summary,
    meta
  );

  return coalesce(new, old);
end;
$$;

create trigger profiles_protect
  before insert or update or delete on public.profiles
  for each row execute function private.protect_profiles();

create trigger memberships_scope
  before insert or update or delete on public.memberships
  for each row execute function private.enforce_membership_scope();

create trigger staff_assignments_scope
  before insert or update or delete on public.staff_assignments
  for each row execute function private.enforce_staff_assignment();

create trigger roles_protect
  before insert or update or delete on public.roles
  for each row execute function private.protect_roles();

create trigger role_permissions_protect
  before insert or update or delete on public.role_permissions
  for each row execute function private.protect_role_permissions();

create trigger auth_users_protect_admin_email
  before update of email on auth.users
  for each row execute function private.protect_auth_user();

create trigger auth_users_protect_admin_delete
  before delete on auth.users
  for each row execute function private.protect_auth_user();

create trigger organizations_audit
  after insert or update or delete on public.organizations
  for each row execute function private.audit_row();

create trigger locations_audit
  after insert or update or delete on public.locations
  for each row execute function private.audit_row();

create trigger licenses_audit
  after insert or update or delete on public.licenses
  for each row execute function private.audit_row();

create trigger documents_audit
  after insert or update or delete on public.documents
  for each row execute function private.audit_row();

create trigger memberships_audit
  after insert or update or delete on public.memberships
  for each row execute function private.audit_row();

create trigger profiles_audit
  after insert or update or delete on public.profiles
  for each row execute function private.audit_row();

create trigger staff_assignments_audit
  after insert or update or delete on public.staff_assignments
  for each row execute function private.audit_row();

create trigger roles_audit
  after insert or update or delete on public.roles
  for each row execute function private.audit_row();

create trigger role_permissions_audit
  after insert or update or delete on public.role_permissions
  for each row execute function private.audit_row();

create or replace function private.bootstrap_protected_admin()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
  target_email text;
begin
  if session_user not in ('postgres', 'supabase_admin') then
    raise exception 'bootstrap_protected_admin can only be run from the SQL editor or a database migration.';
  end if;

  select users.id, users.email
  into target_id, target_email
  from auth.users as users
  where lower(users.email) = private.protected_admin_email()
  limit 1;

  if target_id is null then
    raise exception 'Auth user hello@redtamarosan.com does not exist. Create that user in the Supabase Auth dashboard with a password you keep outside this repository. This function does not create the user or set a password.';
  end if;

  delete from public.memberships as membership
  where membership.user_id = target_id;

  insert into public.profiles (user_id, email, display_name, actor_kind, disabled_at)
  values (target_id, target_email, 'CML Super Admin', 'staff', null)
  on conflict (user_id) do update
    set email = excluded.email,
        display_name = excluded.display_name,
        actor_kind = 'staff',
        disabled_at = null;

  insert into public.staff_assignments (user_id, role_id, protected)
  values (target_id, '11111111-1111-4111-8111-111111111111', true)
  on conflict (user_id) do update
    set role_id = excluded.role_id,
        protected = true;

  return target_id;
end;
$$;

comment on function private.bootstrap_protected_admin() is
  'Binds the existing auth user hello@redtamarosan.com as the immutable super admin. Does not create the user or choose a password.';

revoke all on function private.protected_admin_email() from public, anon, authenticated;
revoke all on function private.is_designated_admin(uuid) from public, anon, authenticated;
revoke all on function private.is_platform_admin() from public, anon, authenticated;
revoke all on function private.has_staff_permission(text) from public, anon, authenticated;
revoke all on function private.has_tenant_permission(uuid, text) from public, anon, authenticated;
revoke all on function private.caller_may_use_data() from public, anon, authenticated;
revoke all on function private.can_read_organization(uuid) from public, anon, authenticated;
revoke all on function private.current_permissions() from public, anon, authenticated;
revoke all on function private.actor_can_assign_role(uuid, uuid) from public, anon, authenticated;
revoke all on function private.record_admin_event(text, text, text, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function private.protect_profiles() from public, anon, authenticated;
revoke all on function private.enforce_membership_scope() from public, anon, authenticated;
revoke all on function private.enforce_staff_assignment() from public, anon, authenticated;
revoke all on function private.protect_roles() from public, anon, authenticated;
revoke all on function private.protect_role_permissions() from public, anon, authenticated;
revoke all on function private.protect_auth_user() from public, anon, authenticated;
revoke all on function private.audit_row() from public, anon, authenticated;
revoke all on function private.bootstrap_protected_admin() from public, anon, authenticated, service_role;
revoke all on function public.record_admin_event(text, text, text, uuid, text, jsonb) from public, anon, authenticated;

grant execute on function private.protected_admin_email() to authenticated;
grant execute on function private.is_designated_admin(uuid) to authenticated;
grant execute on function private.is_platform_admin() to authenticated;
grant execute on function private.has_staff_permission(text) to authenticated;
grant execute on function private.has_tenant_permission(uuid, text) to authenticated;
grant execute on function private.caller_may_use_data() to authenticated;
grant execute on function private.can_read_organization(uuid) to authenticated;
grant execute on function private.current_permissions() to authenticated;
grant execute on function private.actor_can_assign_role(uuid, uuid) to authenticated;
grant execute on function private.record_admin_event(text, text, text, uuid, text, jsonb) to authenticated;
grant execute on function private.protect_profiles() to authenticated, service_role;
grant execute on function private.enforce_membership_scope() to authenticated, service_role;
grant execute on function private.enforce_staff_assignment() to authenticated, service_role;
grant execute on function private.protect_roles() to authenticated, service_role;
grant execute on function private.protect_role_permissions() to authenticated, service_role;
grant execute on function private.audit_row() to authenticated, service_role;
grant execute on function private.protect_auth_user() to service_role;
grant execute on function public.record_admin_event(text, text, text, uuid, text, jsonb) to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function private.protect_auth_user() to supabase_auth_admin;
  end if;
end $$;

drop policy if exists organizations_select on public.organizations;
drop policy if exists organizations_insert on public.organizations;
drop policy if exists organizations_update on public.organizations;
drop policy if exists organizations_delete on public.organizations;
drop policy if exists locations_select on public.locations;
drop policy if exists locations_insert on public.locations;
drop policy if exists locations_update on public.locations;
drop policy if exists locations_delete on public.locations;
drop policy if exists licenses_select on public.licenses;
drop policy if exists licenses_insert on public.licenses;
drop policy if exists licenses_update on public.licenses;
drop policy if exists licenses_delete on public.licenses;
drop policy if exists documents_select on public.documents;
drop policy if exists documents_insert on public.documents;
drop policy if exists documents_update on public.documents;
drop policy if exists documents_delete on public.documents;
drop policy if exists memberships_select on public.memberships;
drop policy if exists memberships_insert on public.memberships;
drop policy if exists memberships_update on public.memberships;
drop policy if exists memberships_delete on public.memberships;
drop policy if exists platform_admins_select_self on public.platform_admins;
drop policy if exists license_documents_storage_select on storage.objects;
drop policy if exists license_documents_storage_insert on storage.objects;
drop policy if exists license_documents_storage_update on storage.objects;
drop policy if exists license_documents_storage_delete on storage.objects;

alter table public.permissions enable row level security;
alter table public.permissions force row level security;
alter table public.roles enable row level security;
alter table public.roles force row level security;
alter table public.role_permissions enable row level security;
alter table public.role_permissions force row level security;
alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.staff_assignments enable row level security;
alter table public.staff_assignments force row level security;
alter table public.audit_events enable row level security;
alter table public.audit_events force row level security;

create policy book_requires_active_session
  on public.organizations
  as restrictive
  to authenticated
  using ((select private.caller_may_use_data()))
  with check ((select private.caller_may_use_data()));

create policy locations_require_active_session
  on public.locations
  as restrictive
  to authenticated
  using ((select private.caller_may_use_data()))
  with check ((select private.caller_may_use_data()));

create policy licenses_require_active_session
  on public.licenses
  as restrictive
  to authenticated
  using ((select private.caller_may_use_data()))
  with check ((select private.caller_may_use_data()));

create policy documents_require_active_session
  on public.documents
  as restrictive
  to authenticated
  using ((select private.caller_may_use_data()))
  with check ((select private.caller_may_use_data()));

create policy audit_requires_active_session
  on public.audit_events
  as restrictive
  to authenticated
  using ((select private.caller_may_use_data()))
  with check ((select private.caller_may_use_data()));

create policy organizations_select
  on public.organizations
  for select
  to authenticated
  using ((select private.can_read_organization(id)));

create policy organizations_insert
  on public.organizations
  for insert
  to authenticated
  with check (
    (select private.has_staff_permission('organizations.write'))
    or (select private.has_staff_permission('licenses.import'))
  );

create policy organizations_update
  on public.organizations
  for update
  to authenticated
  using ((select private.has_staff_permission('organizations.write')))
  with check ((select private.has_staff_permission('organizations.write')));

create policy organizations_delete
  on public.organizations
  for delete
  to authenticated
  using ((select private.has_staff_permission('organizations.write')));

create policy locations_select
  on public.locations
  for select
  to authenticated
  using (
    (select private.has_staff_permission('locations.read'))
    or (select private.has_staff_permission('locations.write'))
    or (select private.has_staff_permission('licenses.import'))
    or (select private.has_tenant_permission(organization_id, 'org.records.read'))
  );

create policy locations_insert
  on public.locations
  for insert
  to authenticated
  with check (
    (select private.has_staff_permission('locations.write'))
    or (select private.has_staff_permission('licenses.import'))
  );

create policy locations_update
  on public.locations
  for update
  to authenticated
  using (
    (select private.has_staff_permission('locations.write'))
    or (select private.has_staff_permission('licenses.import'))
  )
  with check (
    (select private.has_staff_permission('locations.write'))
    or (select private.has_staff_permission('licenses.import'))
  );

create policy locations_delete
  on public.locations
  for delete
  to authenticated
  using ((select private.has_staff_permission('locations.write')));

create policy licenses_select
  on public.licenses
  for select
  to authenticated
  using (
    (select private.has_staff_permission('licenses.read'))
    or (select private.has_staff_permission('licenses.write'))
    or (select private.has_staff_permission('licenses.import'))
    or (select private.has_tenant_permission(organization_id, 'org.records.read'))
  );

create policy licenses_insert
  on public.licenses
  for insert
  to authenticated
  with check (
    (select private.has_staff_permission('licenses.write'))
    or (select private.has_staff_permission('licenses.import'))
  );

create policy licenses_update
  on public.licenses
  for update
  to authenticated
  using ((select private.has_staff_permission('licenses.write')))
  with check ((select private.has_staff_permission('licenses.write')));

create policy licenses_delete
  on public.licenses
  for delete
  to authenticated
  using ((select private.has_staff_permission('licenses.write')));

create policy documents_select
  on public.documents
  for select
  to authenticated
  using (
    (select private.has_staff_permission('documents.read'))
    or (select private.has_staff_permission('documents.write'))
    or (select private.has_tenant_permission(organization_id, 'org.records.read'))
  );

create policy documents_insert
  on public.documents
  for insert
  to authenticated
  with check ((select private.has_staff_permission('documents.write')));

create policy documents_update
  on public.documents
  for update
  to authenticated
  using ((select private.has_staff_permission('documents.write')))
  with check ((select private.has_staff_permission('documents.write')));

create policy documents_delete
  on public.documents
  for delete
  to authenticated
  using ((select private.has_staff_permission('documents.write')));

create policy memberships_select
  on public.memberships
  for select
  to authenticated
  using (
    (
      user_id = (select auth.uid())
      and exists (
        select 1
        from public.profiles as profile
        where profile.user_id = (select auth.uid())
          and profile.disabled_at is null
      )
    )
    or (
      (select private.caller_may_use_data())
      and (
        (select private.has_staff_permission('users.read'))
        or (select private.has_staff_permission('users.manage'))
        or (select private.has_tenant_permission(organization_id, 'org.users.read'))
        or (select private.has_tenant_permission(organization_id, 'org.users.manage'))
      )
    )
  );

create policy memberships_insert
  on public.memberships
  for insert
  to authenticated
  with check (
    (select private.caller_may_use_data())
    and (select private.actor_can_assign_role(role_id, organization_id))
    and user_id <> (select auth.uid())
  );

create policy memberships_update
  on public.memberships
  for update
  to authenticated
  using (
    (select private.caller_may_use_data())
    and user_id <> (select auth.uid())
    and (
      (select private.has_staff_permission('users.manage'))
      or (select private.has_tenant_permission(organization_id, 'org.users.manage'))
    )
  )
  with check (
    (select private.caller_may_use_data())
    and (select private.actor_can_assign_role(role_id, organization_id))
    and user_id <> (select auth.uid())
  );

create policy memberships_delete
  on public.memberships
  for delete
  to authenticated
  using (
    (select private.caller_may_use_data())
    and user_id <> (select auth.uid())
    and (
      (select private.has_staff_permission('users.manage'))
      or (select private.has_tenant_permission(organization_id, 'org.users.manage'))
    )
  );

create policy platform_admins_select_self
  on public.platform_admins
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy permissions_select
  on public.permissions
  for select
  to authenticated
  using (true);

create policy roles_select
  on public.roles
  for select
  to authenticated
  using (
    id in (
      select assignment.role_id
      from public.staff_assignments as assignment
      where assignment.user_id = (select auth.uid())
    )
    or id in (
      select membership.role_id
      from public.memberships as membership
      where membership.user_id = (select auth.uid())
    )
    or (
      (select private.caller_may_use_data())
      and (
        (select private.has_staff_permission('roles.read'))
        or (select private.has_staff_permission('roles.manage'))
        or (select private.has_staff_permission('users.manage'))
      )
    )
    or (
      scope = 'tenant'
      and exists (
        select 1
        from public.memberships as membership
        where membership.user_id = (select auth.uid())
          and private.has_tenant_permission(membership.organization_id, 'org.users.manage')
      )
    )
  );

create policy roles_insert
  on public.roles
  for insert
  to authenticated
  with check (
    (select private.caller_may_use_data())
    and (select private.has_staff_permission('roles.manage'))
    and not protected
    and not system
  );

create policy roles_update
  on public.roles
  for update
  to authenticated
  using (
    (select private.caller_may_use_data())
    and (select private.has_staff_permission('roles.manage'))
    and not protected
    and id <> (
      select assignment.role_id
      from public.staff_assignments as assignment
      where assignment.user_id = (select auth.uid())
    )
  )
  with check (not protected);

create policy roles_delete
  on public.roles
  for delete
  to authenticated
  using (
    (select private.caller_may_use_data())
    and (select private.has_staff_permission('roles.manage'))
    and not system
    and not protected
  );

create policy role_permissions_select
  on public.role_permissions
  for select
  to authenticated
  using (
    role_id in (
      select assignment.role_id
      from public.staff_assignments as assignment
      where assignment.user_id = (select auth.uid())
    )
    or role_id in (
      select membership.role_id
      from public.memberships as membership
      where membership.user_id = (select auth.uid())
    )
    or (
      (select private.caller_may_use_data())
      and (
        (select private.has_staff_permission('roles.read'))
        or (select private.has_staff_permission('roles.manage'))
        or (select private.has_staff_permission('users.manage'))
      )
    )
    or (
      exists (
        select 1
        from public.roles as role
        where role.id = role_id
          and role.scope = 'tenant'
      )
      and exists (
        select 1
        from public.memberships as membership
        where membership.user_id = (select auth.uid())
          and private.has_tenant_permission(membership.organization_id, 'org.users.manage')
      )
    )
  );

create policy role_permissions_insert
  on public.role_permissions
  for insert
  to authenticated
  with check (
    (select private.caller_may_use_data())
    and (select private.has_staff_permission('roles.manage'))
    and not exists (
      select 1 from public.roles as role
      where role.id = role_id and role.protected
    )
    and role_id <> (
      select assignment.role_id
      from public.staff_assignments as assignment
      where assignment.user_id = (select auth.uid())
    )
    and (
      exists (
        select 1
        from public.permissions as permission
        join public.roles as role on role.id = role_id
        where permission.key = permission_key
          and permission.scope = role.scope
          and (
            permission.scope = 'tenant'
            or (select private.has_staff_permission(permission.key))
          )
      )
    )
  );

create policy role_permissions_delete
  on public.role_permissions
  for delete
  to authenticated
  using (
    (select private.caller_may_use_data())
    and (select private.has_staff_permission('roles.manage'))
    and not exists (
      select 1 from public.roles as role
      where role.id = role_id and role.protected
    )
    and role_id <> (
      select assignment.role_id
      from public.staff_assignments as assignment
      where assignment.user_id = (select auth.uid())
    )
  );

create policy profiles_select
  on public.profiles
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (
      (select private.caller_may_use_data())
      and (
        (select private.has_staff_permission('users.read'))
        or (select private.has_staff_permission('users.manage'))
      )
    )
    or exists (
      select 1
      from public.memberships as membership
      where membership.user_id = profiles.user_id
        and (
          (select private.has_tenant_permission(membership.organization_id, 'org.users.read'))
          or (select private.has_tenant_permission(membership.organization_id, 'org.users.manage'))
        )
    )
  );

create policy profiles_insert
  on public.profiles
  for insert
  to authenticated
  with check (
    (
      (select private.caller_may_use_data())
      and (select private.has_staff_permission('users.manage'))
    )
    or (
      actor_kind = 'tenant'
      and exists (
        select 1
        from public.memberships as membership
        where membership.user_id = (select auth.uid())
          and private.has_tenant_permission(membership.organization_id, 'org.users.manage')
      )
    )
  );

create policy profiles_update
  on public.profiles
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    or (
      (select private.caller_may_use_data())
      and (select private.has_staff_permission('users.manage'))
    )
    or (
      actor_kind = 'tenant'
      and exists (
        select 1
        from public.memberships as membership
        where membership.user_id = profiles.user_id
          and private.has_tenant_permission(membership.organization_id, 'org.users.manage')
      )
    )
  )
  with check (
    user_id = (select auth.uid())
    or (
      (select private.caller_may_use_data())
      and (select private.has_staff_permission('users.manage'))
    )
    or (
      actor_kind = 'tenant'
      and exists (
        select 1
        from public.memberships as membership
        where membership.user_id = profiles.user_id
          and private.has_tenant_permission(membership.organization_id, 'org.users.manage')
      )
    )
  );

create policy profiles_delete
  on public.profiles
  for delete
  to authenticated
  using (
    user_id <> (select auth.uid())
    and (select private.caller_may_use_data())
    and (
      (select private.has_staff_permission('users.manage'))
      or (
        actor_kind = 'tenant'
        and exists (
          select 1
          from public.memberships as membership
          where membership.user_id = profiles.user_id
            and private.has_tenant_permission(membership.organization_id, 'org.users.manage')
        )
      )
    )
  );

create policy staff_assignments_select
  on public.staff_assignments
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (
      (select private.caller_may_use_data())
      and (
        (select private.has_staff_permission('users.read'))
        or (select private.has_staff_permission('users.manage'))
      )
    )
  );

create policy staff_assignments_insert
  on public.staff_assignments
  for insert
  to authenticated
  with check (
    (select private.caller_may_use_data())
    and protected = false
    and user_id <> (select auth.uid())
    and (select private.actor_can_assign_role(role_id, null))
  );

create policy staff_assignments_update
  on public.staff_assignments
  for update
  to authenticated
  using (
    (select private.caller_may_use_data())
    and protected = false
    and user_id <> (select auth.uid())
    and (select private.has_staff_permission('users.manage'))
  )
  with check (
    (select private.caller_may_use_data())
    and protected = false
    and user_id <> (select auth.uid())
    and (select private.actor_can_assign_role(role_id, null))
  );

create policy staff_assignments_delete
  on public.staff_assignments
  for delete
  to authenticated
  using (
    (select private.caller_may_use_data())
    and protected = false
    and user_id <> (select auth.uid())
    and (select private.has_staff_permission('users.manage'))
  );

create policy audit_events_select
  on public.audit_events
  for select
  to authenticated
  using ((select private.has_staff_permission('audit.read')));

create view public.my_account
with (security_invoker = true) as
select
  profile.user_id,
  profile.email,
  profile.display_name,
  profile.actor_kind::text as actor_kind,
  profile.disabled_at,
  coalesce(assignment.protected, false) as protected_admin,
  coalesce(assignment.role_id, membership.role_id) as role_id,
  role.key as role_key,
  role.name as role_name,
  role.scope::text as role_scope,
  private.current_permissions() as permissions,
  coalesce(
    array(
      select organization_id
      from private.user_organization_ids() as organization_id
    ),
    '{}'::uuid[]
  ) as organization_ids
from public.profiles as profile
left join public.staff_assignments as assignment
  on assignment.user_id = profile.user_id
left join lateral (
  select membership.role_id
  from public.memberships as membership
  where membership.user_id = profile.user_id
  order by membership.created_at
  limit 1
) as membership on true
left join public.roles as role
  on role.id = coalesce(assignment.role_id, membership.role_id)
where profile.user_id = (select auth.uid());

comment on view public.my_account is
  'The signed-in account. security_invoker keeps the row behind profiles RLS. Permissions come from a private helper, not from an editable JWT claim.';

revoke all on table public.permissions from public, anon;
revoke all on table public.roles from public, anon;
revoke all on table public.role_permissions from public, anon;
revoke all on table public.profiles from public, anon;
revoke all on table public.staff_assignments from public, anon;
revoke all on table public.audit_events from public, anon, authenticated;
revoke all on table public.my_account from public, anon;

grant select on table public.permissions to authenticated;
grant select, insert, update, delete on table public.roles to authenticated;
grant select, insert, delete on table public.role_permissions to authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.staff_assignments to authenticated;
grant select on table public.audit_events to authenticated;
grant select on table public.my_account to authenticated;

create policy license_documents_storage_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'license-documents'
    and (select private.caller_may_use_data())
    and (
      (select private.has_staff_permission('documents.read'))
      or (select private.has_staff_permission('documents.write'))
      or exists (
        select 1
        from private.user_organization_ids() as organization_id
        where organization_id::text = (storage.foldername(name))[1]
          and private.has_tenant_permission(organization_id, 'org.records.read')
      )
    )
  );

create policy license_documents_storage_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'license-documents'
    and (select private.caller_may_use_data())
    and (select private.has_staff_permission('documents.write'))
  );

create policy license_documents_storage_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'license-documents'
    and (select private.caller_may_use_data())
    and (select private.has_staff_permission('documents.write'))
  )
  with check (
    bucket_id = 'license-documents'
    and (select private.caller_may_use_data())
    and (select private.has_staff_permission('documents.write'))
  );

create policy license_documents_storage_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'license-documents'
    and (select private.caller_may_use_data())
    and (select private.has_staff_permission('documents.write'))
  );
