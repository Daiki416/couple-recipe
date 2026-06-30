/**
 * Instagram の og:description（キャプション）を整形・正規化する純粋関数群（I/O なし）。
 * 社交プレフィックスやハッシュタグを取り除き、AI 抽出結果を中立フィールドへ正規化する。
 */
import {
  clampText,
  compactIngredients,
  compactSteps,
  LIMITS,
  parseServings,
} from "./parsers";

/** 「{N} likes, {M} comments - {username} on {date}:」形式の社交プレフィックス。 */
const SOCIAL_PREFIX =
  /^[\d,]+ likes?, [\d,]+ comments? - .+? on .+?:\s*/i;

/**
 * og:description から本文キャプションを取り出す。
 * 先頭の社交プレフィックスを除去し、続けて前後を 1 組だけ囲む `"…"` をアンラップする。
 * いずれにもマッチしなければ堅牢性優先で元の文字列をそのまま返す。
 */
export function extractInstagramCaption(ogDescription: string): string {
  const withoutPrefix = ogDescription.replace(SOCIAL_PREFIX, "");
  const quoted = withoutPrefix.match(/^"([\s\S]*)"$/);
  if (quoted) {
    return quoted[1];
  }
  return withoutPrefix === ogDescription ? ogDescription : withoutPrefix;
}

/** 末尾に連続するハッシュタグ群（本文中のものは触らない）。 */
const TRAILING_HASHTAGS = /(?:\s*[#＃][^\s#＃]+)+\s*$/;

/**
 * キャプションを軽く整える。
 * 残存する社交プレフィックスを除去し、末尾に連続するハッシュタグ群を取り除く。
 * 本文中のハッシュタグは温存し、前後をトリムする。
 */
export function cleanCaption(caption: string): string {
  return caption
    .replace(SOCIAL_PREFIX, "")
    .replace(TRAILING_HASHTAGS, "")
    .trim();
}

/** Instagram キャプションから抽出した中立的なレシピフィールド。 */
export type InstagramRecipeFields = {
  title?: string;
  description?: string;
  servings?: number;
  cookingTimeMinutes?: number;
  ingredients: { name: string; quantity: string }[];
  steps: { body: string }[];
};

/** unknown を安全にレコードとして扱う（normalize.ts と同等のローカルヘルパ）。 */
function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** 数値文字列 / 数値を許容範囲でクランプする。範囲外・不正は undefined。 */
function clampMinutes(raw: unknown, min: number, max: number): number | undefined {
  let value: number;
  if (typeof raw === "number") {
    value = raw;
  } else if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    value = Number(raw.trim());
  } else {
    return undefined;
  }
  if (!Number.isInteger(value) || value < min || value > max) {
    return undefined;
  }
  return value;
}

/** 空文字を undefined に畳む。 */
function nonEmpty(value: string): string | undefined {
  return value === "" ? undefined : value;
}

/**
 * AI が返した未検証 JSON を {@link InstagramRecipeFields} へ正規化する。
 * normalize.ts の normalizeDraft の作法に倣い、欠損・不正型でも落ちず空配列 / undefined にする。
 */
export function normalizeInstagramRecipe(raw: unknown): InstagramRecipeFields {
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

  const servings = parseServings(draft.servings);

  return {
    title: nonEmpty(clampText(asString(draft.title).trim(), LIMITS.TITLE)),
    description: nonEmpty(
      clampText(asString(draft.description).trim(), LIMITS.DESCRIPTION),
    ),
    servings: servings ?? undefined,
    cookingTimeMinutes: clampMinutes(draft.cooking_time_minutes, 1, 1440),
    ingredients,
    steps,
  };
}
