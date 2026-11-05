-- Access control for CML staff and pharmacy tenants.
-- Authorization is read from these tables inside private security-definer
-- helpers. Do not authorize from auth.jwt() user_metadata or raw_user_meta_data:
-- end users can edit that payload. app_metadata is not used.
--
-- The protected super admin is hello@taimoorhussain.com. This migration does
-- not create that Auth user and does not set a password. After the user exists,
-- run: select private.bootstrap_super_admin();

create type public.access_scope as enum ('staff', 'tenant');
create type public.actor_kind as enum ('staff', 'tenant');

create table private.auth_policy (
  id integer primary key check (id = 1),
  protected_super_admin_email text not null
);

insert into private.auth_policy (id, protected_super_admin_email)
values (1, 'hello@taimoorhussain.com');

revoke all on table private.auth_policy from public, anon, authenticated;

create table public.permissions (
  key text primary key,
  scope public.access_scope not null,
  label text not null,
  description text not null,
  constraint permissions_key_matches_scope check (
    (scope = 'staff' and key like 'staff.%')
    or (scope = 'tenant' and key like 'tenant.%')
  )
);

create table public.roles (
  id uuid primary key default extensions.gen_random_uuid(),
  scope public.access_scope not null,
  slug text not null check (slug ~ '^[a-z0-9_]+$'),
  name text not null check (char_length(btrim(name)) > 0),
  description text not null default '',
  system boolean not null default false,
  protected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roles_scope_slug_unique unique (scope, slug)
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
  display_name text not null check (char_length(btrim(display_name)) > 0),
  actor_kind public.actor_kind not null,
  mfa_required boolean not null default false,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_staff_require_mfa check (actor_kind <> 'staff' or mfa_required)
);

create index profiles_email_lower_idx on public.profiles (lower(email));

