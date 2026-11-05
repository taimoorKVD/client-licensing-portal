# CML Client Licensing

CML keeps pharmacy licenses for clients it already serves. This portal is the operations desk for CML staff and a read-only book for a pharmacy. Staff and pharmacy users are separate directories. There is no public signup and no payment.

When Supabase is configured, every page requires a signed-in session. The sample pharmacies in `supabase/seed.sql` are seed data for the book. They are not a way around authentication. A browser demo of that book remains only when no Supabase URL or key is set, so a machine without secrets can still open the UI.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without the variables in `.env.example`, this is the local sample book.

```bash
npm test
npm run lint
npm run build
npm start
```

`npm run build` produces a Node.js server in `.next`. `npm start` runs `next start` and listens on `PORT` (default 3000) on `0.0.0.0`. The app is not a static export. Do not publish an `out/` directory.

## Hostinger Node.js

Deploy this as a Node.js application, not as a static site. Hostinger Business or Cloud hosting runs the server with `hosting_deploy-js-application` or a Git build.

- Node.js 20 or newer
- Build command: `npm run build`
- Start command: `npm start`
- Do not set the output directory to `out` or `next-assets`. The server reads `.next`.
- Set the environment variables below in the Node.js panel **before** the build. `NEXT_PUBLIC_*` values are inlined when Next builds. `SUPABASE_SECRET_KEY` stays on the server.

The live host `https://clp.taimoorhussain.com` previously served a static demo. Replacing it means pointing that site at this Node process. In the Supabase dashboard, set the Auth site URL to `https://clp.taimoorhussain.com` and add that origin to the redirect allow list.

## Environment

```bash
cp .env.example .env.local
```

| Variable | Where it lives |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server. Project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser and server. Publishable key only. |
| `SUPABASE_SECRET_KEY` | Server only. Never prefix it with `NEXT_PUBLIC_`. |

If both public values are set, the app uses Supabase Auth even if an old `NEXT_PUBLIC_DATA_SOURCE=demo` value is still present. The secret key is read only from `src/lib/supabase/admin.ts`, which imports `server-only`.

The dev project ref is `ubipxntnfeohqcxwfyhs`.

## Bootstrap

This repository does not create `hello@redtamarosan.com` and does not contain a password. The coordinator creates that user, then the database binds it as the protected super admin.

1. In the Supabase dashboard for the project, open **Authentication → Sign In / Providers → Email** and turn **off** "Allow new users to sign up". Confirm email/password sign-in stays on. Set the minimum password length to 12. This matches `supabase/config.toml` for local development (`enable_signup = false`).
2. Open **Authentication → Multi-factor**. Enable TOTP enrollment and verification. The local config sets `[auth.mfa.totp] enroll_enabled` and `verify_enabled` to true. Phone MFA stays off.
3. Create the user `hello@redtamarosan.com` in **Authentication → Users** with a password you store outside this repository. Mark the email confirmed. Do not put a role in user metadata.
4. Apply the migrations (`supabase db push`, or the SQL editor). `supabase/seed.sql` loads fictional pharmacies only. It does not create auth users.
5. In the SQL editor, as the database owner:

```sql
select private.bootstrap_protected_admin();
```

The function refuses to run unless that auth user already exists. It does not set a password. It inserts a staff profile and a protected `super_admin` assignment.

6. Sign in at `/login`. The first staff session is assurance level 1 (password only). Supabase does not attach a verified authenticator factor until the user scans the QR code and confirms a 6-digit code, so the first sign-in stops on `/mfa` until that enrollment succeeds. Later sign-ins stop on the same page until the code from the authenticator app raises the session to `aal2`. Pharmacy users are not sent through MFA.
7. After that, People and Roles in the portal can create other users. Share each initial password through a channel you trust. It is not written to the audit log.

There is always one protected super admin once bootstrap has run. That account cannot be demoted, disabled, or deleted by the app, by Row Level Security, or by a trigger on `auth.users`. The super admin role's permission set is fixed. Other staff can be given custom roles. A person cannot grant a CML permission they do not already hold, and cannot edit their own role.

Pharmacy users live in `memberships` for one organization. They cannot receive a staff role, and staff cannot receive a pharmacy membership. Pharmacy viewers can read their book. Pharmacy admins can manage users in that pharmacy only.

Authorization is read from `profiles`, `staff_assignments`, `memberships`, `roles`, and `role_permissions`. It is not read from `user_metadata` or `app_metadata`. `app_metadata` is left empty so a role change applies on the next request instead of waiting for a refreshed JWT. The only JWT claim the policies read is `aal`, and only to require a second factor for staff.

## Local database

Install the [Supabase CLI](https://supabase.com/docs/guides/local-development), then:

```bash
supabase start
supabase db reset
```

`supabase/config.toml` applies migrations and then `supabase/seed.sql`. Create the auth user in Studio (or the hosted dashboard) and run `select private.bootstrap_protected_admin();` before signing in.

## What the database enforces

- Licensing tables: `organizations`, `locations`, `licenses`, `documents`, plus `memberships` and the legacy `platform_admins` table.
- Access tables: `permissions`, `roles`, `role_permissions`, `profiles`, `staff_assignments`, `audit_events`.
- RLS is enabled and forced on every exposed application table. `anon` has no grants. The `my_account` view is `security_invoker`.
- Helper functions live in the `private` schema, which the Data API does not expose. They are `security definer` with an empty `search_path`. The one public RPC, `record_admin_event`, is `security invoker` and only records an event after the private helper checks the caller.
- Staff data access also requires `auth.jwt() ->> 'aal' = 'aal2'`. A password-only staff session cannot read the book.
- `license_portfolio` remains a `security_invoker` view.
- Storage bucket `license-documents` is private. Reads follow document permissions and the caller's organizations. Writes require `documents.write`.
- Audit rows are inserted by triggers. Authenticated users with `audit.read` can select them. They cannot update or delete them.

System roles:

| Role | Who | Permissions |
| --- | --- | --- |
| Super admin | CML staff, protected | Every staff permission. The role cannot be edited. |
| CML operator | CML staff | Read and write the book, import rosters, read audit. |
| CML viewer | CML staff | Read the book, people, roles, and audit. |
| Pharmacy admin | One pharmacy | Read that pharmacy and manage its users. |
| Pharmacy viewer | One pharmacy | Read that pharmacy. |

Custom roles can be added in the portal. They cannot be marked system or protected.

## Demo files

These files are for the local sample book and for roster import. They are not credentials.

| File | What it is |
| --- | --- |
| `public/samples/cml-license-roster-clean.xlsx` | Redwood Coast Pharmacy. Every row imports. |
| `public/samples/cml-license-roster-review.xlsx` | Ready rows, blocked rows, warnings, and one blank row. |
| `public/samples/pharmacy-license-certificate.pdf` | Sample certificate linked from several permits. |

## Layout

```
src/app/(portal)              signed-in book, import, people, roles, audit
src/app/login                 email and password, no signup
src/app/mfa                   staff TOTP enrollment and challenge
src/app/api/admin             session-checked JSON for the same admin actions
src/components/portal         shell and tables
src/lib/auth                  permission catalog, policy, server admin API
src/lib/data                  repository, live snapshot, roster persistence
supabase/migrations           schema, RLS, protected admin, audit
```

The service-role client is used only to create, ban, or delete Auth users and to revoke their sessions. Profile and role rows are written with the signed-in user's client so RLS still applies. Triggers block changes to the protected super admin even if that client is bypassed.
