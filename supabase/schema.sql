create table if not exists public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in ('Promotional Video', 'Social Campaign', 'Reel Production', 'Brand Design', 'Social Creative', 'Digital Campaign')),
  description text not null default '',
  media_url text not null,
  media_type text not null check (media_type in ('image', 'video')),
  thumbnail_url text,
  is_published boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contact_settings (
  id integer primary key default 1 check (id = 1),
  email text not null default '',
  whatsapp_number text not null default '',
  instagram_url text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

insert into public.contact_settings (id) values (1) on conflict (id) do nothing;

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists portfolio_items_updated_at on public.portfolio_items;
create trigger portfolio_items_updated_at before update on public.portfolio_items for each row execute function public.set_updated_at();
drop trigger if exists contact_settings_updated_at on public.contact_settings;
create trigger contact_settings_updated_at before update on public.contact_settings for each row execute function public.set_updated_at();

alter table public.portfolio_items enable row level security;
alter table public.contact_settings enable row level security;
alter table public.admin_users enable row level security;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where id = auth.uid());
$$;

drop policy if exists "Admins can read their admin record" on public.admin_users;
create policy "Admins can read their admin record" on public.admin_users for select to authenticated using (id = auth.uid());

drop policy if exists "Published portfolio is public" on public.portfolio_items;
create policy "Published portfolio is public" on public.portfolio_items for select using (is_published = true or public.is_admin());
drop policy if exists "Authenticated users manage portfolio" on public.portfolio_items;
create policy "Authenticated admins manage portfolio" on public.portfolio_items for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Public reads contact settings" on public.contact_settings;
create policy "Public reads contact settings" on public.contact_settings for select using (true);
drop policy if exists "Authenticated users manage contact settings" on public.contact_settings;
create policy "Authenticated admins manage contact settings" on public.contact_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public) values ('portfolio', 'portfolio', true) on conflict (id) do update set public = true;
drop policy if exists "Public can view portfolio media" on storage.objects;
create policy "Public can view portfolio media" on storage.objects for select using (bucket_id = 'portfolio');
drop policy if exists "Authenticated users upload portfolio media" on storage.objects;
create policy "Authenticated admins upload portfolio media" on storage.objects for insert to authenticated with check (bucket_id = 'portfolio' and public.is_admin());
drop policy if exists "Authenticated users update portfolio media" on storage.objects;
create policy "Authenticated admins update portfolio media" on storage.objects for update to authenticated using (bucket_id = 'portfolio' and public.is_admin()) with check (bucket_id = 'portfolio' and public.is_admin());
drop policy if exists "Authenticated users delete portfolio media" on storage.objects;
create policy "Authenticated admins delete portfolio media" on storage.objects for delete to authenticated using (bucket_id = 'portfolio' and public.is_admin());
