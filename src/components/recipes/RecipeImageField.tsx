"use client";

import { useEffect, useRef, useState } from "react";
import { labelClass } from "@/lib/ui";

type RecipeImageFieldProps = {
  /** 編集時に既存画像の署名 URL を渡す。未指定なら画像なし。 */
  defaultImageUrl?: string;
};

// 圧縮設定。無料枠節約 + Server Actions のボディ上限回避が目的。
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.8;

/**
 * 選択画像を canvas で長辺 MAX_EDGE まで縮小し JPEG 再エンコードする。
 * 失敗時（デコード不可など）は null を返し、呼び出し側で原本にフォールバックする。
 */
async function compressImage(file: File): Promise<File | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return null;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", JPEG_QUALITY);
    });
    if (!blob) {
      return null;
    }
    return new File([blob], "recipe.jpg", { type: "image/jpeg" });
  } catch {
    return null;
  }
}

/**
 * レシピのメイン写真フィールド。
 * - 端末ライブラリ / カメラの両方から選べる（accept=image/*・capture なし）。
 * - 選択時に canvas 圧縮し、隠し input の files を差し替えて送信する。
 * - 編集時は既存画像を表示し、「画像を削除」で hidden remove_image=1 を送る。
 */
export function RecipeImageField({ defaultImageUrl }: RecipeImageFieldProps) {
  // 実送信用の隠し input（name="image"）。圧縮後 File を DataTransfer で流し込む。
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeExisting, setRemoveExisting] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  // 生成した objectURL は破棄してリークを防ぐ。
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  function setObjectUrl(file: File) {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setPreviewUrl(url);
  }

  async function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    const compressed = (await compressImage(file)) ?? file;

    // input.files を圧縮後 File へ差し替える（送信されるのは圧縮後）。
    if (fileInputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(compressed);
      fileInputRef.current.files = dt.files;
    }

    setObjectUrl(compressed);
    // 新しい画像を選んだら削除指定は解除する。
    setRemoveExisting(false);
  }

  function handleRemoveToggle(e: React.ChangeEvent<HTMLInputElement>) {
    const checked = e.target.checked;
    setRemoveExisting(checked);
    if (checked) {
      // 削除指定時は選択済みファイルもクリアする。
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      setPreviewUrl(null);
    }
  }

  // 表示する画像: 新規選択 > 既存（削除指定がなければ）。
  const shownUrl =
    previewUrl ?? (removeExisting ? null : (defaultImageUrl ?? null));

  return (
    <div className="flex flex-col gap-2">
      <span className={labelClass}>写真</span>

      {shownUrl && (
        // private 画像のため next/image ではなく素の img を使う。
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={shownUrl}
          alt="レシピ写真のプレビュー"
          className="aspect-square w-40 rounded-lg border-2 border-line object-cover"
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        name="image"
        accept="image/*"
        onChange={handleSelect}
        className="text-sm text-ink-soft file:mr-3 file:rounded-lg file:border-2 file:border-line file:bg-cream-2 file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-ink-soft"
      />

      {defaultImageUrl && (
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={removeExisting}
            onChange={handleRemoveToggle}
          />
          画像を削除
        </label>
      )}
      {removeExisting && <input type="hidden" name="remove_image" value="1" />}
    </div>
  );
}
