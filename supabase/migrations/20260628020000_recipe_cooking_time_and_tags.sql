-- レシピに調理時間カラムを追加し、CRUD RPC をタグ対応に拡張する。
-- 方針: 既存 20260628010000_recipe_crud_rpc.sql の作法を踏襲する。
--   - SECURITY DEFINER + set search_path = ''
--   - 冒頭で auth.uid() / current_household_id() の NULL ガード
--   - household_id / created_by は DB 側で埋める（クライアント値を信用しない）
--   - 子テーブルは jsonb 配列を with ordinality で展開し position を 1 始まりで採番
--   - タグは get-or-create（household 単位で名寄せ）して recipe_tags に紐付ける
--   - 権限は revoke from public, anon → grant to authenticated
-- シグネチャ変更（p_tags 追加）のため既存関数を drop してから作り直す。

-- =============================================================
-- 1. recipes.cooking_time_minutes 追加
-- =============================================================
alter table public.recipes
  add column cooking_time_minutes integer check (cooking_time_minutes >= 1);

-- =============================================================
-- 2. 旧シグネチャの RPC を drop
-- =============================================================
drop function if exists public.create_recipe(jsonb, jsonb, jsonb);
drop function if exists public.update_recipe(uuid, jsonb, jsonb, jsonb);

-- =============================================================
-- 3. create_recipe(p_recipe, p_ingredients, p_steps, p_tags) returns uuid
-- =============================================================
create function public.create_recipe(
  p_recipe jsonb,
  p_ingredients jsonb,
  p_steps jsonb,
  p_tags jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
  v_recipe_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  v_household_id := public.current_household_id();
  if v_household_id is null then
    raise exception 'no household';
  end if;

  insert into public.recipes (
    household_id,
    created_by,
    title,
    description,
    source_url,
    servings,
    rating,
    cooking_time_minutes,
    is_favorite
  )
  values (
    v_household_id,
    auth.uid(),
    p_recipe->>'title',
    nullif(p_recipe->>'description', ''),
    nullif(p_recipe->>'source_url', ''),
    nullif(p_recipe->>'servings', '')::integer,
    nullif(p_recipe->>'rating', '')::integer,
    nullif(p_recipe->>'cooking_time_minutes', '')::integer,
    coalesce((p_recipe->>'is_favorite')::boolean, false)
  )
  returning id into v_recipe_id;

  insert into public.ingredients (recipe_id, name, quantity, position)
  select
    v_recipe_id,
    elem->>'name',
    nullif(elem->>'quantity', ''),
    ord
  from jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb))
    with ordinality as t(elem, ord);

  insert into public.recipe_steps (recipe_id, body, position)
  select
    v_recipe_id,
    elem->>'body',
    ord
  from jsonb_array_elements(coalesce(p_steps, '[]'::jsonb))
    with ordinality as t(elem, ord);

  -- タグ: 名前を trim → 自世帯で get-or-create → recipe_tags に紐付け
  insert into public.tags (household_id, name)
  select v_household_id, btrim(name)
  from jsonb_array_elements_text(coalesce(p_tags, '[]'::jsonb)) as t(name)
  where btrim(name) <> ''
  on conflict (household_id, name) do nothing;

  insert into public.recipe_tags (recipe_id, tag_id)
  select v_recipe_id, tg.id
  from public.tags tg
  where tg.household_id = v_household_id
    and tg.name in (
      select btrim(name)
      from jsonb_array_elements_text(coalesce(p_tags, '[]'::jsonb)) as t(name)
      where btrim(name) <> ''
    );

  return v_recipe_id;
end;
$$;

-- =============================================================
-- 4. update_recipe(p_id, p_recipe, p_ingredients, p_steps, p_tags) returns uuid
-- =============================================================
create function public.update_recipe(
  p_id uuid,
  p_recipe jsonb,
  p_ingredients jsonb,
  p_steps jsonb,
  p_tags jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  v_household_id := public.current_household_id();
  if v_household_id is null then
    raise exception 'no household';
  end if;

  -- 対象レシピが自世帯のものか確認（既存ヘルパを再利用）
  if not public.recipe_in_current_household(p_id) then
    raise exception 'recipe not found';
  end if;

  -- household_id / created_by は変更しない。updated_at はトリガ任せ。
  update public.recipes set
    title = p_recipe->>'title',
    description = nullif(p_recipe->>'description', ''),
    source_url = nullif(p_recipe->>'source_url', ''),
    servings = nullif(p_recipe->>'servings', '')::integer,
    rating = nullif(p_recipe->>'rating', '')::integer,
    cooking_time_minutes = nullif(p_recipe->>'cooking_time_minutes', '')::integer,
    is_favorite = coalesce((p_recipe->>'is_favorite')::boolean, false)
  where id = p_id;

  -- 子テーブルは全削除 → 再挿入（position を振り直す）
  delete from public.ingredients where recipe_id = p_id;
  delete from public.recipe_steps where recipe_id = p_id;
  delete from public.recipe_tags where recipe_id = p_id;

  insert into public.ingredients (recipe_id, name, quantity, position)
  select
    p_id,
    elem->>'name',
    nullif(elem->>'quantity', ''),
    ord
  from jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb))
    with ordinality as t(elem, ord);

  insert into public.recipe_steps (recipe_id, body, position)
  select
    p_id,
    elem->>'body',
    ord
  from jsonb_array_elements(coalesce(p_steps, '[]'::jsonb))
    with ordinality as t(elem, ord);

  -- タグ: 名前を trim → 自世帯で get-or-create → recipe_tags に紐付け
  insert into public.tags (household_id, name)
  select v_household_id, btrim(name)
  from jsonb_array_elements_text(coalesce(p_tags, '[]'::jsonb)) as t(name)
  where btrim(name) <> ''
  on conflict (household_id, name) do nothing;

  insert into public.recipe_tags (recipe_id, tag_id)
  select p_id, tg.id
  from public.tags tg
  where tg.household_id = v_household_id
    and tg.name in (
      select btrim(name)
      from jsonb_array_elements_text(coalesce(p_tags, '[]'::jsonb)) as t(name)
      where btrim(name) <> ''
    );

  return p_id;
end;
$$;

-- =============================================================
-- 5. 実行権限の見直し（新シグネチャに対して設定し直す）
-- =============================================================
revoke execute on function public.create_recipe(jsonb, jsonb, jsonb, jsonb) from public, anon;
revoke execute on function public.update_recipe(uuid, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.create_recipe(jsonb, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.update_recipe(uuid, jsonb, jsonb, jsonb, jsonb) to authenticated;
