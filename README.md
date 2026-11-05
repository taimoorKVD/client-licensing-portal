# CML Client Licensing

CML keeps pharmacy licenses for clients it already serves. This portal is the first working slice of that book: an operations desk for CML admins, and a read-only view for a pharmacy. A later release can turn the same organizations into self-service subscriptions. This version does not take payment or create accounts.

The app runs without Supabase. Sample pharmacies, a roster import, and a sample certificate all work in the browser. The SQL migration is a real tenant baseline for when you connect a project.

## What you can do

- Review the book as of November 5, 2026: active, expiring, expired, pending, and suspended licenses.
- Switch the shell between **CML Admin**, **Harbor & Pine Pharmacy**, and **Mesa Verde Rx**. A pharmacy only sees its own organizations, locations, licenses, and notes.
- Search and filter licenses by status, state, type, and pharmacy. Expiring is calculated from the expiration date (active, and due within 90 days). It is not stored as its own status.
- Open a license, download the sample certificate where a file is on record, and see placeholder slots where the file has not been uploaded.
- As a CML admin, change a stored status, or import an `.xlsx` roster: map columns, validate, preview, then add the ready rows. Imported rows stay in this browser until you reset the demo book.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No environment file is required.

```bash
npm test
npm run lint
npm run build
```

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

The interactive UI uses `src/lib/data/demo-repository.ts` unless you opt into Supabase. `src/lib/data/supabase-repository.ts` reads with the signed-in user's session. It does not use a service-role client. Row Level Security is what limits a pharmacy to its organization.

### Environment

Copy the placeholders and fill them from your Supabase project. Do not commit real keys.

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_DATA_SOURCE=demo
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Set `NEXT_PUBLIC_DATA_SOURCE=supabase` only after both public values are set. The legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` is accepted if the publishable key is empty.

`SUPABASE_SECRET_KEY` is server-only. Leave it unset for this demo. Never prefix it with `NEXT_PUBLIC_`.

Auth cookies are refreshed in `src/proxy.ts` when Supabase is configured. The proxy calls `getClaims()` and does not trust `getSession()`.

### Local database

Install the [Supabase CLI](https://supabase.com/docs/guides/local-development), then from this directory:

```bash
supabase start
supabase db reset
```

`supabase/config.toml` applies `supabase/migrations` and then `supabase/seed.sql`. The seed loads the same fictional pharmacies as the demo book. It does not create auth users.

After you sign up a user in the local project, grant CML access with the SQL editor (service role), using that user's id:

```sql
insert into public.platform_admins (user_id)
values ('00000000-0000-0000-0000-000000000000');
```

A pharmacy user is a row in `memberships`, not a self-assigned claim:

```sql
insert into public.memberships (organization_id, user_id, role)
values (
  (select id from public.organizations where name = 'Harbor & Pine Pharmacy'),
  '00000000-0000-0000-0000-000000000000',
  'pharmacy_viewer'
);
```

Do not put roles in `user_metadata`. End users can edit that payload. Staff access lives in `platform_admins`.

### What the migration enforces

- Tables: `organizations`, `locations`, `licenses`, `documents`, `memberships`, `platform_admins`.
- RLS enabled and forced on each table. `anon` has no grants.
- Pharmacy members can select rows for their organizations. They cannot insert a membership for themselves.
- Inserts, updates, and deletes on the book are limited to platform admins.
- Helper functions live in the `private` schema, which is not exposed by the Data API. They are `security definer` with an empty `search_path`.
- `license_portfolio` is a `security_invoker` view, so RLS on the base tables still applies.
- Storage bucket `license-documents` is private. Object paths should start with `{organization_id}/`. Members can read their prefix. Only platform admins can upload, replace, or delete objects.

Hosted projects: `supabase link` then `supabase db push`. Use the dashboard SQL editor if you are not using the CLI.

## Layout

```
src/app                         routes
src/components/portal           shell, role switcher, tables
src/components/views            dashboard, book, import
src/lib/data                    repository boundary (demo and Supabase)
src/lib/import                  parse, map, validate, commit
src/lib/supabase                browser client, server client, proxy
supabase/migrations             schema and RLS
public/samples                  generated xlsx and pdf
```

The demo role switcher is a stand-in for auth. In Supabase mode the same split is `platform_admins` versus `memberships`.
