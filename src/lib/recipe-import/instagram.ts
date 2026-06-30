import "server-only";
import { RecipeImportError, type ImportedRecipe } from "./types";
import { collectMeta } from "./generic";
import { safeFetchText } from "./http";
import { clampText, LIMITS } from "./parsers";
import { extractRecipeFromCaption } from "./instagram-ai";
import {
  cleanCaption,
  extractInstagramCaption,
  normalizeInstagramRecipe,
} from "./instagram-parser";
import { parseYoutubeDescription } from "./youtube-parser";

/**
 * Instagram 投稿（reel / post）からレシピを取り込む I/O オーケストレータ。
 * og:description（キャプション）を Gemini で材料 / 手順へ構造化し、
 * AI 不採用時は YouTube 概要欄解析を流用したヒューリスティックへフォールバックする。
 * 鍵・生レスポンス・生 HTML はクライアントへ返さない。
 */
export async function fetchInstagramRecipe(
  url: string,
): Promise<ImportedRecipe> {
  const html = await safeFetchText(url);
  const meta = collectMeta(html);
  const imageUrl = meta.get("og:image");

  const caption = extractInstagramCaption(meta.get("og:description") ?? "");
  if (caption.trim() === "") {
    throw new RecipeImportError(
      "レシピ情報を読み取れませんでした。お手数ですが手入力で作成してください。",
      "instagram empty caption",
    );
  }

  // まず AI でキャプションを構造化する。鍵未設定・失敗時は { ok: false }。
  const ai = await extractRecipeFromCaption(caption);
  if (ai.ok) {
    const fields = normalizeInstagramRecipe(ai.data);
    if (
      fields.ingredients.length > 0 ||
      fields.steps.length > 0 ||
      fields.title
    ) {
      return {
        title: fields.title,
        description: fields.description,
        sourceUrl: url,
        servings: fields.servings,
        cookingTimeMinutes: fields.cookingTimeMinutes,
        ingredients: fields.ingredients,
        steps: fields.steps,
        imageUrl,
      };
    }
  }

  // AI 不採用ならヒューリスティック（YouTube 概要欄解析を流用）へフォールバック。
  const cleaned = cleanCaption(caption);
  const parsed = parseYoutubeDescription(cleaned);
  if (parsed.ingredients.length > 0 || parsed.steps.length > 0) {
    return {
      title: undefined,
      description: parsed.description ?? cleaned,
      sourceUrl: url,
      servings: parsed.servings,
      ingredients: parsed.ingredients,
      steps: parsed.steps,
      imageUrl,
    };
  }

  // 材料・手順を取れなければ、キャプション本文を説明に入れて返す。
  return {
    title: undefined,
    description: clampText(cleaned, LIMITS.DESCRIPTION),
    sourceUrl: url,
    ingredients: [],
    steps: [],
    imageUrl,
  };
}
