/**
 * YouTube 概要欄テキストをヒューリスティックに材料 / 手順へ分割する純粋関数。
 * LLM は使わず、見出し・分量を含む行・番号付き行で判別する。
 * 分割不能なら全文を description に格納する。
 */
import {
  clampText,
  compactIngredients,
  compactSteps,
  LIMITS,
  parseServings,
  splitIngredient,
  splitPlainIngredient,
  stripHtml,
} from "./parsers";

export type YoutubeParseResult = {
  ingredients: { name: string; quantity: string }[];
  steps: { body: string }[];
  description?: string;
  servings?: number;
};

type Section = "none" | "ingredients" | "steps";

const BULLET = /^[・\-‐–—●○◦◯*＊▪►▶☆★»·◆◇■◎→]+\s*/;
const NUMBERED = /^(?:[(（]?\d+[)）.．、:：]|[①-⑳㉑-㉟]|手順\s*\d+[:：.、]?)\s*/;

/** 記号や罫線のみの区切り行。 */
const SEPARATOR_ONLY = /^[＊*＝=ー―—\-~〜～_\s]+$/;
/** 「…」『…』で囲まれた行（多くは料理名）。 */
const QUOTED_NAME = /^[「『][^」』]*[」』]$/;
/** （…）(…) で囲まれた注釈行。 */
const PAREN_NOTE = /^[（(].*[)）]$/;
/** 【…】 ■…■ の小見出し。 */
const SUBHEADING = /^(?:【.*】|■.*■)$/;
/** リンク誘導・宣伝に使われる語（材料行ではないと判断する補助）。 */
const LINK_WORDS =
  /(ツイッター|ツイッタ|twitter|インスタ|instagram|tiktok|ホームページ|チャンネル登録|高評価|お仕事|依頼|BGM|効果音|楽曲)/i;

