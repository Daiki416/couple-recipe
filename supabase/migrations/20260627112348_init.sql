-- 初回マイグレーション: スキーマ + インデックス + 関数/トリガ + RPC + RLS
-- 夫婦向けレシピ管理アプリ
-- 記述順序 = 依存順（拡張 → テーブル → インデックス → 関数 → トリガ → RPC → RLS）

-- =============================================================
-- 1. 拡張
-- =============================================================
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_trgm;     -- 部分一致検索（GIN）

-- =============================================================
-- 2. テーブル（FK 依存順）
-- =============================================================

-- households
create table public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  invite_code text not null unique,
  created_at  timestamptz not null default now()
);

-- profiles（id = auth.users.id, default なし）
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  household_id uuid references public.households (id) on delete set null,
  created_at   timestamptz not null default now()
);

-- recipes
create table public.recipes (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households (id) on delete cascade,
  created_by     uuid references public.profiles (id) on delete set null,
  title          text not null,
  description    text,
  source_url     text,
  servings       integer,
  rating         integer check (rating between 1 and 5),
  is_favorite    boolean not null default false,
  cooked_count   integer not null default 0,
  last_cooked_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ingredients
create table public.ingredients (
  id        uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  name      text not null,
  quantity  text,
  position  integer
);

-- recipe_steps
create table public.recipe_steps (
  id        uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  position  integer,
  body      text not null
);

-- recipe_images
create table public.recipe_images (
  id           uuid primary key default gen_random_uuid(),
  recipe_id    uuid not null references public.recipes (id) on delete cascade,
  storage_path text not null,
  position     integer
);

-- tags
create table public.tags (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name         text not null,
  unique (household_id, name)
);

-- recipe_tags
create table public.recipe_tags (
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  tag_id    uuid not null references public.tags (id) on delete cascade,
  primary key (recipe_id, tag_id)
);

-- =============================================================
-- 3. インデックス
-- =============================================================

-- GIN（部分一致検索）
create index recipes_title_trgm_idx on public.recipes using gin (title gin_trgm_ops);
create index ingredients_name_trgm_idx on public.ingredients using gin (name gin_trgm_ops);

-- btree（FK 列）
create index recipes_household_id_idx on public.recipes (household_id);
create index recipes_created_by_idx on public.recipes (created_by);
create index ingredients_recipe_id_idx on public.ingredients (recipe_id);
create index recipe_steps_recipe_id_idx on public.recipe_steps (recipe_id);
create index recipe_images_recipe_id_idx on public.recipe_images (recipe_id);
create index tags_household_id_idx on public.tags (household_id);
create index recipe_tags_tag_id_idx on public.recipe_tags (tag_id);
create index profiles_household_id_idx on public.profiles (household_id);

-- =============================================================
-- 4. ヘルパ関数 current_household_id()（RLS 再帰回避）
-- =============================================================
create or replace function public.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select household_id from public.profiles where id = auth.uid()
$$;

-- =============================================================
-- 5. updated_at 自動更新
-- =============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger recipes_set_updated_at
  before update on public.recipes
  for each row execute function public.set_updated_at();

-- =============================================================
-- 6. profiles 自動生成（auth.users への AFTER INSERT）
-- =============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, household_id)
  values (new.id, new.raw_user_meta_data->>'display_name', null);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================
-- 7. 世帯フロー用 RPC
-- =============================================================

-- 招待コード生成（紛らわしい文字を除外、UNIQUE 衝突時は再生成）
create or replace function public.gen_invite_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- I,O,0,1 を除外
  code text;
  i integer;
begin
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.households where invite_code = code);
  end loop;
  return code;
end;
$$;

-- 世帯作成
create or replace function public.create_household(name text)
returns public.households
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_household public.households;
begin
  insert into public.households (name, invite_code)
  values (name, public.gen_invite_code())
  returning * into new_household;

  update public.profiles
    set household_id = new_household.id
    where id = auth.uid();

  return new_household;
end;
$$;

-- 招待コードで参加
create or replace function public.join_household_by_invite(code text)
returns public.households
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.households;
begin
  select * into target
    from public.households
    where invite_code = code;

  if target.id is null then
    raise exception 'invalid invite code';
  end if;

  update public.profiles
    set household_id = target.id
    where id = auth.uid();

  return target;
end;
$$;

-- =============================================================
-- 8. RLS 有効化 + ポリシー
-- =============================================================
alter table public.households    enable row level security;
alter table public.profiles      enable row level security;
alter table public.recipes       enable row level security;
alter table public.ingredients   enable row level security;
alter table public.recipe_steps  enable row level security;
alter table public.recipe_images enable row level security;
alter table public.tags          enable row level security;
alter table public.recipe_tags   enable row level security;

-- profiles
create policy "profiles_select" on public.profiles
  for select
  using (
    id = (select auth.uid())
    or household_id = (select public.current_household_id())
  );

create policy "profiles_update" on public.profiles
  for update
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- households（INSERT/DELETE は RPC 経由のみ）
create policy "households_select" on public.households
  for select
  using (id = (select public.current_household_id()));

create policy "households_update" on public.households
  for update
  using (id = (select public.current_household_id()))
  with check (id = (select public.current_household_id()));

-- recipes
create policy "recipes_all" on public.recipes
  for all
  using (household_id = (select public.current_household_id()))
  with check (household_id = (select public.current_household_id()));

-- tags
create policy "tags_all" on public.tags
  for all
  using (household_id = (select public.current_household_id()))
  with check (household_id = (select public.current_household_id()));

-- ingredients
create policy "ingredients_all" on public.ingredients
  for all
  using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id
        and r.household_id = (select public.current_household_id())
    )
  )
  with check (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id
        and r.household_id = (select public.current_household_id())
    )
  );

-- recipe_steps
create policy "recipe_steps_all" on public.recipe_steps
  for all
  using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id
        and r.household_id = (select public.current_household_id())
    )
  )
  with check (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id
        and r.household_id = (select public.current_household_id())
    )
  );

-- recipe_images
create policy "recipe_images_all" on public.recipe_images
  for all
  using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id
        and r.household_id = (select public.current_household_id())
    )
  )
  with check (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id
        and r.household_id = (select public.current_household_id())
    )
  );

-- recipe_tags
create policy "recipe_tags_all" on public.recipe_tags
  for all
  using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id
        and r.household_id = (select public.current_household_id())
    )
  )
  with check (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id
        and r.household_id = (select public.current_household_id())
    )
  );
