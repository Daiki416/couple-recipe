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