create table public.staff_assignments (
  user_id uuid primary key references public.profiles (user_id) on delete cascade,
  role_id uuid not null references public.roles (id),
  protected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index staff_assignments_role_id_idx on public.staff_assignments (role_id);

-- At most one protected super admin. The delete/demote guards keep that one.
create unique index staff_assignments_single_protected_idx
  on public.staff_assignments (protected)
  where protected;

create table public.audit_events (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  organization_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index audit_events_created_at_idx on public.audit_events (created_at desc);
create index audit_events_organization_id_idx on public.audit_events (organization_id);

comment on table public.audit_events is
  'Append-only trail of book and account changes. Row level security is enabled but not forced so the owner-backed trigger can insert. authenticated has no insert grant.';

comment on table public.profiles is
  'One portal identity per Auth user. Issued by a CML admin. Not a public signup.';

comment on table public.staff_assignments is
  'Global CML staff. The protected row cannot be demoted or deleted.';

insert into public.permissions (key, scope, label, description) values
  ('staff.organizations.read', 'staff', 'View all pharmacies', 'Read every organization.'),
  ('staff.organizations.write', 'staff', 'Edit pharmacies', 'Create and update organizations.'),
  ('staff.locations.read', 'staff', 'View all locations', 'Read every location.'),
  ('staff.locations.write', 'staff', 'Edit locations', 'Create and update locations.'),
  ('staff.licenses.read', 'staff', 'View the license book', 'Read every license.'),
  ('staff.licenses.write', 'staff', 'Update licenses', 'Change license records.'),
  ('staff.licenses.import', 'staff', 'Import rosters', 'Add organizations, locations, and licenses from a roster.'),
  ('staff.documents.read', 'staff', 'View all documents', 'Read every license document.'),
  ('staff.documents.write', 'staff', 'Manage documents', 'Upload and replace license documents.'),
  ('staff.users.read', 'staff', 'View accounts', 'See staff and pharmacy users.'),
  ('staff.users.manage', 'staff', 'Create and assign accounts', 'Create users and assign roles.'),
  ('staff.roles.manage', 'staff', 'Edit roles', 'Create roles and change their permissions.'),
  ('staff.audit.read', 'staff', 'View the audit trail', 'Read audit events.'),
  ('tenant.organizations.read', 'tenant', 'View own pharmacy', 'Read organizations this user belongs to.'),
  ('tenant.locations.read', 'tenant', 'View own locations', 'Read locations for those organizations.'),
  ('tenant.licenses.read', 'tenant', 'View own licenses', 'Read licenses for those organizations.'),
  ('tenant.documents.read', 'tenant', 'View own documents', 'Read documents for those organizations.');

insert into public.roles (scope, slug, name, description, system, protected) values
  ('staff', 'super_admin', 'Super admin', 'Full CML access. This role is locked.', true, true),
  ('staff', 'cml_operator', 'CML operator', 'Works the license book. Cannot administer accounts or roles.', true, false),
  ('tenant', 'pharmacy_admin', 'Pharmacy admin', 'Reviews one pharmacy. CML still files the licenses.', true, false),
  ('tenant', 'pharmacy_viewer', 'Pharmacy viewer', 'Read-only access to one pharmacy.', true, false);

insert into public.role_permissions (role_id, permission_key)
select role.id, permission.key
from public.roles as role
join public.permissions as permission on permission.scope = 'staff'
where role.slug = 'super_admin';

insert into public.role_permissions (role_id, permission_key)
select role.id, permission.key
from public.roles as role
join public.permissions as permission on permission.scope = 'staff'
where role.slug = 'cml_operator'
  and permission.key not in ('staff.users.manage', 'staff.roles.manage');

insert into public.role_permissions (role_id, permission_key)
select role.id, permission.key
from public.roles as role
join public.permissions as permission on permission.scope = 'tenant'
where role.scope = 'tenant';

alter table public.memberships
  add column role_id uuid references public.roles (id);

update public.memberships as membership
set role_id = role.id
from public.roles as role
where membership.role_id is null
  and role.scope = 'tenant'
  and role.slug = membership.role::text;

alter table public.memberships
  alter column role_id set not null;

alter table public.memberships
  alter column role drop not null;

create index memberships_role_id_idx on public.memberships (role_id);

create trigger roles_set_updated_at
  before update on public.roles
  for each row execute function private.set_updated_at();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create trigger staff_assignments_set_updated_at
  before update on public.staff_assignments
  for each row execute function private.set_updated_at();

create or replace function private.session_satisfies_mfa()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then false
    when not exists (
      select 1
      from public.profiles as profile
      where profile.user_id = (select auth.uid())
        and profile.disabled_at is null
    ) then false
    when exists (
      select 1
      from public.profiles as profile
      where profile.user_id = (select auth.uid())
        and profile.disabled_at is null
        and (
          profile.actor_kind = 'staff'
          or profile.mfa_required
          or exists (
            select 1
            from auth.mfa_factors as factor
            where factor.user_id = profile.user_id
              and factor.status = 'verified'
          )
        )
    ) then coalesce((select auth.jwt() ->> 'aal') = 'aal2', false)
    else true
  end;
$$;

create or replace function private.user_is_protected(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_assignments as assignment
    where assignment.user_id = target_user_id
      and assignment.protected
  );
$$;

create or replace function private.can_staff(permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.session_satisfies_mfa()
    and exists (
      select 1
      from public.staff_assignments as assignment
      join public.profiles as profile
        on profile.user_id = assignment.user_id
      join public.role_permissions as granted
        on granted.role_id = assignment.role_id
      where assignment.user_id = (select auth.uid())
        and profile.actor_kind = 'staff'
        and profile.disabled_at is null
        and granted.permission_key = permission
    );
$$;

create or replace function private.tenant_can(target_organization_id uuid, permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.session_satisfies_mfa()
    and exists (
      select 1
      from public.memberships as membership
      join public.profiles as profile
        on profile.user_id = membership.user_id
      join public.role_permissions as granted
        on granted.role_id = membership.role_id
      where membership.user_id = (select auth.uid())
        and membership.organization_id = target_organization_id
        and profile.actor_kind = 'tenant'
        and profile.disabled_at is null
        and granted.permission_key = permission
    );
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
    from public.staff_assignments as assignment
    join public.profiles as profile
      on profile.user_id = assignment.user_id
    where assignment.user_id = (select auth.uid())
      and profile.actor_kind = 'staff'
      and profile.disabled_at is null
      and private.session_satisfies_mfa()
  );
$$;

create or replace function private.can_read_organization(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_staff('staff.organizations.read')
    or private.can_staff('staff.licenses.read')
    or private.tenant_can(target_organization_id, 'tenant.organizations.read')
    or private.tenant_can(target_organization_id, 'tenant.licenses.read');
$$;

revoke all on function private.session_satisfies_mfa() from public, anon, authenticated;
revoke all on function private.user_is_protected(uuid) from public, anon, authenticated;
revoke all on function private.can_staff(text) from public, anon, authenticated;
revoke all on function private.tenant_can(uuid, text) from public, anon, authenticated;
grant execute on function private.session_satisfies_mfa() to authenticated;
grant execute on function private.user_is_protected(uuid) to authenticated;
grant execute on function private.can_staff(text) to authenticated;
grant execute on function private.tenant_can(uuid, text) to authenticated;

create or replace function private.sync_membership_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched_slug text;
  matched_scope public.access_scope;
begin
  if new.role_id is null then
    if new.role is null then
      raise exception 'A membership needs a tenant role';
    end if;
    select role.id
    into new.role_id
    from public.roles as role
    where role.scope = 'tenant'
      and role.slug = new.role::text;
    if new.role_id is null then
      raise exception 'No tenant role matches %', new.role;
    end if;
  end if;

  select role.slug, role.scope
  into matched_slug, matched_scope
  from public.roles as role
  where role.id = new.role_id;

  if matched_scope is distinct from 'tenant' then
    raise exception 'Memberships can only use tenant roles';
  end if;

  if matched_slug in ('pharmacy_admin', 'pharmacy_viewer') then
    new.role := matched_slug::public.membership_role;
  else
    new.role := null;
  end if;

  if not exists (
    select 1
    from public.profiles as profile
    where profile.user_id = new.user_id
      and profile.actor_kind = 'tenant'
      and profile.disabled_at is null
  ) then
    raise exception 'Pharmacy memberships require an active tenant profile';
  end if;

  if exists (
    select 1
    from public.staff_assignments as assignment
    where assignment.user_id = new.user_id
  ) then
    raise exception 'CML staff cannot also be pharmacy members';
  end if;

  return new;
end;
$$;

create trigger memberships_sync_role
  before insert or update on public.memberships
  for each row execute function private.sync_membership_role();

create or replace function private.guard_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  auth_email text;
begin
  select account.email
  into auth_email
  from auth.users as account
  where account.id = new.user_id;

  if auth_email is null or lower(new.email) is distinct from lower(auth_email) then
    raise exception 'Profile email must match the Auth user';
  end if;

  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id
      or new.actor_kind is distinct from old.actor_kind
      or lower(new.email) is distinct from lower(old.email) then
      raise exception 'Account kind and email are fixed after the account is issued';
    end if;
    if private.user_is_protected(old.user_id) then
      if new.disabled_at is not null then
        raise exception 'The protected super admin cannot be disabled';
      end if;
      if new.actor_kind is distinct from 'staff' then
        raise exception 'The protected super admin cannot be demoted';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_guard
  before insert or update on public.profiles
  for each row execute function private.guard_profile();

create or replace function private.guard_staff_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  reserved_email text;
begin
  if tg_op = 'DELETE' then
    if old.protected or private.user_is_protected(old.user_id) then
      raise exception 'The protected super admin cannot be deleted';
    end if;
    return old;
  end if;

  if not exists (
    select 1
    from public.profiles as profile
    where profile.user_id = new.user_id
      and profile.actor_kind = 'staff'
      and profile.disabled_at is null
  ) then
    raise exception 'Staff assignment requires an active CML profile';
  end if;

  if exists (
    select 1
    from public.memberships as membership
    where membership.user_id = new.user_id
  ) then
    raise exception 'Pharmacy members cannot be CML staff';
  end if;

  if not exists (
    select 1
    from public.roles as role
    where role.id = new.role_id
      and role.scope = 'staff'
  ) then
    raise exception 'CML staff can only use staff roles';
  end if;

  select policy.protected_super_admin_email
  into reserved_email
  from private.auth_policy as policy
  where policy.id = 1;

  if new.protected then
    if not exists (
      select 1
      from public.profiles as profile
      where profile.user_id = new.user_id
        and lower(profile.email) = lower(reserved_email)
    ) then
      raise exception 'The protected super admin must be %', reserved_email;
    end if;
    if not exists (
      select 1
      from public.roles as role
      where role.id = new.role_id
        and role.slug = 'super_admin'
        and role.scope = 'staff'
    ) then
      raise exception 'The protected super admin cannot be demoted';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.protected then
    if new.protected is not true
      or new.user_id is distinct from old.user_id
      or new.role_id is distinct from old.role_id then
      raise exception 'The protected super admin cannot be demoted';
    end if;
  end if;

  return new;
end;
$$;

create trigger staff_assignments_guard
  before insert or update or delete on public.staff_assignments
  for each row execute function private.guard_staff_assignment();

create or replace function private.sync_platform_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('cml.platform_admin_sync', 'on', true);
  if tg_op = 'DELETE' then
    delete from public.platform_admins where user_id = old.user_id;
    return old;
  end if;
  insert into public.platform_admins (user_id)
  values (new.user_id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger staff_assignments_sync_platform_admin
  after insert or update or delete on public.staff_assignments
  for each row execute function private.sync_platform_admin();

create or replace function private.guard_platform_admins()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('cml.platform_admin_sync', true), '') is distinct from 'on' then
    raise exception 'platform_admins is maintained from staff assignments';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger platform_admins_guard
  before insert or delete on public.platform_admins
  for each row execute function private.guard_platform_admins();

create or replace function private.guard_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.protected or old.slug = 'super_admin' then
      raise exception 'The super admin role cannot be deleted';
    end if;
    if old.system then
      raise exception 'System roles cannot be deleted';
    end if;
    if exists (
      select 1 from public.staff_assignments as assignment where assignment.role_id = old.id
    ) or exists (
      select 1 from public.memberships as membership where membership.role_id = old.id
    ) then
      raise exception 'Reassign accounts before deleting this role';
    end if;
    return old;
  end if;

  if old.protected or old.slug = 'super_admin' then
    if new.slug is distinct from old.slug
      or new.scope is distinct from old.scope
      or new.protected is distinct from true
      or new.system is distinct from true then
      raise exception 'The super admin role cannot be changed';
    end if;
  end if;

  if old.system and (new.slug is distinct from old.slug or new.scope is distinct from old.scope) then
    raise exception 'System role scope and slug are fixed';
  end if;

  if new.protected and new.slug is distinct from 'super_admin' then
    raise exception 'Only the super admin role can be protected';
  end if;

  return new;
end;
$$;

create trigger roles_guard
  before update or delete on public.roles
  for each row execute function private.guard_role();

create or replace function private.guard_role_permission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  role_row public.roles;
  permission_scope public.access_scope;
begin
  select role.*
  into role_row
  from public.roles as role
  where role.id = case
    when tg_op = 'DELETE' then old.role_id
    else new.role_id
  end;

  if role_row.protected or role_row.slug = 'super_admin' then
    raise exception 'Super admin permissions cannot be changed';
  end if;

  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    select permission.scope
    into permission_scope
    from public.permissions as permission
    where permission.key = new.permission_key;
    if permission_scope is distinct from role_row.scope then
      raise exception 'That permission is outside this role scope';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger role_permissions_guard
  before insert or update or delete on public.role_permissions
  for each row execute function private.guard_role_permission();

create or replace function private.audit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_id text;
  org_id uuid;
  meta jsonb := '{}'::jsonb;
begin
  -- Seed and SQL-editor sessions have no end-user id. The app records
  -- those changes only when an authenticated request makes them.
  if (select auth.uid()) is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if tg_table_name = 'profiles' or tg_table_name = 'staff_assignments' then
      row_id := old.user_id::text;
    elsif tg_table_name = 'role_permissions' then
      row_id := old.role_id::text;
      meta := jsonb_build_object('permission_key', old.permission_key);
    else
      row_id := old.id::text;
    end if;
    if tg_table_name = 'organizations' then
      org_id := old.id;
    elsif tg_table_name in ('locations', 'licenses', 'documents', 'memberships') then
      org_id := old.organization_id;
    end if;
  else
    if tg_table_name = 'profiles' then
      row_id := new.user_id::text;
      meta := jsonb_build_object('actor_kind', new.actor_kind, 'email', new.email);
    elsif tg_table_name = 'staff_assignments' then
      row_id := new.user_id::text;
      meta := jsonb_build_object('role_id', new.role_id, 'protected', new.protected);
    elsif tg_table_name = 'role_permissions' then
      row_id := new.role_id::text;
      meta := jsonb_build_object('permission_key', new.permission_key);
    else
      row_id := new.id::text;
    end if;
    if tg_table_name = 'organizations' then
      org_id := new.id;
    elsif tg_table_name in ('locations', 'licenses', 'documents', 'memberships') then
      org_id := new.organization_id;
    end if;
    if tg_table_name = 'licenses' then
      meta := jsonb_build_object('license_number', new.license_number, 'status', new.status);
    elsif tg_table_name = 'roles' then
      meta := jsonb_build_object('slug', new.slug, 'scope', new.scope);
    end if;
  end if;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, organization_id, metadata)
  values ((select auth.uid()), lower(tg_op), tg_table_name, row_id, org_id, meta);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger organizations_audit
  after insert or update or delete on public.organizations
  for each row execute function private.audit_change();

create trigger locations_audit
  after insert or update or delete on public.locations
  for each row execute function private.audit_change();

create trigger licenses_audit
  after insert or update or delete on public.licenses
  for each row execute function private.audit_change();

create trigger documents_audit
  after insert or update or delete on public.documents
  for each row execute function private.audit_change();

create trigger memberships_audit
  after insert or update or delete on public.memberships
  for each row execute function private.audit_change();

create trigger profiles_audit
  after insert or update or delete on public.profiles
  for each row execute function private.audit_change();

create trigger staff_assignments_audit
  after insert or update or delete on public.staff_assignments
  for each row execute function private.audit_change();

create trigger roles_audit
  after insert or update or delete on public.roles
  for each row execute function private.audit_change();

create trigger role_permissions_audit
  after insert or update or delete on public.role_permissions
  for each row execute function private.audit_change();

create or replace function private.protect_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and private.user_is_protected(old.id) then
    raise exception 'The protected super admin cannot be deleted';
  end if;

  if tg_op = 'UPDATE' and private.user_is_protected(old.id) then
    if lower(coalesce(new.email, '')) is distinct from lower(coalesce(old.email, '')) then
      raise exception 'The protected super admin email cannot be changed';
    end if;
    if new.banned_until is not null and new.banned_until > pg_catalog.now() then
      raise exception 'The protected super admin cannot be disabled';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_auth_user on auth.users;
create trigger protect_auth_user
  before update or delete on auth.users
  for each row execute function private.protect_auth_user();

create or replace function private.bootstrap_super_admin()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  reserved_email text;
  target_user uuid;
  super_role uuid;
begin
  select policy.protected_super_admin_email
  into reserved_email
  from private.auth_policy as policy
  where policy.id = 1;

  select account.id
  into target_user
  from auth.users as account
  where lower(account.email) = lower(reserved_email);

  if target_user is null then
    raise exception
      'Create the Auth user % in the Supabase dashboard first. This function does not create a user or set a password.',
      reserved_email;
  end if;

  select role.id
  into super_role
  from public.roles as role
  where role.scope = 'staff'
    and role.slug = 'super_admin';

  insert into public.profiles (user_id, email, display_name, actor_kind, mfa_required)
  values (target_user, reserved_email, 'CML Super Admin', 'staff', true)
  on conflict (user_id) do update
    set actor_kind = 'staff',
        mfa_required = true,
        disabled_at = null,
        email = excluded.email,
        display_name = public.profiles.display_name;

  insert into public.staff_assignments (user_id, role_id, protected)
  values (target_user, super_role, true)
  on conflict (user_id) do update
    set role_id = excluded.role_id,
        protected = true;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (
    target_user,
    'bootstrap',
    'staff_assignments',
    target_user::text,
    jsonb_build_object('email', reserved_email)
  );

  return target_user;
end;
$$;

revoke all on function private.bootstrap_super_admin() from public, anon, authenticated;
grant execute on function private.bootstrap_super_admin() to service_role;

-- Book policies now follow granular permissions. MFA for staff is inside the helpers.
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

create policy organizations_select
  on public.organizations
  for select
  to authenticated
  using (
    (select private.can_staff('staff.organizations.read'))
    or (select private.can_staff('staff.users.manage'))
    or (select private.tenant_can(id, 'tenant.organizations.read'))
  );

create policy organizations_insert
  on public.organizations
  for insert
  to authenticated
  with check (
    (select private.can_staff('staff.organizations.write'))
    or (select private.can_staff('staff.licenses.import'))
  );

create policy organizations_update
  on public.organizations
  for update
  to authenticated
  using ((select private.can_staff('staff.organizations.write')))
  with check ((select private.can_staff('staff.organizations.write')));

create policy organizations_delete
  on public.organizations
  for delete
  to authenticated
  using ((select private.can_staff('staff.organizations.write')));

create policy organizations_mfa
  on public.organizations
  as restrictive
  for all
  to authenticated
  using ((select private.session_satisfies_mfa()))
  with check ((select private.session_satisfies_mfa()));

create policy locations_select
  on public.locations
  for select
  to authenticated
  using (
    (select private.can_staff('staff.locations.read'))
    or (select private.tenant_can(organization_id, 'tenant.locations.read'))
  );

create policy locations_insert
  on public.locations
  for insert
  to authenticated
  with check (
    (select private.can_staff('staff.locations.write'))
    or (select private.can_staff('staff.licenses.import'))
  );

create policy locations_update
  on public.locations
  for update
  to authenticated
  using (
    (select private.can_staff('staff.locations.write'))
    or (select private.can_staff('staff.licenses.import'))
  )
  with check (
    (select private.can_staff('staff.locations.write'))
    or (select private.can_staff('staff.licenses.import'))
  );

create policy locations_delete
  on public.locations
  for delete
  to authenticated
  using ((select private.can_staff('staff.locations.write')));

create policy locations_mfa
  on public.locations
  as restrictive
  for all
  to authenticated
  using ((select private.session_satisfies_mfa()))
  with check ((select private.session_satisfies_mfa()));

create policy licenses_select
  on public.licenses
  for select
  to authenticated
  using (
    (select private.can_staff('staff.licenses.read'))
    or (select private.tenant_can(organization_id, 'tenant.licenses.read'))
  );

create policy licenses_insert
  on public.licenses
  for insert
  to authenticated
  with check (
    (select private.can_staff('staff.licenses.write'))
    or (select private.can_staff('staff.licenses.import'))
  );

create policy licenses_update
  on public.licenses
  for update
  to authenticated
  using ((select private.can_staff('staff.licenses.write')))
  with check ((select private.can_staff('staff.licenses.write')));

create policy licenses_delete
  on public.licenses
  for delete
  to authenticated
  using ((select private.can_staff('staff.licenses.write')));

create policy licenses_mfa
  on public.licenses
  as restrictive
  for all
  to authenticated
  using ((select private.session_satisfies_mfa()))
  with check ((select private.session_satisfies_mfa()));

create policy documents_select
  on public.documents
  for select
  to authenticated
  using (
    (select private.can_staff('staff.documents.read'))
    or (select private.tenant_can(organization_id, 'tenant.documents.read'))
  );

create policy documents_insert
  on public.documents
  for insert
  to authenticated
  with check ((select private.can_staff('staff.documents.write')));

create policy documents_update
  on public.documents
  for update
  to authenticated
  using ((select private.can_staff('staff.documents.write')))
  with check ((select private.can_staff('staff.documents.write')));

create policy documents_delete
  on public.documents
  for delete
  to authenticated
  using ((select private.can_staff('staff.documents.write')));

create policy documents_mfa
  on public.documents
  as restrictive
  for all
  to authenticated
  using ((select private.session_satisfies_mfa()))
  with check ((select private.session_satisfies_mfa()));

create policy memberships_select
  on public.memberships
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.can_staff('staff.users.read'))
  );

create policy memberships_insert
  on public.memberships
  for insert
  to authenticated
  with check ((select private.can_staff('staff.users.manage')));

create policy memberships_update
  on public.memberships
  for update
  to authenticated
  using ((select private.can_staff('staff.users.manage')))
  with check ((select private.can_staff('staff.users.manage')));

create policy memberships_delete
  on public.memberships
  for delete
  to authenticated
  using ((select private.can_staff('staff.users.manage')));

create policy memberships_write_mfa
  on public.memberships
  as restrictive
  for insert
  to authenticated
  with check ((select private.session_satisfies_mfa()));

create policy memberships_update_mfa
  on public.memberships
  as restrictive
  for update
  to authenticated
  using ((select private.session_satisfies_mfa()))
  with check ((select private.session_satisfies_mfa()));

create policy memberships_delete_mfa
  on public.memberships
  as restrictive
  for delete
  to authenticated
  using ((select private.session_satisfies_mfa()));

create policy platform_admins_select_self
  on public.platform_admins
  for select
  to authenticated
  using (user_id = (select auth.uid()));

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

create policy permissions_select
  on public.permissions
  for select
  to authenticated
  using (true);

create policy roles_select
  on public.roles
  for select
  to authenticated
  using (true);

create policy roles_insert
  on public.roles
  for insert
  to authenticated
  with check (
    (select private.can_staff('staff.roles.manage'))
    and protected = false
    and system = false
  );

create policy roles_update
  on public.roles
  for update
  to authenticated
  using (
    (select private.can_staff('staff.roles.manage'))
    and protected = false
  )
  with check (
    (select private.can_staff('staff.roles.manage'))
    and protected = false
  );

create policy roles_delete
  on public.roles
  for delete
  to authenticated
  using (
    (select private.can_staff('staff.roles.manage'))
    and protected = false
    and system = false
  );

create policy roles_write_mfa
  on public.roles
  as restrictive
  for insert
  to authenticated
  with check ((select private.session_satisfies_mfa()));

create policy roles_update_mfa
  on public.roles
  as restrictive
  for update
  to authenticated
  using ((select private.session_satisfies_mfa()))
  with check ((select private.session_satisfies_mfa()));

create policy roles_delete_mfa
  on public.roles
  as restrictive
  for delete
  to authenticated
  using ((select private.session_satisfies_mfa()));

create policy role_permissions_select
  on public.role_permissions
  for select
  to authenticated
  using (true);

create policy role_permissions_insert
  on public.role_permissions
  for insert
  to authenticated
  with check ((select private.can_staff('staff.roles.manage')));

create policy role_permissions_delete
  on public.role_permissions
  for delete
  to authenticated
  using ((select private.can_staff('staff.roles.manage')));

create policy role_permissions_insert_mfa
  on public.role_permissions
  as restrictive
  for insert
  to authenticated
  with check ((select private.session_satisfies_mfa()));

create policy role_permissions_delete_mfa
  on public.role_permissions
  as restrictive
  for delete
  to authenticated
  using ((select private.session_satisfies_mfa()));

create policy profiles_select
  on public.profiles
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.can_staff('staff.users.read'))
  );

