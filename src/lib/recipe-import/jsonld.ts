/**
 * HTML から schema.org/Recipe の JSON-LD を抽出する純粋関数。
 * `any` を使わず unknown + 型ガードで型ゆれ（@graph / 配列 / @type のゆれ）を吸収する。
 */

/** JSON-LD から取り出した中立的な Recipe フィールド。 */
export type JsonLdRecipe = {
  name?: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  totalTime?: string;
  recipeYield?: string;
  image?: string;
  keywords?: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** @type が文字列 / 配列いずれでも target を含むか判定する。 */
function typeMatches(node: Record<string, unknown>, target: string): boolean {
  const type = node["@type"];
  if (typeof type === "string") {
    return type === target;
  }
  if (Array.isArray(type)) {
    return type.some((t) => t === target);
  }
  return false;
}

/** HTML 中の application/ld+json ブロックを全て取り出し、パースできた値を返す。 */
function parseJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re =
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(re)) {
    const raw = match[1]?.trim();
    if (!raw) {
      continue;
    }
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // パースできないブロックはスキップ。
    }
  }
  return blocks;
}

/** ルート値群から Recipe ノード候補を平坦に集める。 */
function collectNodes(roots: unknown[]): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!isRecord(value)) {
      return;
    }
    nodes.push(value);
    if (Array.isArray(value["@graph"])) {
      value["@graph"].forEach(visit);
    }
  };
  roots.forEach(visit);
  return nodes;
}

/** recipeInstructions の型ゆれを走査して手順テキスト配列へ平坦化する。 */
function collectInstructions(value: unknown): string[] {
  const out: string[] = [];
  const visit = (v: unknown) => {
    if (typeof v === "string") {
      out.push(v);
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(visit);
      return;
    }
    if (!isRecord(v)) {
      return;
    }
    if (typeMatches(v, "HowToSection") && v.itemListElement !== undefined) {
      visit(v.itemListElement);
      return;
    }
    const text = asString(v.text) ?? asString(v.name);
    if (text !== undefined) {
      out.push(text);
      return;
    }
    if (v.itemListElement !== undefined) {
      visit(v.itemListElement);
    }
  };
  visit(value);
  return out;
}

/** recipeIngredient（文字列 / 文字列配列）を配列へ。 */
function collectStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  return [];
}

/** image（文字列 / {url} / 配列）から先頭の URL を取り出す。 */
function extractImage(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = extractImage(item);
      if (url) {
        return url;
      }
    }
    return undefined;
  }
  if (isRecord(value)) {
    return asString(value.url);
  }
  return undefined;
}

/** recipeYield（文字列 / 数値 / 配列）を文字列へ。 */
function extractYield(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const y = extractYield(item);
      if (y !== undefined) {
        return y;
      }
    }
  }
  return undefined;
}

/** keywords（カンマ区切り文字列 / 配列）をタグ配列へ。 */
function extractKeywords(value: unknown): string[] | undefined {
  if (typeof value === "string") {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "");
  }
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  return undefined;
}

/**
 * HTML から最初に見つかった schema.org/Recipe を中立フィールドへ抽出する。
 * Recipe が無ければ null。
 */
export function extractJsonLdRecipe(html: string): JsonLdRecipe | null {
  const nodes = collectNodes(parseJsonLdBlocks(html));
  const recipe = nodes.find((node) => typeMatches(node, "Recipe"));
  if (!recipe) {
    return null;
  }
  const totalTime =
    asString(recipe.totalTime) ?? asString(recipe.cookTime) ?? undefined;
  return {
    name: asString(recipe.name),
    description: asString(recipe.description),
    ingredients: collectStrings(recipe.recipeIngredient),
    instructions: collectInstructions(recipe.recipeInstructions),
    totalTime,
    recipeYield: extractYield(recipe.recipeYield),
    image: extractImage(recipe.image),
    keywords: extractKeywords(recipe.keywords),
  };
}
