"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { codePointLength, hasControlChar } from "@/lib/validation/text";

export type RecipeFormState = {
  error: string;
} | null;

// 入力長の上限（コードポイント単位）
const TITLE_MAX = 100;
const DESCRIPTION_MAX = 2000;
const SOURCE_URL_MAX = 2000;
const INGREDIENT_NAME_MAX = 100;
const INGREDIENT_QUANTITY_MAX = 100;
const STEP_BODY_MAX = 2000;
const TAG_NAME_MAX = 30;
const TAG_MAX_COUNT = 20;

// 調理時間（分）の許容範囲
const COOKING_TIME_MIN = 1;
const COOKING_TIME_MAX = 1440;

/** parseRecipeForm の整形済みデータ。RPC の jsonb 引数にそのまま渡せる形。 */
type ParsedRecipe = {
  recipe: {
    title: string;
    description: string | null;
    source_url: string | null;
    servings: number | null;
    cooking_time_minutes: number | null;
  };
  ingredients: { name: string; quantity: string | null }[];
  steps: { body: string }[];
  tags: string[];
};

type ParseRecipeFormResult =
  | { ok: true; data: ParsedRecipe }
  | { ok: false; error: string };

/**
 * 任意整数フィールドの検証。空文字は null、範囲外/非整数は不正とする。
 */
function parseOptionalInt(
  raw: string,
  min: number,
  max: number,
): { ok: true; value: number | null } | { ok: false } {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: true, value: null };
  }
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false };
  }
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < min || value > max) {
    return { ok: false };
  }
  return { ok: true, value };
}

/**
 * レシピフォームの入力検証を行うローカル純粋関数（I/O を持たない）。
 * 詳細フォームのためユーザー列挙リスクはなく、NG 時は具体的な文言を返す。
 */
function parseRecipeForm(formData: FormData): ParseRecipeFormResult {
  // title: 必須・最大長・制御文字（改行含む）不可
  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    return { ok: false, error: "タイトルを入力してください。" };
  }
  if (
    codePointLength(title) > TITLE_MAX ||
    hasControlChar(title, { allowNewlineTab: false })
  ) {
    return {
      ok: false,
      error: `タイトルは${TITLE_MAX}文字以内で入力してください。`,
    };
  }

  // description: 任意・最大長・改行/タブのみ許可
  const description = String(formData.get("description") ?? "");
  if (
    codePointLength(description) > DESCRIPTION_MAX ||
    hasControlChar(description, { allowNewlineTab: true })
  ) {
    return {
      ok: false,
      error: `説明は${DESCRIPTION_MAX}文字以内で入力してください。`,
    };
  }

  // source_url: 任意・最大長・http/https 形式のみ
  const sourceUrl = String(formData.get("source_url") ?? "").trim();
  if (sourceUrl !== "") {
    if (
      codePointLength(sourceUrl) > SOURCE_URL_MAX ||
      !/^https?:\/\/\S+$/.test(sourceUrl)
    ) {
      return {
        ok: false,
        error: "出典 URL は http(s):// から始まる形式で入力してください。",
      };
    }
  }

  // servings: 任意・整数・1〜99
  const servingsResult = parseOptionalInt(
    String(formData.get("servings") ?? ""),
    1,
    99,
  );
  if (!servingsResult.ok) {
    return { ok: false, error: "人数は 1〜99 の整数で入力してください。" };
  }

  // cooking_time_minutes: 任意・整数・1〜1440 分
  const cookingTimeResult = parseOptionalInt(
    String(formData.get("cooking_time_minutes") ?? ""),
    COOKING_TIME_MIN,
    COOKING_TIME_MAX,
  );
  if (!cookingTimeResult.ok) {
    return {
      ok: false,
      error: `調理時間は ${COOKING_TIME_MIN}〜${COOKING_TIME_MAX} 分で入力してください。`,
    };
  }

  // 材料: name と quantity を index 対応で読み取り、name 空行は除去
  const ingredientNames = formData
    .getAll("ingredient_name")
    .map((v) => String(v));
  const ingredientQuantities = formData
    .getAll("ingredient_quantity")
    .map((v) => String(v));

  const ingredients: ParsedRecipe["ingredients"] = [];
  for (let i = 0; i < ingredientNames.length; i++) {
    const name = ingredientNames[i].trim();
    if (name === "") {
      continue;
    }
    if (
      codePointLength(name) > INGREDIENT_NAME_MAX ||
      hasControlChar(name, { allowNewlineTab: false })
    ) {
      return {
        ok: false,
        error: `材料名は${INGREDIENT_NAME_MAX}文字以内で入力してください。`,
      };
    }
    const rawQuantity = (ingredientQuantities[i] ?? "").trim();
    if (
      codePointLength(rawQuantity) > INGREDIENT_QUANTITY_MAX ||
      hasControlChar(rawQuantity, { allowNewlineTab: false })
    ) {
      return {
        ok: false,
        error: `分量は${INGREDIENT_QUANTITY_MAX}文字以内で入力してください。`,
      };
    }
    ingredients.push({
      name,
      quantity: rawQuantity === "" ? null : rawQuantity,
    });
  }

  // 手順: body 空行は除去
  const stepBodies = formData.getAll("step_body").map((v) => String(v));
  const steps: ParsedRecipe["steps"] = [];
  for (const raw of stepBodies) {
    const body = raw.trim();
    if (body === "") {
      continue;
    }
    if (
      codePointLength(body) > STEP_BODY_MAX ||
      hasControlChar(body, { allowNewlineTab: true })
    ) {
      return {
        ok: false,
        error: `手順は${STEP_BODY_MAX}文字以内で入力してください。`,
      };
    }
    steps.push({ body });
  }

  // タグ: 空除去 → 各タグの長さ/制御文字検証 → 重複除去 → 件数上限
  const tags: string[] = [];
  const seenTags = new Set<string>();
  for (const raw of formData.getAll("tag").map((v) => String(v))) {
    const name = raw.trim();
    if (name === "") {
      continue;
    }
    if (
      codePointLength(name) > TAG_NAME_MAX ||
      hasControlChar(name, { allowNewlineTab: false })
    ) {
      return {
        ok: false,
        error: `タグは${TAG_NAME_MAX}文字以内で入力してください。`,
      };
    }
    if (seenTags.has(name)) {
      continue;
    }
    seenTags.add(name);
    tags.push(name);
  }
  if (tags.length > TAG_MAX_COUNT) {
    return {
      ok: false,
      error: `タグは${TAG_MAX_COUNT}個以内で登録してください。`,
    };
  }

  return {
    ok: true,
    data: {
      recipe: {
        title,
        description: description.trim() === "" ? null : description,
        source_url: sourceUrl === "" ? null : sourceUrl,
        servings: servingsResult.value,
        cooking_time_minutes: cookingTimeResult.value,
      },
      ingredients,
      steps,
      tags,
    },
  };
}

