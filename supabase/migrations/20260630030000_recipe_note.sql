-- レシピに「メモ」カラム（note）を追加し、CRUD RPC を note 対応に拡張する。
-- 方針: 既存 20260628020000_recipe_cooking_time_and_tags.sql の本体をそのまま踏襲する。
--   - note は p_recipe jsonb の中に含めるため、関数シグネチャは不変。
--     よって drop / grant の再設定は不要（CREATE OR REPLACE で本体だけ更新する）。
--   - 「説明(description)」とは独立したフィールド。空文字は nullif で NULL に倒す。
--   - その他のロジック（cooking_time_minutes / tags / ingredients / steps /
--     security definer / search_path / 世帯チェック）は一切変更しない。

-- =============================================================
-- 1. recipes.note 追加
-- =============================================================
alter table public.recipes
  add column note text;

-- =============================================================
-- 2. create_recipe(p_recipe, p_ingredients, p_steps, p_tags) returns uuid
-- =============================================================
create or replace function public.create_recipe(
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
    note,
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
    nullif(p_recipe->>'note', ''),
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
-- 3. update_recipe(p_id, p_recipe, p_ingredients, p_steps, p_tags) returns uuid
-- =============================================================
create or replace function public.update_recipe(
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
    note = nullif(p_recipe->>'note', ''),
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
