// レシピ一覧の検索クエリ（searchParams）を解析する純粋モジュール。
// I/O を持たず、不正値はエラーにせず未指定扱いへフォールバックする（throw しない）。
// 検証作法は actions.ts に合わせる（codePointLength / 制御文字判定 / 整数 parse）。

// キーワードの最大長（コードポイント単位）
export const SEARCH_Q_MAX = 100;

// 調理時間（分）の許容範囲
export const SEARCH_MAX_TIME_MIN = 1;
export const SEARCH_MAX_TIME_MAX = 1440;

// タグ各名の最大長 / フィルタに使うタグの件数上限
export const TAG_NAME_MAX = 30;
export const TAG_FILTER_MAX = 20;

export type SortKey = "default" | "kana" | "time";

export type SearchFilters = {
  q: string | null;
  maxTime: number | null;
  tags: string[];
  sort: SortKey;
};

type RawSearchParams = { [key: string]: string | string[] | undefined };

/**
 * 制御文字を含むかどうかを判定する。
 * C0 制御文字(0x00-0x1F) / DEL(0x7f) / C1 制御文字(0x80-0x9F) を対象とする。
 */
function hasControlChar(value: string): boolean {
  return [...value].some((ch) => {
    const code = ch.codePointAt(0) ?? 0;
    return code <= 0x1f || code === 0x7f || (code >= 0x80 && code <= 0x9f);
  });
}

/** コードポイント数を返す（サロゲートペアを 1 文字として数える）。 */
function codePointLength(value: string): number {
  return [...value].length;
}

/** searchParams から単一の文字列値を取り出す（配列なら先頭を採用）。 */
function firstValue(raw: string | string[] | undefined): string | undefined {
  if (Array.isArray(raw)) {
    return raw[0];
  }
  return raw;
}

/**
 * 範囲付き整数として解析する。空/非整数/範囲外は null（未指定扱い）。
 */
function parseRangedInt(
  raw: string | string[] | undefined,
  min: number,
  max: number,
): number | null {
  const value = firstValue(raw);
  if (value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  const num = Number(trimmed);
  if (!Number.isInteger(num) || num < min || num > max) {
    return null;
  }
  return num;
}

/**
 * レシピ一覧の検索クエリを解析する純粋関数。
 * 不正値は throw せず未指定扱い（null / false / 除外）にフォールバックする。
 */
export function parseSearchParams(sp: RawSearchParams): SearchFilters {
  // q: trim → 空/長すぎ/制御文字なら未指定扱い
  let q: string | null = null;
  const rawQ = firstValue(sp.q);
  if (rawQ !== undefined) {
    const trimmed = rawQ.trim();
    if (
      trimmed !== "" &&
      codePointLength(trimmed) <= SEARCH_Q_MAX &&
      !hasControlChar(trimmed)
    ) {
      q = trimmed;
    }
  }

  const maxTime = parseRangedInt(
    sp.max_time,
    SEARCH_MAX_TIME_MIN,
    SEARCH_MAX_TIME_MAX,
  );

  // tags: 配列/単一を正規化 → trim → 空/不正除外 → 重複除去 → 上限まで truncate
  const rawTags = sp.tag;
  const tagValues = Array.isArray(rawTags)
    ? rawTags
    : rawTags === undefined
      ? []
      : [rawTags];
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const raw of tagValues) {
    const name = raw.trim();
    if (name === "") {
      continue;
    }
    if (codePointLength(name) > TAG_NAME_MAX || hasControlChar(name)) {
      continue;
    }
    if (seen.has(name)) {
      continue;
    }
    seen.add(name);
    tags.push(name);
    if (tags.length >= TAG_FILTER_MAX) {
      break;
    }
  }

  // sort: 許可値のみ採用。空/不正は "default"（サーバの updated_at desc 維持）。
  const rawSort = firstValue(sp.sort);
  const sort: SortKey =
    rawSort === "kana" || rawSort === "time" ? rawSort : "default";

  return { q, maxTime, tags, sort };
}

/**
 * 取得済みのレシピ配列を指定キーで並び替える純粋関数（非破壊）。
 * - default: そのまま返す（サーバの updated_at desc を維持）。
 * - kana: 料理名の五十音順（localeCompare "ja"）。
 * - time: 調理時間の昇順。null は末尾。同値は料理名でタイブレーク。
 */
export function sortRecipes<
  T extends { title: string; cooking_time_minutes: number | null },
>(rows: T[], sort: SortKey): T[] {
  if (sort === "kana") {
    return [...rows].sort((a, b) => a.title.localeCompare(b.title, "ja"));
  }
  if (sort === "time") {
    return [...rows].sort((a, b) => {
      const at = a.cooking_time_minutes;
      const bt = b.cooking_time_minutes;
      if (at === null && bt === null) {
        return a.title.localeCompare(b.title, "ja");
      }
      if (at === null) {
        return 1;
      }
      if (bt === null) {
        return -1;
      }
      if (at !== bt) {
        return at - bt;
      }
      return a.title.localeCompare(b.title, "ja");
    });
  }
  return rows;
}
