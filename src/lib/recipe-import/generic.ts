/**
 * 一般サイトの HTML から中立的な {@link ImportedRecipe} を抽出する純粋関数。
 * JSON-LD（schema.org/Recipe）を優先し、無ければ OGP / meta でフォールバックする。
 */
import type { ImportedRecipe } from "./types";
import { extractJsonLdRecipe, type JsonLdRecipe } from "./jsonld";
import {
  LIMITS,
  clampText,
  compactIngredients,
  compactSteps,
  compactTags,
  decodeEntities,
  parseIso8601DurationToMinutes,
  parseServings,
  splitIngredient,
  stripHtml,
} from "./parsers";

/** 1 つの HTML タグから指定属性の値を取り出す。 */
function readAttr(tag: string, name: string): string | undefined {
  const re = new RegExp(
    `\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`,
    "i",
  );
  const m = tag.match(re);
  if (!m) {
    return undefined;
  }
  return m[2] ?? m[3] ?? m[4];
}

/** meta タグを property/name → content のマップとして収集する。 */
function collectMeta(html: string): Map<string, string> {
  const meta = new Map<string, string>();
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const key = (readAttr(tag, "property") ?? readAttr(tag, "name"))?.toLowerCase();
    const content = readAttr(tag, "content");
    if (key && content !== undefined && !meta.has(key)) {
      meta.set(key, decodeEntities(content));
    }
  }
  return meta;
}

/** <title> を取り出す。 */
function extractTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1]).trim() : undefined;
}

/** JSON-LD の中立フィールドから ImportedRecipe を組み立てる。 */
function buildFromJsonLd(
  recipe: JsonLdRecipe,
  baseUrl: string,
): ImportedRecipe {
  const ingredients = compactIngredients(
    recipe.ingredients.map((line) => splitIngredient(stripHtml(line))),
  );
  const steps = compactSteps(
    recipe.instructions.map((line) => ({ body: stripHtml(line) })),
  );
  const cookingTimeMinutes = recipe.totalTime
    ? parseIso8601DurationToMinutes(recipe.totalTime)
    : null;
  const servings = parseServings(recipe.recipeYield);
  const tags = recipe.keywords ? compactTags(recipe.keywords) : [];

  return {
    title: recipe.name
      ? clampText(stripHtml(recipe.name), LIMITS.TITLE)
      : undefined,
    description: recipe.description
      ? clampText(stripHtml(recipe.description), LIMITS.DESCRIPTION)
      : undefined,
    sourceUrl: baseUrl,
    servings: servings ?? undefined,
    cookingTimeMinutes: cookingTimeMinutes ?? undefined,
    ingredients,
    steps,
    tags: tags.length > 0 ? tags : undefined,
    imageUrl: recipe.image,
  };
}

/** OGP / meta から最小限の ImportedRecipe を組み立てる。 */
function buildFromOgp(html: string, baseUrl: string): ImportedRecipe {
  const meta = collectMeta(html);
  const rawTitle = meta.get("og:title") ?? extractTitle(html);
  const rawDescription =
    meta.get("og:description") ?? meta.get("description");
  const image = meta.get("og:image");

  return {
    title: rawTitle
      ? clampText(stripHtml(rawTitle), LIMITS.TITLE)
      : undefined,
    description: rawDescription
      ? clampText(stripHtml(rawDescription), LIMITS.DESCRIPTION)
      : undefined,
    sourceUrl: baseUrl,
    ingredients: [],
    steps: [],
    imageUrl: image,
  };
}

/**
 * HTML から ImportedRecipe を抽出する。JSON-LD 優先、無ければ OGP フォールバック。
 */
export function extractFromHtml(html: string, baseUrl: string): ImportedRecipe {
  const jsonld = extractJsonLdRecipe(html);
  if (jsonld) {
    const built = buildFromJsonLd(jsonld, baseUrl);
    // JSON-LD はあるが材料・手順が空なら OGP で title/description/image を補う。
    if (built.ingredients.length === 0 && built.steps.length === 0) {
      const ogp = buildFromOgp(html, baseUrl);
      return {
        ...built,
        title: built.title ?? ogp.title,
        description: built.description ?? ogp.description,
        imageUrl: built.imageUrl ?? ogp.imageUrl,
      };
    }
    return built;
  }
  return buildFromOgp(html, baseUrl);
}
