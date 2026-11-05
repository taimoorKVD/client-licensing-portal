# Authentication and accounts

The portal is a Node.js Next.js server. Sign-in uses Supabase Auth email and password. There is no public signup. Authorization comes from database tables and Row Level Security, not from `user_metadata` or `app_metadata`.

The reserved super admin is `hello@taimoorhussain.com`. This repository does not create that user and does not contain a password.

## Environment

Copy `.env.example` to `.env.local` for local Node, or set the same names in the Hostinger Node.js environment.

| Name | Where it lives | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser and server | Publishable key. The legacy anon key is accepted only if this is empty. |
| `SUPABASE_SECRET_KEY` | Server only | Auth admin API for issuing, banning, and deleting users. Never prefix it with `NEXT_PUBLIC_`. |

If either public value is missing in production, the server shows a configuration message and does not serve the sample book. A local `npm run dev` with no public values still opens the sample book as a preview. Setting the public values, even with `NEXT_PUBLIC_DATA_SOURCE=demo`, switches the app to signed-in Supabase access.

## Hosted project settings

`supabase/config.toml` applies to the local Supabase stack. On the hosted project (`ubipxntnfeohqcxwfyhs` or its replacement), set the same rules in the dashboard:

1. Authentication → Providers → Email: turn **off** new user signups. Keep email/password sign-in on.
2. Authentication → URL configuration: Site URL `https://clp.taimoorhussain.com`. Add that origin to the redirect allow list.
3. Authentication → Multi-factor: App Authenticator (TOTP) enroll and verify enabled. TOTP is enabled on hosted projects by default. Phone MFA stays off.
4. Authentication → Passwords: minimum length 12, with upper and lower case letters and a digit.
5. Do not put the service role key in a `NEXT_PUBLIC_` variable or in client code.

The dev project `ubipxntnfeohqcxwfyhs` already has migration `20261105195500` recorded. No Auth user was created there, and `private.bootstrap_super_admin()` refuses to run until `hello@taimoorhussain.com` exists. Do not run that migration a second time against this project.

Apply the SQL in `supabase/migrations` before anyone signs in on a new project:

```bash
supabase link --project-ref ubipxntnfeohqcxwfyhs
supabase db push
```

You can paste the migration into the SQL editor if you are not using the CLI. The migration does not insert an Auth user.

## Bootstrap the protected super admin

Do this once, after the migration is applied. Do it in the dashboard, not in git.

1. Authentication → Users → Add user.
2. Email: `hello@taimoorhussain.com`.
3. Set a password there. Choose **Auto Confirm User** so the first sign-in does not wait on a confirmation email. Do not record the password in this repository, a ticket, or a chat log.
4. In the SQL editor, run:

```sql
select private.bootstrap_super_admin();
```

The function looks up that email, marks the profile as CML staff, assigns the locked `super_admin` role, and sets `protected`. It refuses to run if the Auth user does not exist yet. It does not choose a password.

That account cannot be demoted, disabled, deleted, or given a different email. The `super_admin` role cannot be deleted and its permissions cannot be removed. The partial unique index allows only one protected assignment. Other super admins can be issued later from **Users**; they are not protected and can be changed. Pharmacy users cannot be given a staff role, and staff cannot also hold a pharmacy membership.

## First sign-in and MFA

Staff must use an authenticator app before the license book opens.

Supabase only asks for a second factor after one is verified (`currentLevel` `aal1`, `nextLevel` `aal2`). A brand-new staff account has no factor, so both levels are `aal1`. The portal treats that as enrollment, not as a finished sign-in.

1. Sign in with email and password. The session is assurance level 1.
2. The app opens **Set up an authenticator**. Scan the QR code or type the manual key. Enter the 6-digit code.
3. `mfa.challenge` and `mfa.verify` promote the session to `aal2`.
4. Later sign-ins stop on the code screen until the code is accepted.

Row Level Security also requires `aal2` for staff, including a restrictive policy on the book tables. Skipping the screen does not reveal licenses. Pharmacy users are not required to enroll. If a pharmacy user does enroll a factor, later sign-ins require that code too.

Lost authenticator: a CML user with `staff.users.manage` cannot clear another person's factor from this portal. Remove the factor in the Supabase dashboard, then the user enrolls again on the next sign-in. Do not do that for the protected super admin unless you still have another way in.

## What an admin can do

Signed-in staff with the permission see:

- **Users** (`staff.users.read`, and `staff.users.manage` to change them): create a staff or pharmacy account, assign a role, disable, or delete. The initial password is typed by the admin and is not written to the audit log. Share it out of band.
- **Roles** (`staff.roles.manage`): create a custom role and edit its permissions. System roles can be renamed and, except super admin, their permissions can change. They cannot be deleted. A permission from the other scope is rejected.
- **Audit** (`staff.audit.read`): inserts, updates, and deletes made by a signed-in user.

The seeded CML operator can work the book and read the audit trail, and cannot administer accounts or roles. Pharmacy admin and pharmacy viewer start with read access to their own organization. Edit those roles later if a pharmacy should see less.

## Local stack

```bash
supabase start
supabase db reset
```

`supabase db reset` applies migrations and `supabase/seed.sql`. The seed is the fictional book only. It still does not create Auth users. Create `hello@taimoorhussain.com` in Studio (http://127.0.0.1:54323) and run `select private.bootstrap_super_admin();` in the SQL editor.

Local auth already disables signup and enables TOTP enroll and verify.

## Hostinger Node.js

Do not deploy the old static `out/` directory. The app no longer uses `output: "export"`.

- Node.js 20 or newer
- Install: `npm install`
- Build: `npm run build`
- Start: `npm start` (`next start --hostname 0.0.0.0`, port from `PORT`)
- Framework: Next.js server, not a static site. There is no output directory to publish.
- Environment: the three variables in the table above

`next build` does not bake the license book into static pages. Portal routes wait for the request.
