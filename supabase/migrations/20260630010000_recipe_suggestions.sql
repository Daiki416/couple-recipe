-- AI 提案レシピの保存テーブル recipe_suggestions
-- 用途: AI が「新しいレシピを提案」で生成した未保存ドラフトを溜め、後から
--       採用（レシピ化）/ 削除できるようにする。
-- 方針: 既存レシピ（recipes）と同じ世帯スコープ方式に揃える。
--   - 世帯判定は current_household_id()（SECURITY DEFINER ヘルパ）を使い、
--     ポリシー内で同じテーブルを自己参照しない（42P17 の再帰を避ける）
--   - to authenticated を明示（既存ハードニング 20260627143536 に準拠）
--   - insert 時 created_by = auth.uid() を with check で強制（クライアント値を信用しない）
--   - status カラムは持たない（このテーブルには「未保存の提案」だけが入る）
-- 記述順序 = 依存順（テーブル → インデックス → RLS 有効化 → ポリシー）

-- =============================================================
-- 1. テーブル（recipes と同じく id / household_id / created_by 起点）
-- =============================================================
create table public.recipe_suggestions (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  draft         jsonb not null,
  source_prompt text
);

-- =============================================================
-- 2. インデックス（FK 列。recipes と同じ作法）
-- =============================================================
create index recipe_suggestions_household_id_idx on public.recipe_suggestions (household_id);
create index recipe_suggestions_created_by_idx on public.recipe_suggestions (created_by);

-- =============================================================
-- 3. RLS 有効化 + ポリシー（select / insert / delete を自世帯のみ）
-- =============================================================
alter table public.recipe_suggestions enable row level security;

create policy "recipe_suggestions_select" on public.recipe_suggestions
  for select
  to authenticated
  using (household_id = (select public.current_household_id()));

create policy "recipe_suggestions_insert" on public.recipe_suggestions
  for insert
  to authenticated
  with check (
    household_id = (select public.current_household_id())
    and created_by = (select auth.uid())
  );

create policy "recipe_suggestions_delete" on public.recipe_suggestions
  for delete
  to authenticated
  using (household_id = (select public.current_household_id()));
