# Integrations

## Storage

- Supabase Storage
- 将来 S3 へ差し替え可能

## AI

- `src/lib/ai.ts` を経由する
- プロバイダ変更可能な設計

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