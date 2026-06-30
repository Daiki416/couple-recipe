-- レシピに「作ったことがあるか」フラグ（is_cooked）を追加する。
-- 方針: 既存 20260630030000_recipe_note.sql の作法をそのまま踏襲する。
--   - is_cooked は p_recipe jsonb の中に含めるため、create_recipe / update_recipe の
--     シグネチャは不変。よって drop / grant の再設定は不要（CREATE OR REPLACE で本体だけ更新）。
--   - search_recipes は返り値（returns table）と引数が変わるため、いったん drop して再作成する。
--     既存 20260628030000_search_recipes_rpc.sql で作成済みの 5 引数版が存在する前提で、
--     本マイグレーションはそれより後に適用される（適用順は連番で保証）。
--   - その他のロジック（security definer / search_path / 世帯チェック / 各列）は変更しない。

-- =============================================================
-- 1. recipes.is_cooked 追加
-- =============================================================
alter table public.recipes
  add column is_cooked boolean not null default false;

-- =============================================================
-- 2. create_recipe(p_recipe, p_ingredients, p_steps, p_tags) returns uuid
--    is_cooked を insert に追加するのみ（シグネチャ不変）。
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
    is_favorite,
    is_cooked
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
    coalesce((p_recipe->>'is_favorite')::boolean, false),
    coalesce((p_recipe->>'is_cooked')::boolean, false)
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
--    is_cooked を set に追加するのみ（シグネチャ不変）。
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
    is_favorite = coalesce((p_recipe->>'is_favorite')::boolean, false),
    is_cooked = coalesce((p_recipe->>'is_cooked')::boolean, false)
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
-- 4. search_recipes 再作成（返り値・引数が変わるため drop → create）
--    既存 5 引数版を drop し、p_cooked を加えた 6 引数版を作る。
-- =============================================================
drop function public.search_recipes(text, integer, boolean, integer, text[]);

create function public.search_recipes(
  p_q text default null,
  p_max_time integer default null,
  p_favorite boolean default null,
  p_min_rating integer default null,
  p_tags text[] default null,
  p_cooked boolean default null
)
returns table (
  id uuid,
  title text,
  rating integer,
  is_favorite boolean,
  is_cooked boolean,
  servings integer,
  cooking_time_minutes integer,
  updated_at timestamptz,
  tags text[]
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
  v_q text;
  v_pat text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  v_household_id := public.current_household_id();
  if v_household_id is null then
    raise exception 'no household';
  end if;

  -- キーワード: 空なら無効化。ILIKE のメタ文字は \ → % → _ の順でエスケープする。
  v_q := nullif(btrim(coalesce(p_q, '')), '');
  if v_q is not null then
    v_pat := '%' ||
      replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') ||
      '%';
  end if;

  return query
  select
    r.id,
    r.title,
    r.rating,
    r.is_favorite,
    r.is_cooked,
    r.servings,
    r.cooking_time_minutes,
    r.updated_at,
    coalesce(
      (
        select array_agg(t2.name order by t2.name)
        from public.recipe_tags rt2
        join public.tags t2 on t2.id = rt2.tag_id
        where rt2.recipe_id = r.id
      ),
      '{}'
    ) as tags
  from public.recipes r
  where r.household_id = v_household_id
    and (
      v_pat is null
      or (
        r.title ilike v_pat escape '\'
        or exists (
          select 1
          from public.ingredients i
          where i.recipe_id = r.id
            and i.name ilike v_pat escape '\'
        )
      )
    )
    and (
      p_max_time is null
      or (r.cooking_time_minutes is not null and r.cooking_time_minutes <= p_max_time)
    )
    and (p_favorite is not true or r.is_favorite)
    -- cooked は3択（null=すべて / true=作った / false=まだ）。false 絞りが要るため明示比較。
    and (p_cooked is null or r.is_cooked = p_cooked)
    and (
      p_min_rating is null
      or (r.rating is not null and r.rating >= p_min_rating)
    )
    and (
      p_tags is null
      or cardinality(p_tags) = 0
      or r.id in (
        select rt.recipe_id
        from public.recipe_tags rt
        join public.tags t on t.id = rt.tag_id
        where t.household_id = v_household_id
          and t.name = any(p_tags)
        group by rt.recipe_id
        having count(distinct t.name) = cardinality(p_tags)
      )
    )
  order by r.updated_at desc;
end;
$$;

-- =============================================================
-- 5. 実行権限の見直し（既存ハードニングと同じ作法・新 6 引数シグネチャ）
-- =============================================================
revoke execute on function public.search_recipes(text, integer, boolean, integer, text[], boolean) from public, anon;
grant execute on function public.search_recipes(text, integer, boolean, integer, text[], boolean) to authenticated;
