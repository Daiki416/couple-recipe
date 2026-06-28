-- RLS ハードニング マイグレーション
-- 対象: docs/review-notes.md の Warning 4件 + 低リスク Suggestion の解消
-- 方針: テーブル定義/インデックス/FK には触れず、関数・権限・ポリシーのみ変更する。
-- 記述順序 = 依存順（関数追加 → 関数再定義 → 権限 → ポリシー貼り替え）

-- =============================================================
-- 1. ヘルパ関数: recipe_in_current_household(rid)
--    子テーブル4ポリシーの「recipes 経由で household を辿る EXISTS」を一元化
-- =============================================================
create or replace function public.recipe_in_current_household(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.recipes r
    where r.id = rid
      and r.household_id = public.current_household_id()
  )
$$;

-- =============================================================
-- 2. set_updated_at() に search_path = '' を付与（本体不変）
-- =============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================
-- 3. gen_invite_code()（本体・シグネチャ不変。後段で権限のみ絞る）
-- =============================================================
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

-- =============================================================
-- 4. create_household(name text): 冒頭に NULL ガード追加（本体維持）
-- =============================================================
create or replace function public.create_household(name text)
returns public.households
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_household public.households;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.households (name, invite_code)
  values (name, public.gen_invite_code())
  returning * into new_household;

  update public.profiles
    set household_id = new_household.id
    where id = auth.uid();

  return new_household;
end;
$$;

-- =============================================================
-- 5. join_household_by_invite(code text): 冒頭に NULL ガード追加（本体維持）
-- =============================================================
create or replace function public.join_household_by_invite(code text)
returns public.households
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.households;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

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
-- 6. 関数実行権限の見直し
-- =============================================================
revoke execute on function public.create_household(text) from public, anon;
revoke execute on function public.join_household_by_invite(text) from public, anon;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household_by_invite(text) to authenticated;
revoke execute on function public.gen_invite_code() from public, anon, authenticated;

-- =============================================================
-- 7. ポリシー貼り替え（全10件: drop → create、すべて to authenticated 明示）
-- =============================================================

-- profiles
drop policy "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or household_id = (select public.current_household_id())
  );

drop policy "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and household_id is not distinct from (select public.current_household_id())
  );

-- households
drop policy "households_select" on public.households;
create policy "households_select" on public.households
  for select
  to authenticated
  using (id = (select public.current_household_id()));

drop policy "households_update" on public.households;
create policy "households_update" on public.households
  for update
  to authenticated
  using (id = (select public.current_household_id()))
  with check (
    id = (select public.current_household_id())
    and invite_code = (
      select h.invite_code from public.households h
      where h.id = (select public.current_household_id())
    )
  );

-- recipes
drop policy "recipes_all" on public.recipes;
create policy "recipes_all" on public.recipes
  for all
  to authenticated
  using (household_id = (select public.current_household_id()))
  with check (household_id = (select public.current_household_id()));

-- tags
drop policy "tags_all" on public.tags;
create policy "tags_all" on public.tags
  for all
  to authenticated
  using (household_id = (select public.current_household_id()))
  with check (household_id = (select public.current_household_id()));

-- ingredients
drop policy "ingredients_all" on public.ingredients;
create policy "ingredients_all" on public.ingredients
  for all
  to authenticated
  using (public.recipe_in_current_household(recipe_id))
  with check (public.recipe_in_current_household(recipe_id));

-- recipe_steps
drop policy "recipe_steps_all" on public.recipe_steps;
create policy "recipe_steps_all" on public.recipe_steps
  for all
  to authenticated
  using (public.recipe_in_current_household(recipe_id))
  with check (public.recipe_in_current_household(recipe_id));

-- recipe_images
drop policy "recipe_images_all" on public.recipe_images;
create policy "recipe_images_all" on public.recipe_images
  for all
  to authenticated
  using (public.recipe_in_current_household(recipe_id))
  with check (public.recipe_in_current_household(recipe_id));

-- recipe_tags
drop policy "recipe_tags_all" on public.recipe_tags;
create policy "recipe_tags_all" on public.recipe_tags
  for all
  to authenticated
  using (public.recipe_in_current_household(recipe_id))
  with check (
    public.recipe_in_current_household(recipe_id)
    and exists (
      select 1 from public.tags t
      where t.id = tag_id
        and t.household_id = (select public.current_household_id())
    )
  );
