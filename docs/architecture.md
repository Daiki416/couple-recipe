# Architecture

## Stack

- Next.js (App Router)
- TypeScript
- Supabase
- Vercel

## Principles

- Supabaseアクセスは原則サーバ側
- Server / Client の責務を分離する
- 外部サービスは `src/lib` の抽象化を利用する
- 実装を差し替えやすい設計を維持する

## Structure

```text
src/app
src/components
src/lib
src/types
```

## ストレージ抽象

- 画像ストレージは `ImageStorage` インターフェース（`src/lib/storage.ts`）越しに使う。
- Supabase 実装は `src/lib/storage.supabase.ts` の `SupabaseImageStorage`
  （`upload` / `getUrl` / `getUrls` / `remove`）。private バケット前提で表示は署名 URL。
  `createRecipeImageStorage(supabase)` で `recipe-images` 用インスタンスを生成する。
- 利用側（Server Action / Server Component）は実装に直接依存せず抽象越しに使い、
  将来 S3 実装へ差し替え可能にする。