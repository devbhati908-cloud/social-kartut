# Social Kartut

## Supabase setup

1. Create a Supabase project.
2. In **SQL Editor**, run `supabase/schema.sql`. It creates `portfolio_items`, `contact_settings`, the public storage bucket, triggers, and Row Level Security policies.
3. In **Authentication > Providers**, enable Email. Keep public sign-ups disabled if the project should have one private admin account.
4. In **Authentication > Users**, choose **Add user** and create the admin email/password. There is no registration page in this app.
5. Add that user to the admin allowlist from SQL Editor, replacing the email:

```sql
insert into public.admin_users (id)
select id from auth.users where email = 'you@example.com'
on conflict (id) do nothing;
```

6. Copy `.env.example` to `.env` and add the Supabase project URL and anon key. Never add a service-role key to `.env` or frontend code.
7. Install dependencies and run the site:

```sh
npm install
npm run dev
```

Open `/admin/login` to sign in, or use the dashboard link at `/admin` directly. Vite serves both routes through the SPA fallback.

## Storage and security

The `portfolio` bucket is public for media delivery, while upload/update/delete operations require an authenticated user listed in `admin_users`. Database RLS allows public visitors to read only published portfolio items; only approved admins can manage portfolio and contact rows.

## Deployment

Build with `npm run build`, then deploy the generated `dist` folder to a static host. Add the same `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` values to the host's environment settings. Configure the host to rewrite `/admin/*` to `index.html` so the admin route loads on refresh.