/**
 * レシピを新規作成する Server Action。
 * 成功時は詳細ページへ redirect する。
 */
export async function createRecipe(
  _prevState: RecipeFormState,
  formData: FormData,
): Promise<RecipeFormState> {
  const parsed = parseRecipeForm(formData);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_recipe", {
    p_recipe: parsed.data.recipe,
    p_ingredients: parsed.data.ingredients,
    p_steps: parsed.data.steps,
    p_tags: parsed.data.tags,
  });

  if (error) {
    // 詳細はサーバログのみに記録し、ユーザーには汎用文言を返す。
    console.error("[createRecipe]", error);
    return { error: "レシピの保存に失敗しました。時間をおいて再度お試しください。" };
  }

  revalidatePath("/recipes");
  // redirect は内部で例外を投げるため try/catch の外で呼ぶ。
  redirect(`/recipes/${data}`);
}

/**
 * 既存レシピを更新する Server Action。
 * 成功時は詳細ページへ redirect する。
 */
export async function updateRecipe(
  _prevState: RecipeFormState,
  formData: FormData,
): Promise<RecipeFormState> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return { error: "レシピの保存に失敗しました。時間をおいて再度お試しください。" };
  }

  const parsed = parseRecipeForm(formData);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_recipe", {
    p_id: id,
    p_recipe: parsed.data.recipe,
    p_ingredients: parsed.data.ingredients,
    p_steps: parsed.data.steps,
    p_tags: parsed.data.tags,
  });

  if (error) {
    console.error("[updateRecipe]", error);
    return { error: "レシピの保存に失敗しました。時間をおいて再度お試しください。" };
  }

  revalidatePath("/recipes");
  revalidatePath(`/recipes/${id}`);
  redirect(`/recipes/${id}`);
}

/**
 * レシピを削除する Server Action。
 * RLS により自世帯のレシピのみ削除でき、子テーブルは cascade で消える。
 */
export async function deleteRecipe(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("recipes").delete().eq("id", id);

  if (error) {
    console.error("[deleteRecipe]", error);
    return;
  }

  revalidatePath("/recipes");
  redirect("/recipes");
}