create policy profiles_insert
  on public.profiles
  for insert
  to authenticated
  with check ((select private.can_staff('staff.users.manage')));

create policy profiles_update
  on public.profiles
  for update
  to authenticated
  using (
    (select private.can_staff('staff.users.manage'))
    and not (select private.user_is_protected(user_id))
  )
  with check (
    (select private.can_staff('staff.users.manage'))
    and not (select private.user_is_protected(user_id))
  );

create policy profiles_insert_mfa
  on public.profiles
  as restrictive
  for insert
  to authenticated
  with check ((select private.session_satisfies_mfa()));

create policy profiles_update_mfa
  on public.profiles
  as restrictive
  for update
  to authenticated
  using ((select private.session_satisfies_mfa()))
  with check ((select private.session_satisfies_mfa()));

create policy staff_assignments_select
  on public.staff_assignments
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.can_staff('staff.users.read'))
  );

create policy staff_assignments_insert
  on public.staff_assignments
  for insert
  to authenticated
  with check (
    (select private.can_staff('staff.users.manage'))
    and protected = false
  );

create policy staff_assignments_update
  on public.staff_assignments
  for update
  to authenticated
  using (
    (select private.can_staff('staff.users.manage'))
    and protected = false
  )
  with check (
    (select private.can_staff('staff.users.manage'))
    and protected = false
  );

