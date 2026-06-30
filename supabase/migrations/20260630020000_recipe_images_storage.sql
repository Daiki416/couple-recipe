-- レシピ写真（メイン1枚）の保存先 Storage バケットと RLS
-- 用途: recipes に紐づくメイン写真 1 枚を Supabase Storage に保存する。
--       行メタは既存の public.recipe_images（position=0 の 1 行）を流用し、
--       recipes へのカラム追加はしない。
-- 方針:
--   - private バケット（public=false）。表示は署名 URL（createSignedUrl）で行う。
--   - storage.objects への RLS は世帯フォルダ判定で行う。
--     パス規約: {household_id}/{recipe_id}/{uuid}.{ext}
--     先頭フォルダ（storage.foldername(name))[1]）= 世帯 ID と一致する行のみ許可する。
--   - 世帯判定は public.current_household_id()（SECURITY DEFINER ヘルパ）を使い、
--     同テーブル自己参照を避ける（既存 recipe_suggestions と同作法）。
--   - to authenticated を明示（既存ハードニング 20260627143536 に準拠）。
--   - drop policy if exists で冪等化、ポリシー名は明示する。

-- =============================================================
-- 1. private バケット（公開しない。表示は署名 URL）
-- =============================================================
insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', false)
on conflict (id) do nothing;

-- =============================================================
-- 2. storage.objects への RLS ポリシー（select / insert / update / delete）
--    条件: 対象バケット かつ 先頭フォルダ = 自世帯 ID
-- =============================================================
drop policy if exists "recipe_images_objects_select" on storage.objects;
create policy "recipe_images_objects_select" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] = (select public.current_household_id())::text
  );

drop policy if exists "recipe_images_objects_insert" on storage.objects;
create policy "recipe_images_objects_insert" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] = (select public.current_household_id())::text
  );

drop policy if exists "recipe_images_objects_update" on storage.objects;
create policy "recipe_images_objects_update" on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] = (select public.current_household_id())::text
  )
  with check (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] = (select public.current_household_id())::text
  );

drop policy if exists "recipe_images_objects_delete" on storage.objects;
create policy "recipe_images_objects_delete" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] = (select public.current_household_id())::text
  );
