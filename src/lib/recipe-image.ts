/**
 * レシピ写真（メイン1枚）のアップロード検証ユーティリティ。
 *
 * I/O を持たない純粋関数のみを置く（Storage アクセスは storage.supabase.ts）。
 * youtube-url.ts と同方針で、ここだけを単体テストする。
 */

/** 許可する画像 mime とその拡張子。private バケットへの保存パスに使う。 */
export const ALLOWED_IMAGE_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type AllowedImageMime = keyof typeof ALLOWED_IMAGE_MIME;

/** アップロードサイズ上限（クライアント圧縮後を想定した安全弁）。 */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** 検証に必要な File の最小形。テスト容易性のため File そのものに依存しない。 */
export type ImageFileLike = {
  type: string;
  size: number;
};

export type ImageValidationResult =
  | { ok: true; mime: AllowedImageMime; ext: string }
  | { ok: false; reason: "empty" | "unsupported_type" | "too_large" };

/** mime が許可リストに含まれるか（型ガード）。 */
export function isAllowedImageMime(type: string): type is AllowedImageMime {
  return Object.prototype.hasOwnProperty.call(ALLOWED_IMAGE_MIME, type);
}

/**
 * アップロード File を検証し、許可時は保存用の拡張子を導出する。
 * 空 File（size 0）は「画像なし」と区別するため empty を返す。
 */
export function validateImageFile(file: ImageFileLike): ImageValidationResult {
  if (file.size <= 0) {
    return { ok: false, reason: "empty" };
  }
  if (!isAllowedImageMime(file.type)) {
    return { ok: false, reason: "unsupported_type" };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, reason: "too_large" };
  }
  return { ok: true, mime: file.type, ext: ALLOWED_IMAGE_MIME[file.type] };
}
