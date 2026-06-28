/**
 * 画像ストレージの抽象インターフェース。
 *
 * 当面は Supabase Storage 実装を使うが、MVP 後に AWS S3 実装へ
 * 差し替えられるよう、利用側は必ずこのインターフェース越しに使う。
 * （docs/architecture.md「6. ストレージ抽象」参照）
 */
export interface ImageStorage {
  /** ファイルを保存し、保存先パスを返す */
  upload(file: File, path: string): Promise<{ path: string }>;
  /** 表示用 URL を取得する */
  getUrl(path: string): Promise<string>;
  /** ファイルを削除する */
  remove(path: string): Promise<void>;
}

// Supabase Storage 実装は接続後（ステップ D）に追加する:
//   src/lib/storage.supabase.ts に SupabaseImageStorage を実装し、
//   ここから export default するか、ファクトリ関数で返す。
