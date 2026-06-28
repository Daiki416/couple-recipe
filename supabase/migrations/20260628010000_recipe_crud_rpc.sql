-- レシピ CRUD 用 RPC
-- recipes + ingredients + recipe_steps を一括で作成/更新する。
-- 方針: 既存 RPC（create_household 等）と同じ作法に合わせる。
--   - SECURITY DEFINER + set search_path = ''
--   - 冒頭で auth.uid() / current_household_id() の NULL ガード
--   - household_id / created_by は DB 側で埋める（クライアント値を信用しない）
--   - 子テーブルは jsonb 配列を with ordinality で展開し position を 1 始まりで採番
--   - 権限は revoke from public, anon → grant to authenticated

-- =============================================================
-- 1. create_recipe(p_recipe, p_ingredients, p_steps) returns uuid
-- =============================================================
create or replace function public.create_recipe(
  p_recipe jsonb,
  p_ingredients jsonb,
  p_steps jsonb
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

  return v_recipe_id;
end;
$$;

-- =============================================================
-- 2. update_recipe(p_id, p_recipe, p_ingredients, p_steps) returns uuid
-- =============================================================
create or replace function public.update_recipe(
  p_id uuid,
  p_recipe jsonb,
  p_ingredients jsonb,
  p_steps jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if public.current_household_id() is null then
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
    is_favorite = coalesce((p_recipe->>'is_favorite')::boolean, false)
  where id = p_id;

  -- 子テーブルは全削除 → 再挿入（position を振り直す）
  delete from public.ingredients where recipe_id = p_id;
  delete from public.recipe_steps where recipe_id = p_id;

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

  return p_id;
end;
$$;

-- =============================================================
-- 3. 実行権限の見直し（既存ハードニングと同じ作法）
-- =============================================================
revoke execute on function public.create_recipe(jsonb, jsonb, jsonb) from public, anon;
revoke execute on function public.update_recipe(uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.create_recipe(jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.update_recipe(uuid, jsonb, jsonb, jsonb) to authenticated;
