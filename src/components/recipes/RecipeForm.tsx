"use client";

import { useActionState, useState } from "react";
import type { RecipeFormState } from "@/app/(app)/recipes/actions";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
  subButtonClass,
} from "@/lib/ui";

/** 作成/編集フォームの初期値。編集時に既存レシピから組み立てて渡す。 */
export type RecipeFormValues = {
  title: string;
  description: string;
  source_url: string;
  servings: string;
  cooking_time_minutes: string;
  ingredients: { name: string; quantity: string }[];
  steps: { body: string }[];
  tags: string[];
};

type RecipeFormProps = {
  action: (
    state: RecipeFormState,
    formData: FormData,
  ) => Promise<RecipeFormState>;
  defaultValues?: RecipeFormValues;
  recipeId?: string;
  ingredientSuggestions?: string[];
  tagSuggestions?: string[];
};

const inputClassName = inputClass;

const subButtonClassName = subButtonClass;

export function RecipeForm({
  action,
  defaultValues,
  recipeId,
  ingredientSuggestions = [],
  tagSuggestions = [],
}: RecipeFormProps) {
  const [state, formAction, pending] = useActionState<
    RecipeFormState,
    FormData
  >(action, null);

  const [ingredients, setIngredients] = useState<
    { name: string; quantity: string }[]
  >(
    defaultValues?.ingredients && defaultValues.ingredients.length > 0
      ? defaultValues.ingredients
      : [{ name: "", quantity: "" }],
  );
  const [steps, setSteps] = useState<{ body: string }[]>(
    defaultValues?.steps && defaultValues.steps.length > 0
      ? defaultValues.steps
      : [{ body: "" }],
  );
  const [tags, setTags] = useState<string[]>(
    defaultValues?.tags && defaultValues.tags.length > 0
      ? defaultValues.tags
      : [""],
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {recipeId && <input type="hidden" name="id" value={recipeId} />}

      {/* タイトル */}
      <div className="flex flex-col gap-1">
        <label htmlFor="title" className={labelClass}>
          タイトル
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={100}
          defaultValue={defaultValues?.title ?? ""}
          className={inputClassName}
        />
      </div>

      {/* 説明 */}
      <div className="flex flex-col gap-1">
        <label htmlFor="description" className={labelClass}>
          説明
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={2000}
          defaultValue={defaultValues?.description ?? ""}
          className={inputClassName}
        />
      </div>

      {/* 出典 URL */}
      <div className="flex flex-col gap-1">
        <label htmlFor="source_url" className={labelClass}>
          出典 URL
        </label>
        <input
          id="source_url"
          name="source_url"
          type="url"
          maxLength={2000}
          defaultValue={defaultValues?.source_url ?? ""}
          className={inputClassName}
        />
      </div>

      {/* 人数 / 調理時間 */}
      <div className="flex flex-wrap gap-6">
        <div className="flex flex-col gap-1">
          <label htmlFor="servings" className={labelClass}>
            人数
          </label>
          <input
            id="servings"
            name="servings"
            type="number"
            min={1}
            max={99}
            defaultValue={defaultValues?.servings ?? ""}
            className={`${inputClassName} w-24`}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="cooking_time_minutes" className={labelClass}>
            調理時間(分)
          </label>
          <input
            id="cooking_time_minutes"
            name="cooking_time_minutes"
            type="number"
            min={1}
            max={1440}
            defaultValue={defaultValues?.cooking_time_minutes ?? ""}
            className={`${inputClassName} w-24`}
          />
        </div>
      </div>

      {/* 材料 */}
      <fieldset className="flex flex-col gap-2">
        <legend className={labelClass}>材料</legend>
        {ingredients.map((ingredient, index) => (
          <div key={index} className="flex items-start gap-2">
            <input
              name="ingredient_name"
              type="text"
              placeholder="材料名"
              list="ingredient-suggestions"
              maxLength={100}
              value={ingredient.name}
              onChange={(e) =>
                setIngredients((prev) =>
                  prev.map((item, i) =>
                    i === index ? { ...item, name: e.target.value } : item,
                  ),
                )
              }
              className={`${inputClassName} w-0 min-w-0 grow-[2]`}
            />
            <input
              name="ingredient_quantity"
              type="text"
              placeholder="分量"
              maxLength={100}
              value={ingredient.quantity}
              onChange={(e) =>
                setIngredients((prev) =>
                  prev.map((item, i) =>
                    i === index ? { ...item, quantity: e.target.value } : item,
                  ),
                )
              }
              className={`${inputClassName} w-0 min-w-0 grow`}
            />
            <button
              type="button"
              onClick={() =>
                setIngredients((prev) =>
                  prev.length > 1
                    ? prev.filter((_, i) => i !== index)
                    : [{ name: "", quantity: "" }],
                )
              }
              className={subButtonClassName}
              aria-label="材料を削除"
            >
              削除
            </button>
          </div>
        ))}
        <div>
          <button
            type="button"
            onClick={() =>
              setIngredients((prev) => [...prev, { name: "", quantity: "" }])
            }
            className={subButtonClassName}
          >
            材料を追加
          </button>
        </div>
      </fieldset>

      <datalist id="ingredient-suggestions">
        {ingredientSuggestions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {/* 手順 */}
      <fieldset className="flex flex-col gap-2">
        <legend className={labelClass}>手順</legend>
        {steps.map((step, index) => (
          <div key={index} className="flex gap-2">
            <span className="pt-2 text-sm font-bold text-ink-soft">
              {index + 1}.
            </span>
            <textarea
              name="step_body"
              rows={2}
              placeholder="手順"
              maxLength={2000}
              value={step.body}
              onChange={(e) =>
                setSteps((prev) =>
                  prev.map((item, i) =>
                    i === index ? { body: e.target.value } : item,
                  ),
                )
              }
              className={`${inputClassName} w-0 min-w-0 grow`}
            />
            <button
              type="button"
              onClick={() =>
                setSteps((prev) =>
                  prev.length > 1
                    ? prev.filter((_, i) => i !== index)
                    : [{ body: "" }],
                )
              }
              className={subButtonClassName}
              aria-label="手順を削除"
            >
              削除
            </button>
          </div>
        ))}
        <div>
          <button
            type="button"
            onClick={() => setSteps((prev) => [...prev, { body: "" }])}
            className={subButtonClassName}
          >
            手順を追加
          </button>
        </div>
      </fieldset>

      {/* タグ */}
      <fieldset className="flex flex-col gap-2">
        <legend className={labelClass}>タグ</legend>
        {tags.map((tag, index) => (
          <div key={index} className="flex gap-2">
            <input
              name="tag"
              type="text"
              placeholder="タグ"
              list="tag-suggestions"
              maxLength={30}
              value={tag}
              onChange={(e) =>
                setTags((prev) =>
                  prev.map((item, i) => (i === index ? e.target.value : item)),
                )
              }
              className={`${inputClassName} w-0 min-w-0 grow`}
            />
            <button
              type="button"
              onClick={() =>
                setTags((prev) =>
                  prev.length > 1 ? prev.filter((_, i) => i !== index) : [""],
                )
              }
              className={subButtonClassName}
              aria-label="タグを削除"
            >
              削除
            </button>
          </div>
        ))}
        <div>
          <button
            type="button"
            onClick={() => setTags((prev) => [...prev, ""])}
            className={subButtonClassName}
          >
            タグを追加
          </button>
        </div>
      </fieldset>

      <datalist id="tag-suggestions">
        {tagSuggestions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {state?.error && (
        <p className="text-sm font-bold text-tomato" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "保存中..." : recipeId ? "更新する" : "作成する"}
      </button>
    </form>
  );
}
