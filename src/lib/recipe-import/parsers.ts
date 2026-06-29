/**
 * 取り込み結果を整形するための純粋関数群（I/O を一切持たない）。
 * 解析（jsonld / generic / youtube-parser）と正規化（import-actions）から共用する。
 */

/** 入力長・件数の上限。actions.ts の検証値と揃える。 */
export const LIMITS = {
  TITLE: 100,
  DESCRIPTION: 2000,
  SOURCE_URL: 2000,
  INGREDIENT_NAME: 100,
  INGREDIENT_QUANTITY: 100,
  STEP_BODY: 2000,
  TAG_NAME: 30,
  TAG_COUNT: 20,
  INGREDIENT_COUNT: 100,
  STEP_COUNT: 100,
} as const;

/** コードポイント単位で上限までトリムする（サロゲートペアを壊さない）。 */
export function clampText(value: string, max: number): string {
  const chars = [...value];
  return chars.length <= max ? value : chars.slice(0, max).join("");
}

/**
 * ISO 8601 duration（例: `PT1H30M`）を分へ変換する。
 * 日/時/分/秒に対応し、構成要素が 1 つも無い・不正・0 以下は null を返す。
 */
export function parseIso8601DurationToMinutes(raw: string): number | null {
  const value = raw.trim();
  const match =
    /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(
      value,
    );
  if (!match) {
    return null;
  }
  const [, w, d, h, m, s] = match;
  if (
    w === undefined &&
    d === undefined &&
    h === undefined &&
    m === undefined &&
    s === undefined
  ) {
    return null;
  }
  const weeks = w ? Number(w) : 0;
  const days = d ? Number(d) : 0;
  const hours = h ? Number(h) : 0;
  const minutes = m ? Number(m) : 0;
  const seconds = s ? Number(s) : 0;
  const total =
    weeks * 7 * 24 * 60 +
    days * 24 * 60 +
    hours * 60 +
    minutes +
    Math.floor(seconds / 60);
  return total > 0 ? total : null;
}

/** 全角数字を半角へ変換する。 */
function toHalfWidthDigits(value: string): string {
  return value.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );
}

/**
 * 人数表記（"4人分" / 4 / "4-6人前" / 配列）から先頭の整数を取り出す。
 * 解釈できない場合は null。
 */
export function parseServings(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = parseServings(item);
      if (parsed !== null) {
        return parsed;
      }
    }
    return null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const match = toHalfWidthDigits(value).match(/\d+/);
  if (!match) {
    return null;
  }
  const num = Number(match[0]);
  return Number.isInteger(num) && num > 0 ? num : null;
}

/** 末尾トークンが分量らしいかを判定するためのヒント。 */
const QUANTITY_HINT =
  /[0-9０-９½⅓⅔¼¾⅕]|適量|少々|ひとつまみ|大さじ|小さじ|カップ|お好み|適宜/;

/**
 * 材料 1 行を「材料名」と「分量」に分解する。
 * タブ / 全角空白 / 2 連続以上の半角空白を強い区切りとして優先し、
 * 無ければ単一空白の末尾トークンが分量らしい場合のみ分割する。
 * 分解できない場合は name=全体 / quantity="" を返す。
 */
export function splitIngredient(raw: string): {
  name: string;
  quantity: string;
} {
  const text = raw.trim();
  if (text === "") {
    return { name: "", quantity: "" };
  }

  // 強い区切り（タブ / 全角空白 / 2 連続以上の半角空白）の最後の出現で分割。
  const strong = /[\t　]+| {2,}/g;
  let lastSep: { index: number; length: number } | null = null;
  for (const m of text.matchAll(strong)) {
    lastSep = { index: m.index, length: m[0].length };
  }
  if (lastSep) {
    const name = text.slice(0, lastSep.index).trim();
    const quantity = text.slice(lastSep.index + lastSep.length).trim();
    if (name !== "") {
      return { name, quantity };
    }
  }

  // 単一の半角空白区切り。末尾が分量らしいときのみ分割する。
  const singleIdx = text.lastIndexOf(" ");
  if (singleIdx > 0) {
    const head = text.slice(0, singleIdx).trim();
    const tail = text.slice(singleIdx + 1).trim();
    if (head !== "" && tail !== "" && QUANTITY_HINT.test(tail)) {
      return { name: head, quantity: tail };
    }
  }

  return { name: text, quantity: "" };
}

/** 全角英数字 / 全角スラッシュを半角へ変換する（コードポイント数を保つ）。 */
function toHalfWidth(value: string): string {
  return value
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
    )
    .replace(/／/g, "/");
}

