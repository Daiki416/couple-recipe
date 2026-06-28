-- レシピ検索・絞り込み用 RPC
-- recipes をキーワード / 調理時間 / お気に入り / 評価 / タグ で絞り込む。
-- 方針: 既存 RPC（create_recipe 等）の作法を踏襲する。
--   - SECURITY DEFINER + set search_path = ''
--   - 冒頭で auth.uid() / current_household_id() の NULL ガード
--   - SECURITY DEFINER は RLS を迂回するため household_id を本体 select で明示的に絞る（漏洩防止）
--   - 権限は revoke from public, anon → grant to authenticated
-- 新規関数のため drop は不要。

-- =============================================================
-- 1. search_recipes(p_q, p_max_time, p_favorite, p_min_rating, p_tags)
-- =============================================================
create function public.search_recipes(
  p_q text default null,
  p_max_time integer default null,
  p_favorite boolean default null,
  p_min_rating integer default null,
  p_tags text[] default null
)
returns table (
  id uuid,
  title text,
  rating integer,
  is_favorite boolean,
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
-- 2. 実行権限の見直し（既存ハードニングと同じ作法）
-- =============================================================
revoke execute on function public.search_recipes(text, integer, boolean, integer, text[]) from public, anon;
grant execute on function public.search_recipes(text, integer, boolean, integer, text[]) to authenticated;
