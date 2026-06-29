# Infrastructure

## Environment

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
YOUTUBE_API_KEY  # サーバ専用。YouTube Data API v3。クライアントへ露出させない
```

## URL Import

新規作成画面の「URL から取り込み」。送信された URL を取得・解析して
RecipeForm へプリフィルする（**DB 保存はしない**。ユーザーが確認・修正して保存）。

- 一般サイト: JSON-LD（schema.org/Recipe）を優先し、無ければ OGP / meta でフォールバック。
- YouTube: Data API v3 で概要欄を取得し、見出し・箇条書き・番号付き行のヒューリスティックで
  材料 / 手順へ分割（LLM 不使用）。
- 画像は候補 URL の表示のみ（Storage 取り込みなし）。
- 取り込みは認証必須（Server Action `importRecipeFromUrl`）。
- SSRF 対策: 一般サイト取得時は scheme を http/https に限定し、DNS 解決時点の宛先 IP が
  private / loopback / link-local（169.254.169.254 等）/ ULA などでないことを各リダイレクト
  ホップで検証する（接続先 IP の固定までは行わないため、DNS rebinding に対しては多層防御の
  一段。利用は認証済みの世帯メンバーに限定）。タイムアウト・非 HTML を遮断し、レスポンスは
  サイズ上限までで打ち切る。
- `YOUTUBE_API_KEY` はサーバ専用。鍵・API の生レスポンスはクライアントへ返さない。

## Storage

- Supabase Storage
- 将来S3へ差し替え可能

## Deploy

- Vercel

## Secrets

- `.env.local`
- コミット禁止