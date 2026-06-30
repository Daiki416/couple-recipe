# Infrastructure

## Environment

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
YOUTUBE_API_KEY  # サーバ専用。YouTube Data API v3。クライアントへ露出させない
GEMINI_API_KEY  # サーバ専用。Google AI Studio (Gemini)。クライアントへ露出させない
```

## URL Import

新規作成画面の「URL から取り込み」。送信された URL を取得・解析して
RecipeForm へプリフィルする（**DB 保存はしない**。ユーザーが確認・修正して保存）。

- 一般サイト: JSON-LD（schema.org/Recipe）を優先し、無ければ OGP / meta でフォールバック。
- YouTube: Data API v3 で概要欄を取得し、見出し・箇条書き・番号付き行のヒューリスティックで
  材料 / 手順へ分割（LLM 不使用）。
- Instagram（reel / post）: og:description のキャプションを Gemini で構造化し、材料 / 手順へ
  分解する。`GEMINI_API_KEY` 未設定・失敗時は YouTube 概要欄解析を流用したヒューリスティックへ
  フォールバックする。画像は候補 URL の表示のみ。
- 画像は候補 URL の表示のみ（Storage 取り込みなし）。
- 取り込みは認証必須（Server Action `importRecipeFromUrl`）。
- SSRF 対策: 一般サイト取得時は scheme を http/https に限定し、DNS 解決時点の宛先 IP が
  private / loopback / link-local（169.254.169.254 等）/ ULA などでないことを各リダイレクト
  ホップで検証する（接続先 IP の固定までは行わないため、DNS rebinding に対しては多層防御の
  一段。利用は認証済みの世帯メンバーに限定）。タイムアウト・非 HTML を遮断し、レスポンスは
  サイズ上限までで打ち切る。
- `YOUTUBE_API_KEY` はサーバ専用。鍵・API の生レスポンスはクライアントへ返さない。

## AI Chat

`/chat` の料理アシスタント。食べたい雰囲気（さっぱり/こってり 等）や食材の希望を伝えると、
ユーザーが選んだモードで提案する（応答は一括表示・ストリーミングなし）。

- モード①「手持ちから探す」: 登録済みレシピ（自世帯）から条件に合うものを選んで提案する。
- モード②「新しいレシピを提案」: 条件に合う新しいレシピを生成し、採用したら新規作成画面へ
  プリフィルして登録できる。**確定レシピ（`recipes`）の保存は既存の RecipeForm / `create_recipe`
  でユーザーが「作成する」を押したときのみ**。
- 提案ドラフトの永続化: モード②で生成した new 提案の draft（材料・手順等）と `source_prompt` は、
  あとで見返せるよう **`recipe_suggestions` テーブルに自動保存する**（`sendChatMessage` 内で
  best-effort、世帯スコープ＋RLS）。これは確定レシピではなく「未保存の提案」の控え。
  一覧・採用・削除は `/suggestions`（「AIの提案」面）で行い、**採用＝レシピ化に成功するとその提案行は削除**
  される（採用時は hidden `suggestion_id` を渡し `createRecipe` 成功後に best-effort で消す）。
  個人データ保持の観点で、提案ドラフトは DB に残る点に留意（不要なら `/suggestions` から削除可）。
- プロバイダは Gemini Flash（無料枠・差し替え可）。追加依存を避け REST fetch で
  `generateContent` を呼び、`responseMimeType: "application/json"` ＋ `responseSchema` で
  構造化出力を受ける（`src/lib/ai.ts`）。
- 認証必須（Server Action `sendChatMessage`）。自世帯レシピは RLS 経由で取得し、LLM へ渡すのは
  id / title / tags / 調理時間 / 材料名（先頭数件）のみ。件数・サイズに上限を設けプロンプト肥大を防ぐ。
- 入力（メッセージ・会話履歴）は `validation/text.ts` で長さ・制御文字を検証し件数上限を設ける。
- LLM 出力は再検証・正規化する（existing は実在 recipeId のみ通し、new.draft は
  `RecipeFormValues` へクランプ。捏造 URL は破棄）。
- `GEMINI_API_KEY` はサーバ専用。鍵・API の生レスポンスはクライアントへ返さない。
  鍵未設定・失敗時は汎用エラーを返し、アプリは落とさない。
- 会話状態は React state ＋ sessionStorage（タブ移動や新規作成画面への遷移で消えないよう
  セッション限りで保持。DB 永続化はしない）。復元時は型を検証し new.draft は再正規化する。
- `gemini-2.0-flash` は鍵のプロジェクトによって無料枠が `limit:0`（429）のことがあるため、
  既定モデルは無料枠が有効な `gemini-2.5-flash`（差し替え可）。

## Storage

- Supabase Storage
- 将来S3へ差し替え可能

## Deploy

- Vercel

## Secrets

- `.env.local`
- コミット禁止