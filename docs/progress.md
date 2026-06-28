# 進捗管理 — 夫婦向けレシピ管理アプリ

最終更新: 2026-06-28（E 検索 完了）

関連ドキュメント: [要件定義](./requirements.md) / [アーキテクチャ](./architecture.md) / ロードマップ `~/.claude/plans/rustling-cuddling-pond.md`

## ステータス凡例
- ✅ 完了　🚧 進行中　⏳ 未着手　⛔ ブロック中（他者の作業待ち）

## フェーズ進捗

| フェーズ | 内容 | 状態 | レビュー | 備考 |
|---|---|---|---|---|
| A | Claude駆動開発の環境整備（git / CLAUDE.md / docs） | ✅ | — (環境構築のため対象外) | |
| B-1 | Next.js 雛形 + Supabase 接続基盤（lib/型/env） | ✅ | — (雛形のため対象外) | tsc/eslint/build で検証済み |
| B-2 | Supabase プロジェクト作成 + 接続 + スキーマ/RLS マイグレーション | ✅ | Critical 0 / Warning 0 | 8テーブル+RLS+RPC。ハードニング(harden_rls)で旧Warning4件を全解消。スモーク12/12 PASS |
| C-1 | 認証基盤（proxy / サインアップ / ログイン / ログアウト / 認証ガード） | ✅ | Critical 0 / Warning 0 | メール確認オフ運用。ハードニング(W#1-3+Cookie属性)完了。Next16 proxy移行済み |
| C-2 | 世帯オンボーディング（2人運用のため UI は作らず手動紐づけ） | ✅ | — (アプリコード変更なし) | 2人運用のため招待コード/作成/参加UIは作らず。テーブル・RLS・RPC は将来公開用に温存。2アカウントを SQL で同一世帯に手動紐づけ |
| D-1 | レシピCRUD（手入力フォーム: 作成/一覧/詳細/編集/削除、材料・手順の動的入力） | ✅ | Critical 0 / Warning 0 | create_recipe/update_recipe RPC（原子的書込・household_id/created_by はDB側付与）追加。評価★/お気に入り/人数も対応。Suggestion15件はreview-notes。tsc/eslint PASS |
| D-1.5 | UX改善（共通ナビ/一覧トップ化・調理時間・タグ・材料&タグサジェスト） | ✅ | Critical 0 / Warning 2 | route group (app) 化+共通ナビ(PC左サイドバー/スマホ下部タブ)。cooking_time_minutes列追加。RPCに p_tags 追加(get-or-create+recipe_tags貼り直し)。datalistサジェスト。Warning2(検証ロジック重複/定数二重管理)はreview-notes。tsc/eslint PASS |
| E | 検索・絞り込み（食材名 / レシピ名 / 調理時間 / タグ） | ✅ | Critical 0 / Warning 1（解消済） | URLクエリ駆動のサーバ検索。search_recipes RPC（household明示絞り+ILIKEエスケープ+タグAND）新設。RecipeFilter追加。Warning1(error握り潰し)は修正済。tsc/eslint PASS |
| E+ | 検索まわり調整（評価/お気に入りUI削除・タグのタップ検索・絞り込み常時表示） | ✅ | 末尾でまとめてレビュー予定 | 評価/お気に入りはUIから撤去（DB列・RPC引数は温存）。タグチップtap→`?tag=`で同タグ一覧。絞り込みは折りたたみ廃止し常時表示。RPC変更なし。tsc/eslint PASS |
| UI | UI 刷新（デザインシステム導入で見栄え改善） | ⏳ | 別途実施 | 技術スタック変更は不要（Tailwind のまま shadcn/ui 等を追加）。検索の後に実施 |
| F | URL 取り込み | ⏳ | implement スキルで実施予定 | |
| G | （MVP後）AI チャットボット / AWS S3 差し替え | ⏳ | implement スキルで実施予定 | |
| D-2 | 写真アップロード（Supabase Storage） | ⏳ | implement スキルで実施予定 | AI チャットボットより**後ろ倒し**（2026-06-28 優先変更） |

## 直近の状態（2026-06-28 時点）

**完了したこと**
- C-1 認証基盤の手動テスト（サインアップ／ログイン）を実機確認。
- C-2 世帯オンボーディング: 2人運用のため**オンボーディングUIは作らない**判断。世帯テーブル・RLS・RPC（create_household / join_household_by_invite / gen_invite_code）は将来公開する場合に備えて温存。Daiki と配偶者の2アカウントを SQL editor で同一世帯（「我が家」）に手動紐づけ。profiles 2行が同一 household_id・households 1件を目視確認。

**（〜2026-06-27 時点）**
- git 初期化（main）、`.gitignore`、`CLAUDE.md`、`docs/`（要件定義・設計）作成。
- Next.js 16 / React 19 / TS / Tailwind 4 / App Router / `src/` 雛形。
- Supabase クライアント（client/server）、ストレージ抽象 IF、`.env.example`。
- Supabase 接続・CLI連携（login/link/init）完了。
- スキーマ+RLS+RPC マイグレーション（`20260627112348_init.sql`）を push 適用。型生成済み。
- RLS ハードニング（`20260627143536_harden_rls.sql`）で旧Warning4件を全解消。スモーク12/12 PASS。`tsc --noEmit` ✅。Critical 0 / Warning 0。

**次のアクション**
1. （Claude）D: レシピ CRUD + 写真アップロード。まずは手入力フォームでの作成/一覧/詳細/編集/削除から。

**残課題（任意・低優先）**
- B-2 ハードニング後の Suggestion 14件（コメント追記、recipe_tags の USING 対称化、将来の leave/switch世帯RPC 等）。`docs/review-notes.md`（git管理外）参照。本番運用上のブロッカーではない。

## レビュー運用メモ
- ステップ C 以降の実装は **implement スキル（設計→承認→implementer→reviewer）** で1機能ずつ進める。
- reviewer の Critical 0 件をマージ条件とする（Warning はブロッカーにしない）。
- 環境構築・自動生成された雛形はレビュー対象外（自動チェックで担保）。

## 意思決定ログ
| 日付 | 決定 | 理由 |
|---|---|---|
| 2026-06-27 | スタックは Next.js + Supabase + Vercel | 無料枠・開発速度・統合のしやすさ |
| 2026-06-27 | AWS は MVP 後に S3 を差し替え式で導入 | この規模では実利メリット小、学習目的に限定 |
| 2026-06-27 | AI プロバイダは後日決定（Gemini 無料枠が第一候補） | コストを抑えたい / まず AI 抜きで MVP |
| 2026-06-27 | データ共有は世帯（household）単位 + RLS | 各自ログイン・共同編集・セキュリティの両立 |
| 2026-06-27 | レシピ登録は手入力→写真→URL の順で段階実装 | URL 取り込みは難易度高、コアを先に固める |
| 2026-06-28 | 世帯オンボーディングUI（作成/招待コード/参加）は作らない | 当面2人運用で初期設定が過剰。代わりに2アカウントを手動で1世帯に紐づけ。テーブル/RLS/RPCは将来公開時に再利用するため温存 |
| 2026-06-28 | 優先順位変更: 検索(E)を最優先 → UI刷新 → … → 写真(D-2)は AI より後ろ倒し | 検索がコア価値。写真は優先度低と判断。UIの見栄えは早めに底上げしたい |
| 2026-06-28 | UI刷新は技術スタックを変えず Tailwind 上にデザインシステム(shadcn/ui 等)を載せる方針 | TS/Next/Tailwind のままで十分かっこよくできる。スタック変更コストは不要 |
| 2026-06-28 | 評価★・お気に入りは UI から削除（DB列とRPC引数は温存） | 「美味しかった/作ったレシピ」を残す用途では登録物がほぼ全部高評価・お気に入り相当で、項目・フィルタとして機能しないため |
| 2026-06-28 | タグ検索は「チップtap→同タグ一覧」+「タグ選択で絞り込み」。キーワード欄はタグ非対象 | 本人に確認のうえ決定。検索ボックスはレシピ名・食材名のみ。絞り込みは常時表示 |

## コミット履歴メモ（手動記録）
- d93902e chore: 初期コミット（環境整備・DB基盤・認証・世帯セットアップ）
- 0038a76 feat: レシピCRUD・共通ナビ・調理時間/タグ・検索を追加（D-1〜E+ をまとめて。push は未実施）