/** 装飾を除いた見出し種別を判定する。 */
function detectHeader(line: string): Section | null {
  const core = line.replace(/[【】■◆▼▽◇『』「」\[\]<>（）()\s:：。・※#＃]/g, "");
  if (core.length === 0 || core.length > 10) {
    return null;
  }
  if (/^材料/.test(core)) {
    return "ingredients";
  }
  if (/^(作り方|作りかた|つくり方|手順|調理手順|調理方法|レシピ|工程)/.test(core)) {
    return "steps";
  }
  return null;
}

type LineKind =
  | { kind: "candidate"; item: { name: string; quantity: string } }
  | { kind: "neutral" }
  | { kind: "break" };

/**
 * 1 行を材料候補 / 中立（空行・注釈・小見出し）/ 区切り に分類する。
 * 中立行は材料ブロックを途切れさせず、材料にも含めない。
 */
function classifyLine(raw: string): LineKind {
  const line = raw.trim();
  if (line === "") {
    return { kind: "neutral" };
  }
  // 注釈・小見出しは（分量を含んでいても）材料に含めず、ブロックも途切れさせない。
  if (PAREN_NOTE.test(line)) {
    return { kind: "neutral" };
  }
  if (line.length <= 12 && SUBHEADING.test(line)) {
    return { kind: "neutral" };
  }
  // URL / メール / ハッシュタグ / 人数 / 区切り / 料理名は材料にしない。
  if (
    line.includes("http") ||
    line.includes("@") ||
    /^[#＃]/.test(line) ||
    /(人分|人前)/.test(line) ||
    SEPARATOR_ONLY.test(line) ||
    QUOTED_NAME.test(line)
  ) {
    return { kind: "break" };
  }
  const body = line.replace(BULLET, "").trim();
  // 分量トークンを持たない行（リンク誘導語のみの行を含む）は材料ではない。
  const item = splitPlainIngredient(body);
  if (item === null || LINK_WORDS.test(body)) {
    return { kind: "break" };
  }
  return { kind: "candidate", item };
}

/**
 * 分量を含む材料候補行が 2 行以上連続するブロックを検出する。
 * 中立行（空行・注釈・小見出し）はブロックを途切れさせない。
 * 同じ長さなら最初に現れたブロックを採用する。
 */
function detectIngredientBlock(lines: string[]): {
  items: { name: string; quantity: string }[];
  startIndex: number;
} | null {
  const kinds = lines.map(classifyLine);
  let best: { start: number; end: number; count: number } | null = null;
  let i = 0;
  while (i < kinds.length) {
    if (kinds[i].kind !== "candidate") {
      i += 1;
      continue;
    }
    const start = i;
    let end = i;
    let count = 0;
    let j = i;
    while (j < kinds.length) {
      const kind = kinds[j];
      if (kind.kind === "candidate") {
        count += 1;
        end = j;
        j += 1;
      } else if (kind.kind === "neutral") {
        j += 1;
      } else {
        break;
      }
    }
    if (count >= 2 && (best === null || count > best.count)) {
      best = { start, end, count };
    }
    i = j;
  }
  if (best === null) {
    return null;
  }
  const items: { name: string; quantity: string }[] = [];
  for (let k = best.start; k <= best.end; k += 1) {
    const kind = kinds[k];
    if (kind.kind === "candidate") {
      items.push(kind.item);
    }
  }
  return { items, startIndex: best.start };
}

/** 採用ブロックより前の行から人数表記を探す。 */
function findServings(lines: string[], beforeIndex: number): number | undefined {
  for (let k = beforeIndex - 1; k >= 0; k -= 1) {
    if (/(人分|人前)/.test(lines[k])) {
      const parsed = parseServings(lines[k]);
      if (parsed !== null) {
        return parsed;
      }
    }
  }
  return undefined;
}

/** 概要欄テキストを材料 / 手順 / 説明へ分割する。 */
export function parseYoutubeDescription(raw: string): YoutubeParseResult {
  const normalized = stripHtml(raw);
  const lines = normalized.split("\n").map((l) => l.trim());

  const ingredientLines: string[] = [];
  const stepLines: string[] = [];
  const preamble: string[] = [];
  let section: Section = "none";

  for (const line of lines) {
    if (line === "") {
      continue;
    }
    const header = detectHeader(line);
    if (header) {
      section = header;
      continue;
    }
    if (section === "ingredients") {
      ingredientLines.push(line.replace(BULLET, "").trim());
    } else if (section === "steps") {
      stepLines.push(line.replace(NUMBERED, "").trim());
    } else {
      preamble.push(line);
    }
  }

  let ingredients = compactIngredients(
    ingredientLines.map((l) => splitIngredient(l)),
  );
  let steps = compactSteps(stepLines.map((body) => ({ body })));
  let servings: number | undefined;
  let blockStart: number | null = null;

  // 材料が見出しから採れなければ、分量を含む連続ブロックから抽出する。
  if (ingredients.length === 0) {
    const block = detectIngredientBlock(lines);
    if (block) {
      const compacted = compactIngredients(block.items);
      if (compacted.length > 0) {
        ingredients = compacted;
        blockStart = block.startIndex;
        servings = findServings(lines, block.startIndex);
      }
    }
  }

  // 手順が見出しから採れなければ、番号付き行を手順とみなす。
  if (steps.length === 0) {
    const fallbackSteps: string[] = [];
    for (const line of lines) {
      if (line !== "" && NUMBERED.test(line)) {
        fallbackSteps.push(line.replace(NUMBERED, "").trim());
      }
    }
    const fs = compactSteps(fallbackSteps.map((body) => ({ body })));
    if (fs.length > 0) {
      steps = fs;
    }
  }

  // 説明文の決定。
  let description: string | undefined;
  if (blockStart !== null) {
    const before = lines.slice(0, blockStart).filter((l) => l !== "");
    const text = before.join("\n").trim();
    description = text === "" ? undefined : clampText(text, LIMITS.DESCRIPTION);
  } else if (ingredients.length === 0 && steps.length === 0) {
    description =
      normalized === "" ? undefined : clampText(normalized, LIMITS.DESCRIPTION);
  } else if (preamble.length > 0) {
    const text = preamble.join("\n").trim();
    description = text === "" ? undefined : clampText(text, LIMITS.DESCRIPTION);
  }

  return { ingredients, steps, description, servings };
}
