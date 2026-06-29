"use server";

import { createClient } from "@/lib/supabase/server";
import { runImport } from "@/lib/recipe-import";
import { isSafeImageUrl } from "@/lib/recipe-import/ip-guard";
import {
  clampText,
  compactIngredients,
  compactSteps,
  compactTags,
  LIMITS,
} from "@/lib/recipe-import/parsers";
import type { ImportedRecipe, ImportResult } from "@/lib/recipe-import/types";
import type { RecipeFormValues } from "@/components/recipes/RecipeForm";

/** 任意整数を許容範囲でクランプした文字列にする。空/範囲外は空文字。 */
function clampNumberField(
  value: number | undefined,
  min: number,
  max: number,
): string {
  if (value === undefined || !Number.isInteger(value) || value < min || value > max) {
    return "";
  }
  return String(value);
}

/** ImportedRecipe を RecipeForm の初期値へ正規化する（DB 保存はしない）。 */
function toFormValues(imported: ImportedRecipe, sourceUrl: string): RecipeFormValues {
  const ingredients = compactIngredients(imported.ingredients);
  const steps = compactSteps(imported.steps);
  const tags = compactTags(imported.tags ?? []);

  return {
    title: imported.title ? clampText(imported.title, LIMITS.TITLE) : "",
    description: imported.description
      ? clampText(imported.description, LIMITS.DESCRIPTION)
      : "",
    source_url: clampText(sourceUrl, LIMITS.SOURCE_URL),
    servings: clampNumberField(imported.servings, 1, 99),
    cooking_time_minutes: clampNumberField(imported.cookingTimeMinutes, 1, 1440),
    ingredients:
      ingredients.length > 0 ? ingredients : [{ name: "", quantity: "" }],
    steps: steps.length > 0 ? steps : [{ body: "" }],
    tags: tags.length > 0 ? tags : [""],
  };
}

/**
 * URL からレシピ情報を取得し、フォームのプリフィル値を返す Server Action。
 * 認証必須。取得・解析の生エラーはサーバログのみに残し、ユーザーには汎用文言を返す。
 */
export async function importRecipeFromUrl(rawUrl: string): Promise<ImportResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "ログインが必要です。" };
  }

  // 任意 URL の取得は認証済みの世帯メンバーに限定する（docs/integrations.md）。
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("household_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile?.household_id) {
    console.error("[importRecipeFromUrl] profile", profileError);
    return {
      ok: false,
      error: "ページを取得できませんでした。URL を確認してください。",
    };
  }

  const url = rawUrl.trim();
  if (
    url === "" ||
    url.length > LIMITS.SOURCE_URL ||
    !/^https?:\/\/\S+$/.test(url)
  ) {
    return {
      ok: false,
      error: "http(s):// から始まる URL を入力してください。",
    };
  }

  let imported: ImportedRecipe;
  try {
    imported = await runImport(url);
  } catch (error) {
    console.error("[importRecipeFromUrl]", error);
    return {
      ok: false,
      error: "ページを取得できませんでした。URL を確認してください。",
    };
  }

  const data = toFormValues(imported, url);

  const hasIngredients = data.ingredients.some((i) => i.name !== "");
  const hasSteps = data.steps.some((s) => s.body !== "");
  const hasAny =
    data.title !== "" || data.description !== "" || hasIngredients || hasSteps;

  if (!hasAny) {
    return {
      ok: false,
      error:
        "レシピ情報を読み取れませんでした。お手数ですが手入力で作成してください。",
    };
  }

  const warning =
    !hasIngredients || !hasSteps
      ? "材料・手順を自動抽出できなかった項目があります。内容を確認・修正してください。"
      : undefined;

  // 外部 HTML 由来の画像 URL は安全なもののみクライアントへ返す（SSRF / トラッキング抑止）。
  const imageUrl = isSafeImageUrl(imported.imageUrl)
    ? imported.imageUrl
    : undefined;

  return { ok: true, data, imageUrl, warning };
}
