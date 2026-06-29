"use client";

import { useState, useTransition } from "react";
import type { RecipeFormState } from "@/app/(app)/recipes/actions";
import { importRecipeFromUrl } from "@/app/(app)/recipes/import-actions";
import { RecipeForm, type RecipeFormValues } from "@/components/recipes/RecipeForm";
import { inputClass, labelClass, primaryButtonClass } from "@/lib/ui";

type NewRecipeWorkspaceProps = {
  action: (
    state: RecipeFormState,
    formData: FormData,
  ) => Promise<RecipeFormState>;
  ingredientSuggestions?: string[];
  tagSuggestions?: string[];
};

type Message = { tone: "error" | "info"; text: string };

/**
 * 新規作成画面のラッパー。上部の「URL から取り込み」バーで取得した値を
 * RecipeForm のプリフィルへ流し込む。取り込み成功時は key を変えて再マウントする。
 * DB 保存は RecipeForm の「作成する」操作で行う（取り込み自体は保存しない）。
 */
export function NewRecipeWorkspace({
  action,
  ingredientSuggestions = [],
  tagSuggestions = [],
}: NewRecipeWorkspaceProps) {
  const [values, setValues] = useState<RecipeFormValues | undefined>(undefined);
  const [importSeq, setImportSeq] = useState(0);
  const [url, setUrl] = useState("");
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [message, setMessage] = useState<Message | null>(null);
  const [pending, startTransition] = useTransition();

  const handleImport = () => {
    setMessage(null);
    // 開始時に前回の画像候補をクリアし、失敗時に古い画像が残らないようにする。
    setImageUrl(undefined);
    startTransition(async () => {
      const result = await importRecipeFromUrl(url);
      if (!result.ok) {
        setMessage({ tone: "error", text: result.error });
        return;
      }
      setValues(result.data);
      setImageUrl(result.imageUrl);
      setImportSeq((n) => n + 1);
      setMessage({
        tone: "info",
        text:
          result.warning ??
          "取り込みました。内容を確認して「作成する」で保存してください。",
      });
    });
  };

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2 rounded-xl border-2 border-line bg-cream-2 p-4">
        <label htmlFor="import-url" className={labelClass}>
          URL から取り込み
        </label>
        <div className="flex gap-2">
          <input
            id="import-url"
            type="url"
            inputMode="url"
            placeholder="https://..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className={`${inputClass} w-0 min-w-0 grow`}
          />
          <button
            type="button"
            onClick={handleImport}
            disabled={pending || url.trim() === ""}
            className={primaryButtonClass}
          >
            {pending ? "取り込み中..." : "取り込む"}
          </button>
        </div>
        <p className="text-xs text-ink-soft">
          レシピサイトや YouTube の URL を入力すると、内容を自動で読み取って下のフォームに反映します。
        </p>
        {message && (
          <p
            className={
              message.tone === "error"
                ? "text-sm font-bold text-tomato"
                : "text-sm text-ink-soft"
            }
            role={message.tone === "error" ? "alert" : undefined}
          >
            {message.text}
          </p>
        )}
        {imageUrl && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-ink-soft">画像候補</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="取り込んだレシピの画像候補"
              referrerPolicy="no-referrer"
              loading="lazy"
              className="max-h-48 w-auto rounded-lg border-2 border-line object-contain"
            />
          </div>
        )}
      </section>

      <RecipeForm
        key={importSeq}
        action={action}
        defaultValues={values}
        ingredientSuggestions={ingredientSuggestions}
        tagSuggestions={tagSuggestions}
      />
    </div>
  );
}
