import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ImageStorage } from "@/lib/storage";

/** 署名 URL の有効期限（秒）。表示のたびに生成し直す前提の短めの値。 */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

type ServerSupabaseClient = SupabaseClient<Database>;

/**
 * ImageStorage の Supabase Storage 実装。
 * private バケットを前提とし、表示用 URL は署名 URL を返す。
 * 利用側は ImageStorage 越しに使い、将来 S3 実装へ差し替え可能にする
 * （docs/architecture.md「ストレージ抽象」参照）。
 */
export class SupabaseImageStorage implements ImageStorage {
  constructor(
    private readonly supabase: ServerSupabaseClient,
    private readonly bucket: string,
  ) {}

  async upload(file: File, path: string): Promise<{ path: string }> {
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      throw error;
    }
    return { path: data.path };
  }

  async getUrl(path: string): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error) {
      throw error;
    }
    return data.signedUrl;
  }

  /**
   * 複数パスの署名 URL を一括取得する（一覧のサムネ用、N+1 回避）。
   * 個別に失敗したパスは null を返す（Storage の仕様に従う）。
   */
  async getUrls(paths: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (paths.length === 0) {
      return result;
    }
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
    if (error) {
      throw error;
    }
    for (const entry of data) {
      if (entry.signedUrl && entry.path) {
        result.set(entry.path, entry.signedUrl);
      }
    }
    return result;
  }

  async remove(path: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(this.bucket)
      .remove([path]);
    if (error) {
      throw error;
    }
  }
}

/** recipe-images バケット用の ImageStorage を生成するファクトリ。 */
export function createRecipeImageStorage(
  supabase: ServerSupabaseClient,
): SupabaseImageStorage {
  return new SupabaseImageStorage(supabase, "recipe-images");
}
