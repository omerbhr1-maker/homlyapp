create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  password text not null default '',
  display_name text not null,
  avatar_url text not null default '',
  auth_user_id uuid,
  created_at timestamptz not null default now()
);

create unique index if not exists app_users_username_unique
on public.app_users (lower(username));

create table if not exists public.houses (
  id text primary key,
  name text not null,
  pin text not null default '',
  owner_user_id uuid references public.app_users(id) on delete set null,
  sections jsonb not null,
  invite_phone text not null default '',
  house_image text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.houses
add column if not exists owner_user_id uuid references public.app_users(id) on delete set null;

alter table public.houses
add column if not exists house_image text not null default '';

alter table public.app_users
add column if not exists auth_user_id uuid;

create unique index if not exists app_users_auth_user_id_unique
on public.app_users (auth_user_id)
where auth_user_id is not null;

alter table public.app_users
alter column password set default '';

alter table public.app_users
alter column password drop not null;

update public.app_users
set password = ''
where password is null;

alter table public.houses
alter column pin set default '';

drop index if exists public.houses_name_unique;

create table if not exists public.house_members (
  house_id text not null references public.houses(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (house_id, user_id)
);

create table if not exists public.house_invites (
  token text primary key,
  house_id text not null references public.houses(id) on delete cascade,
  created_by_user_id uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists houses_set_updated_at on public.houses;
create trigger houses_set_updated_at
before update on public.houses
for each row execute function public.set_updated_at();

create or replace function public.auto_confirm_auth_users()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is null then
    new.email_confirmed_at = now();
  end if;
  if new.confirmed_at is null then
    new.confirmed_at = new.email_confirmed_at;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auto_confirm_auth_users on auth.users;
create trigger trg_auto_confirm_auth_users
before insert on auth.users
for each row execute function public.auto_confirm_auth_users();

alter table public.app_users enable row level security;
alter table public.houses enable row level security;
alter table public.house_members enable row level security;
alter table public.house_invites enable row level security;

create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.app_users
  where auth_user_id = auth.uid() or id = auth.uid()
  order by case when auth_user_id = auth.uid() then 0 else 1 end
  limit 1
$$;

create or replace function public.find_app_user_by_email(p_email text)
returns table(app_user_id uuid)
language sql
stable
security definer
set search_path = public, auth
as $$
  select au.id
  from public.app_users au
  join auth.users u on u.id = au.auth_user_id
  where auth.uid() is not null
    and lower(u.email) = lower(trim(p_email))
  order by au.created_at asc
  limit 1
$$;

revoke all on function public.find_app_user_by_email(text) from public;
grant execute on function public.find_app_user_by_email(text) to authenticated;

create or replace function public.is_house_member(target_house_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.house_members hm
    where hm.house_id = target_house_id
      and hm.user_id = public.current_app_user_id()
  )
$$;

create or replace function public.is_house_owner(target_house_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.houses h
    where h.id = target_house_id
      and h.owner_user_id = public.current_app_user_id()
  )
$$;

drop policy if exists "app_users_select" on public.app_users;
create policy "app_users_select"
on public.app_users
for select
using (auth.uid() is not null);

drop policy if exists "app_users_insert" on public.app_users;
create policy "app_users_insert"
on public.app_users
for insert
with check (auth.uid() is not null and auth_user_id = auth.uid());

drop policy if exists "app_users_update" on public.app_users;
create policy "app_users_update"
on public.app_users
for update
using (
  auth.uid() is not null
  and (auth_user_id = auth.uid() or auth_user_id is null)
)
with check (auth.uid() is not null and auth_user_id = auth.uid());

drop policy if exists "houses_select" on public.houses;
create policy "houses_select"
on public.houses
for select
using (public.is_house_member(id));

drop policy if exists "houses_insert" on public.houses;
create policy "houses_insert"
on public.houses
for insert
with check (owner_user_id = public.current_app_user_id());

drop policy if exists "houses_update" on public.houses;
create policy "houses_update"
on public.houses
for update
using (public.is_house_member(id))
with check (public.is_house_member(id));

drop policy if exists "houses_delete" on public.houses;
create policy "houses_delete"
on public.houses
for delete
using (public.is_house_owner(id));

drop policy if exists "house_members_select" on public.house_members;
create policy "house_members_select"
on public.house_members
for select
using (public.is_house_member(house_id) or public.is_house_owner(house_id));

drop policy if exists "house_members_insert" on public.house_members;
create policy "house_members_insert"
on public.house_members
for insert
with check (
  public.is_house_owner(house_id)
  or user_id = public.current_app_user_id()
  or user_id = auth.uid()
);

drop policy if exists "house_members_update" on public.house_members;
create policy "house_members_update"
on public.house_members
for update
using (public.is_house_owner(house_id))
with check (public.is_house_owner(house_id));

drop policy if exists "house_invites_select" on public.house_invites;
create policy "house_invites_select"
on public.house_invites
for select
using (auth.uid() is not null);

drop policy if exists "house_invites_insert" on public.house_invites;
create policy "house_invites_insert"
on public.house_invites
for insert
with check (public.is_house_member(house_id));
