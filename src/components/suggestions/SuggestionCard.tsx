"use client";

import { useRouter } from "next/navigation";
import type { RecipeFormValues } from "@/components/recipes/RecipeForm";
import { saveAiRecipeDraft } from "@/lib/chat/draft-storage";
import { cardClass, dangerButtonClass, subButtonClass } from "@/lib/ui";

type SuggestionCardProps = {
  id: string;
  draft: RecipeFormValues;
  sourcePrompt: string | null;
  /** 削除用 Server Action。フォーム送信で呼ぶ（RLS スコープ）。 */
  deleteAction: (formData: FormData) => void | Promise<void>;
};

/**
 * 保存済み AI 提案の 1 カード。チャットの new 提案カードと同等の見せ方で、
 * 「レシピにする」（sessionStorage 経由で /recipes/new へプリフィル）と
 * 「削除」（Server Action）の 2 アクションを持つ。
 */
export function SuggestionCard({
  id,
  draft,
  sourcePrompt,
  deleteAction,
}: SuggestionCardProps) {
  const router = useRouter();

  const ingredients = draft.ingredients.filter((i) => i.name !== "");
  const steps = draft.steps.map((s) => s.body).filter((body) => body !== "");

  const handleAdopt = () => {
    // 採用後に元の提案を消すため、ドラフトと一緒に提案 id も受け渡す。
    saveAiRecipeDraft(draft, id);
    router.push("/recipes/new");
  };

  return (
    <div className={`${cardClass} flex flex-col gap-3 px-4 py-3`}>
      <span className="font-round font-bold text-ink">{draft.title}</span>
      {sourcePrompt !== null && sourcePrompt !== "" && (
        <span className="text-sm text-ink-soft">リクエスト: {sourcePrompt}</span>
      )}
      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
        {draft.cooking_time_minutes !== "" && (
          <div className="flex gap-1">
            <dt className="font-bold">調理時間</dt>
            <dd>{draft.cooking_time_minutes}分</dd>
          </div>
        )}
        {draft.servings !== "" && (
          <div className="flex gap-1">
            <dt className="font-bold">人数</dt>
            <dd>{draft.servings}人分</dd>
          </div>
        )}
      </dl>

      {ingredients.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold text-ink">材料</span>
          <ul className="flex flex-col text-sm text-ink">
            {ingredients.map((ing, i) => (
              <li
                key={i}
                className="flex justify-between gap-3 border-b border-dashed border-line/60 py-1"
              >
                <span>{ing.name}</span>
                {ing.quantity !== "" && (
                  <span className="shrink-0 text-ink-soft">{ing.quantity}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {steps.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold text-ink">作り方</span>
          <ol className="flex flex-col gap-1.5 text-sm text-ink">
            {steps.map((body, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-round font-bold text-tomato">{i + 1}.</span>
                <span className="whitespace-pre-wrap">{body}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={handleAdopt} className={subButtonClass}>
          レシピにする
        </button>
        <form action={deleteAction}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className={dangerButtonClass}>
            削除
          </button>
        </form>
      </div>
    </div>
  );
}