const PLAIN_FRACTION = "½⅓⅔¼¾";
const PLAIN_NUMBER = `(?:[0-9]+(?:\\.[0-9]+)?(?:\\s*/\\s*[0-9]+)?|[${PLAIN_FRACTION}])`;
const PLAIN_UNIT =
  "kg|mg|ml|cc|cm|mm|㏄|リットル|パック|切れ|チューブ|g|l|ℓ|個|本|枚|袋|缶|玉|片|かけ|束|杯|合|膳|丁|株|房|尾|匹|つ";
const PLAIN_MEASURE = "大さじ|小さじ|カップ";
const PLAIN_VOCAB =
  "ふたつまみ|ひとつまみ|お好み|適量|少々|適宜|半分|少量|ひとつ|ふたつ|みっつ|よっつ|いつつ";

/** 分量トークン（量詞 / 語彙 / 数値+単位）の出現を検出する。 */
const PLAIN_QUANTITY = new RegExp(
  `(?:${PLAIN_MEASURE})|(?:${PLAIN_VOCAB})|(?:${PLAIN_NUMBER})\\s*(?:${PLAIN_UNIT})`,
  "g",
);

/**
 * 「分量トークンを含む行」のみ材料とみなし、最も右側の分量一致位置で
 * 材料名（前）と分量（一致以降）に分割する。
 * 分量を含まない / 名前が空になる行は材料行ではないとみなし null を返す。
 * 既存の {@link splitIngredient} とは別系統（空白区切りではなく分量必須）。
 */
export function splitPlainIngredient(
  line: string,
): { name: string; quantity: string } | null {
  const text = toHalfWidth(line).trim();
  if (text === "") {
    return null;
  }
  // 全一致のうち最も右側（開始位置が最大）の分量トークンを採用する。
  let lastIndex = -1;
  for (const match of text.matchAll(PLAIN_QUANTITY)) {
    const index = match.index ?? 0;
    if (index >= lastIndex) {
      lastIndex = index;
    }
  }
  if (lastIndex < 0) {
    return null;
  }
  const name = text.slice(0, lastIndex).replace(/\s+/g, " ").trim();
  if (name === "") {
    return null;
  }
  const quantity = text.slice(lastIndex).replace(/\s+/g, " ").trim();
  return { name, quantity };
}

const ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** 基本的な HTML エンティティ（名前付き / 数値）をデコードする。 */
export function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      const code = Number.parseInt(body.slice(2), 16);
      return Number.isFinite(code) ? safeFromCodePoint(code, whole) : whole;
    }
    if (body.startsWith("#")) {
      const code = Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? safeFromCodePoint(code, whole) : whole;
    }
    const mapped = ENTITY_MAP[body.toLowerCase()];
    return mapped ?? whole;
  });
}

function safeFromCodePoint(code: number, fallback: string): string {
  if (code < 0 || code > 0x10ffff) {
    return fallback;
  }
  try {
    return String.fromCodePoint(code);
  } catch {
    return fallback;
  }
}

/**
 * HTML タグを除去し、エンティティをデコードして空白を正規化する。
 * ブロック要素や <br> は改行に変換して可読性を保つ。
 */
export function stripHtml(html: string): string {
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|tr|h[1-6]|ul|ol|section|article)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "");
  return decodeEntities(withBreaks)
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 材料配列を整形する（空名除去・上限トリム・件数上限）。 */
export function compactIngredients(
  list: { name: string; quantity: string }[],
): { name: string; quantity: string }[] {
  const result: { name: string; quantity: string }[] = [];
  for (const item of list) {
    const name = clampText(item.name.trim(), LIMITS.INGREDIENT_NAME);
    if (name === "") {
      continue;
    }
    result.push({
      name,
      quantity: clampText(item.quantity.trim(), LIMITS.INGREDIENT_QUANTITY),
    });
    if (result.length >= LIMITS.INGREDIENT_COUNT) {
      break;
    }
  }
  return result;
}

/** 手順配列を整形する（空除去・上限トリム・件数上限）。 */
export function compactSteps(list: { body: string }[]): { body: string }[] {
  const result: { body: string }[] = [];
  for (const item of list) {
    const body = clampText(item.body.trim(), LIMITS.STEP_BODY);
    if (body === "") {
      continue;
    }
    result.push({ body });
    if (result.length >= LIMITS.STEP_COUNT) {
      break;
    }
  }
  return result;
}

/** タグ配列を整形する（空除去・上限トリム・重複除去・件数上限）。 */
export function compactTags(list: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    const tag = clampText(raw.trim(), LIMITS.TAG_NAME);
    if (tag === "" || seen.has(tag)) {
      continue;
    }
    seen.add(tag);
    result.push(tag);
    if (result.length >= LIMITS.TAG_COUNT) {
      break;
    }
  }
  return result;
}
