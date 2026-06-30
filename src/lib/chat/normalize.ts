/**
 * AI チャットの入出力を整形する純粋関数群（I/O を一切持たない）。
 * - LLM へ渡す自世帯レシピの圧縮（buildRecipeContext）
 * - LLM が返した未検証 JSON の正規化・検証（parseAssistantReply / normalizeDraft）
 * URL 取り込み（import-actions / parsers）の作法に揃え、clampText / LIMITS でクランプする。
 */

import type { RecipeFormValues } from "@/components/recipes/RecipeForm";
import {
  clampText,
  compactIngredients,
  compactSteps,
  LIMITS,
} from "@/lib/recipe-import/parsers";
import type {
  AssistantReply,
  ChatMode,
  ChatRecipeContext,
  RecipeSuggestion,
} from "@/lib/chat/types";

/** LLM コンテキストに載せるレシピ件数・材料件数の上限。プロンプト肥大を防ぐ。 */
export const CONTEXT_LIMITS = {
  RECIPES: 80,
  INGREDIENTS_PER_RECIPE: 6,
} as const;

/** 提案件数の上限と理由文の最大長。 */
const MAX_SUGGESTIONS = 6;
const REASON_MAX = 300;
const MESSAGE_MAX = 2000;

type RecipeListRow = {
  id: string;
  title: string;
  tags: string[];
  cooking_time_minutes: number | null;
};

type IngredientRow = {
  recipe_id: string;
  name: string;
};

/**
 * 自世帯レシピ一覧と材料行から、LLM へ渡す最小コンテキストを組み立てる。
 * 材料は recipe_id で紐付け、各レシピ先頭数件・全体件数を上限で打ち切る。
 */
export function buildRecipeContext(
  recipes: RecipeListRow[],
  ingredients: IngredientRow[],
): ChatRecipeContext[] {
  const byRecipe = new Map<string, string[]>();
  for (const row of ingredients) {
    const name = clampText(row.name.trim(), LIMITS.INGREDIENT_NAME);
    if (name === "") {
      continue;
    }
    const list = byRecipe.get(row.recipe_id) ?? [];
    if (list.length >= CONTEXT_LIMITS.INGREDIENTS_PER_RECIPE) {
      continue;
    }
    list.push(name);
    byRecipe.set(row.recipe_id, list);
  }

  return recipes.slice(0, CONTEXT_LIMITS.RECIPES).map((recipe) => ({
    id: recipe.id,
    title: clampText(recipe.title, LIMITS.TITLE),
    tags: recipe.tags.slice(0, LIMITS.TAG_COUNT),
    cookingTimeMinutes: recipe.cooking_time_minutes,
    ingredients: byRecipe.get(recipe.id) ?? [],
  }));
}

/** unknown を安全にレコードとして扱う。 */
function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** 任意の数値文字列を許容範囲でクランプした文字列にする。空/範囲外は空文字。 */
function clampNumberField(raw: unknown, min: number, max: number): string {
  const text = asString(raw).trim();
  if (!/^\d+$/.test(text)) {
    return "";
  }
  const value = Number(text);
  if (!Number.isInteger(value) || value < min || value > max) {
    return "";
  }
  return String(value);
}

/**
 * LLM の new ドラフトを RecipeForm の初期値へ正規化する（DB 保存はしない）。
 * import-actions.toFormValues に倣い、未抽出項目は空 1 行にする。
 * source_url は AI の捏造を信用せず常に空にする。
 * タグはユーザーが手動で付ける運用のため、AI が生成しても取り込まず常に空 1 行にする
 * （URL 取り込みと同方針）。
 */
export function normalizeDraft(raw: unknown): RecipeFormValues {
  const draft = asRecord(raw);

  const rawIngredients = Array.isArray(draft.ingredients)
    ? draft.ingredients
    : [];
  const ingredients = compactIngredients(
    rawIngredients.map((item) => {
      const rec = asRecord(item);
      return { name: asString(rec.name), quantity: asString(rec.quantity) };
    }),
  );

  const rawSteps = Array.isArray(draft.steps) ? draft.steps : [];
  const steps = compactSteps(
    rawSteps.map((item) => ({ body: asString(asRecord(item).body) })),
  );

  return {
    title: clampText(asString(draft.title), LIMITS.TITLE),
    description: clampText(asString(draft.description), LIMITS.DESCRIPTION),
    // メモは AI ドラフトから反映しない（常に空）。
    note: "",
    source_url: "",
    servings: clampNumberField(draft.servings, 1, 99),
    cooking_time_minutes: clampNumberField(draft.cooking_time_minutes, 1, 1440),
    // AI ドラフトは未調理扱い（常に false）。
    is_cooked: false,
    ingredients:
      ingredients.length > 0 ? ingredients : [{ name: "", quantity: "" }],
    steps: steps.length > 0 ? steps : [{ body: "" }],
    // タグは取り込まない（手動運用）。
    tags: [""],
  };
}

/** 1 件の提案を検証・正規化する。通らなければ null。 */
function parseSuggestion(
  raw: unknown,
  mode: ChatMode,
  recipeTitleById: Map<string, string>,
): RecipeSuggestion | null {
  const item = asRecord(raw);
  const reason = clampText(asString(item.reason), REASON_MAX);

  if (mode === "existing") {
    if (item.type !== "existing") {
      return null;
    }
    const recipeId = asString(item.recipeId);
    const canonicalTitle = recipeTitleById.get(recipeId);
    // LLM が捏造した ID は除外し、タイトルは DB の正規値を採用する。
    if (canonicalTitle === undefined) {
      return null;
    }
    return { type: "existing", recipeId, title: canonicalTitle, reason };
  }

  if (item.type !== "new") {
    return null;
  }
  const draft = normalizeDraft(item.draft);
  // タイトルが取れないドラフトは登録導線として無意味なので捨てる。
  if (draft.title === "") {
    return null;
  }
  return { type: "new", reason, draft };
}

/**
 * LLM が返した未検証 JSON を AssistantReply へ正規化・検証する。
 * モードに合致しない提案・捏造 recipeId は除外し、件数を上限で打ち切る。
 */
export function parseAssistantReply(
  raw: unknown,
  mode: ChatMode,
  recipeTitleById: Map<string, string>,
): AssistantReply {
  const root = asRecord(raw);
  const message = clampText(asString(root.message), MESSAGE_MAX);
  const rawSuggestions = Array.isArray(root.suggestions)
    ? root.suggestions
    : [];

  const suggestions: RecipeSuggestion[] = [];
  for (const candidate of rawSuggestions) {
    const parsed = parseSuggestion(candidate, mode, recipeTitleById);
    if (parsed) {
      suggestions.push(parsed);
    }
    if (suggestions.length >= MAX_SUGGESTIONS) {
      break;
    }
  }

  return { message, suggestions };
}
