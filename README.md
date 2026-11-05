# CML Client Licensing

CML keeps pharmacy licenses for clients it already serves. This portal is an operations desk for CML staff and a read-only view for a pharmacy. It does not take payment.

Sign-in is Supabase Auth email and password. There is no public signup. CML staff and pharmacy users are issued from **Users**, with custom roles and permissions enforced in Postgres. The sample pharmacies in `supabase/seed.sql` are seed data. They are not a substitute for a session once Supabase is configured.

Accounts, MFA, the protected super admin, and the Hostinger Node.js deploy are documented in [docs/AUTH.md](docs/AUTH.md).

## What you can do

- Review the book as of November 5, 2026: active, expiring, expired, pending, and suspended licenses.
- Sign in as CML staff or as a pharmacy user. A pharmacy only sees its own organizations, locations, licenses, and notes. Staff with the right permission can issue accounts, edit roles, and read the audit trail.
- Search and filter licenses by status, state, type, and pharmacy. Expiring is calculated from the expiration date (active, and due within 90 days). It is not stored as its own status.
- Open a license, download the sample certificate where a file is on record, and see placeholder slots where the file has not been uploaded.
- As a CML operator, change a stored status, or import an `.xlsx` roster: map columns, validate, preview, then add the ready rows. Those writes go through the signed-in session and Row Level Security.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). With no Supabase values, `npm run dev` shows a local preview of the sample book and a persona switcher. That preview is not used in production, and it is not used when the public Supabase values are set.

```bash
npm test
npm run lint
npm run build
npm start
```

`npm run build` produces a Node server. `npm start` listens on `0.0.0.0` and `PORT`. Do not publish an `out/` directory. Hostinger should run this as a Node.js application. See [docs/AUTH.md](docs/AUTH.md).

Regenerate the checked-in samples if you change the generator:

```bash
npm run generate:samples
npm run generate:seed
```

## Demo files

| File | What it is |
| --- | --- |
| `public/samples/cml-license-roster-clean.xlsx` | Redwood Coast Pharmacy. Every row imports. |
| `public/samples/cml-license-roster-review.xlsx` | Ready rows, blocked rows, warnings, and one blank row. |
| `public/samples/pharmacy-license-certificate.pdf` | Sample certificate linked from several permits. Labeled as a demonstration copy. |

On **Import roster**, choose **Use this file** for either workbook. The clean file creates a new client. The review file shows why rows are blocked before anything is written.

## Supabase

`src/lib/data/supabase-repository.ts` reads and writes with the signed-in user's session. Account administration uses `SUPABASE_SECRET_KEY` only on the server, in `src/lib/auth/admin.ts`. The browser never receives it.

Auth cookies are refreshed in `src/proxy.ts`. The proxy calls `getClaims()` and does not trust `getSession()`. Staff must finish authenticator enrollment or a code challenge before the book layout loads. The first staff sign-in is enrollment. See [docs/AUTH.md](docs/AUTH.md).

### Local database

Install the [Supabase CLI](https://supabase.com/docs/guides/local-development), then from this directory:

```bash
supabase start
supabase db reset
```

`supabase/config.toml` disables public signup, requires a 12-character password, and enables TOTP. It applies `supabase/migrations` and then `supabase/seed.sql`. The seed loads the fictional pharmacies. It does not create auth users.

Create `hello@taimoorhussain.com` in Studio, then run `select private.bootstrap_super_admin();`. Further accounts are issued from the portal. Do not put roles in `user_metadata`.

### What the database enforces

- Book tables: `organizations`, `locations`, `licenses`, `documents`, `memberships`, `platform_admins`.
- Access tables: `profiles`, `roles`, `role_permissions`, `permissions`, `staff_assignments`, `audit_events`.
- RLS on every exposed table. `anon` has no grants. Book and audit policies are also restrictive on MFA.
- Pharmacy members can select rows for their organizations. They cannot insert a membership for themselves.
- Writes require the matching staff permission (`staff.licenses.write`, `staff.licenses.import`, and the rest).
- Helper functions live in the `private` schema, which is not exposed by the Data API. They are `security definer` with an empty `search_path`.
- The protected super admin cannot be demoted, disabled, or deleted, and the super admin role cannot lose its permissions.
- `license_portfolio` is a `security_invoker` view, so RLS on the base tables still applies.
- Storage bucket `license-documents` is private. Object paths should start with `{organization_id}/`.

`platform_admins` is kept in sync from staff assignments. Inserting into it directly is rejected.

## Layout

```
src/app                         routes
src/app/(auth)                  sign-in and authenticator enrollment
src/app/(portal)/admin          users, roles, audit
src/components/portal           shell, tables
src/components/views            dashboard, book, import
src/lib/auth                    permissions, session, admin API
src/lib/data                    repository boundary
src/lib/import                  parse, map, validate, commit
src/lib/supabase                browser client, server client, proxy
supabase/migrations             schema and RLS
docs/AUTH.md                    environment, bootstrap, MFA, Hostinger
public/samples                  generated xlsx and pdf
```

The local preview still has a persona switcher so the sample book can be opened without keys. With Supabase configured, that switcher is gone and the split is staff assignments versus pharmacy memberships.