create policy staff_assignments_delete
  on public.staff_assignments
  for delete
  to authenticated
  using (
    (select private.can_staff('staff.users.manage'))
    and protected = false
  );

create policy staff_assignments_insert_mfa
  on public.staff_assignments
  as restrictive
  for insert
  to authenticated
  with check ((select private.session_satisfies_mfa()));

create policy staff_assignments_update_mfa
  on public.staff_assignments
  as restrictive
  for update
  to authenticated
  using ((select private.session_satisfies_mfa()))
  with check ((select private.session_satisfies_mfa()));

create policy staff_assignments_delete_mfa
  on public.staff_assignments
  as restrictive
  for delete
  to authenticated
  using ((select private.session_satisfies_mfa()));

create policy audit_events_select
  on public.audit_events
  for select
  to authenticated
  using ((select private.can_staff('staff.audit.read')));

create policy audit_events_mfa
  on public.audit_events
  as restrictive
  for all
  to authenticated
  using ((select private.session_satisfies_mfa()))
  with check ((select private.session_satisfies_mfa()));

revoke all on table public.permissions from public, anon;
revoke all on table public.roles from public, anon;
revoke all on table public.role_permissions from public, anon;
revoke all on table public.profiles from public, anon;
revoke all on table public.staff_assignments from public, anon;
revoke all on table public.audit_events from public, anon;

grant select on table public.permissions to authenticated;
grant select, insert, update, delete on table public.roles to authenticated;
grant select, insert, delete on table public.role_permissions to authenticated;
grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.staff_assignments to authenticated;
grant select on table public.audit_events to authenticated;

create policy license_documents_storage_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'license-documents'
    and (
      (select private.can_staff('staff.documents.read'))
      or (
        (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
        and (select private.tenant_can(((storage.foldername(name))[1])::uuid, 'tenant.documents.read'))
      )
    )
  );

create policy license_documents_storage_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'license-documents'
    and (select private.can_staff('staff.documents.write'))
  );

create policy license_documents_storage_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'license-documents'
    and (select private.can_staff('staff.documents.write'))
  )
  with check (
    bucket_id = 'license-documents'
    and (select private.can_staff('staff.documents.write'))
  );

create policy license_documents_storage_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'license-documents'
    and (select private.can_staff('staff.documents.write'))
  );
