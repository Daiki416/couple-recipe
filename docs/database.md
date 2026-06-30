# Integrations

## Storage

- Supabase Storage
- 将来 S3 へ差し替え可能

## AI

- `src/lib/ai.ts` を経由する
- プロバイダ変更可能な設計

## Recipe Suggestions（AIの提案）

- テーブル `recipe_suggestions`（`id` / `household_id` / `created_by` / `created_at` /
  `draft jsonb` / `source_prompt`）。「新しいレシピを提案」モードの生成ドラフトを控える。
  status は持たず、常に「未保存の提案」のみが入る（採用＝レシピ化成功で行削除）。
- RLS 有効。`select` / `insert` / `delete` を自世帯のみに制限（既存レシピと同じ
  `current_household_id()` ヘルパで判定。自己参照サブクエリは使わない）。`insert` の
  `with check` で `created_by = auth.uid()` を強制。
- マイグレーション: `supabase/migrations/20260630010000_recipe_suggestions.sql`。
- スキーマの真実の源泉は migrations。型は `src/types/database.ts`。

## URL Import

- URLからレシピを取得しフォームへ反映

## Environment

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

- `.env.local` を使用
- 秘密情報はコミットしない