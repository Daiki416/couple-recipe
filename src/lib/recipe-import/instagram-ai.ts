import "server-only";
import type { AiResult } from "@/lib/ai";
import type { JsonSchema } from "@/lib/chat/prompt";

/**
 * Instagram キャプションを Gemini で構造化レシピ（材料 / 手順）へ分解する server-only 層。
 * ai.ts generateRecipeChat と同形で、鍵未設定・失敗・タイムアウト時は throw せず { ok: false }。
 * 鍵や生レスポンスは戻り値に載せない（data: unknown のみ）。
 */

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const REQUEST_TIMEOUT_MS = 20000;

/** キャプションから抽出するレシピの構造化スキーマ。 */
const INSTAGRAM_RECIPE_SCHEMA: JsonSchema = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING", description: "レシピ名。キャプションから導出する" },
    description: { type: "STRING" },
    servings: { type: "STRING", description: "人数。半角整数の文字列。例 '2'" },
    cooking_time_minutes: {
      type: "STRING",
      description: "調理時間（分）。半角整数の文字列。例 '20'",
    },
    ingredients: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          quantity: { type: "STRING" },
        },
        required: ["name"],
      },
    },
    steps: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { body: { type: "STRING" } },
        required: ["body"],
      },
    },
  },
  required: ["title", "ingredients", "steps"],
};

const SYSTEM_INSTRUCTION =
  "これは Instagram の料理投稿キャプションです。" +
  "likes / comments / username / 日付 / ハッシュタグは無視してください。" +
  "キャプションからレシピ名（title・キャプションから導出）・説明（description）・" +
  "人数（servings）・調理時間（cooking_time_minutes、分）・材料（ingredients の name / quantity）・" +
  "手順（steps の body）を日本語で抽出してください。" +
  "servings と cooking_time_minutes は半角整数の文字列にしてください。" +
  "タグは生成しないでください。該当が無いフィールドは空でかまいません。" +
  "出力は必ず指定の JSON スキーマに従ってください。";

/** Gemini generateContent レスポンスから本文テキストを取り出す。 */
function extractText(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }
  const parts = (candidates[0] as { content?: { parts?: unknown } }).content
    ?.parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    return null;
  }
  const text = (parts[0] as { text?: unknown }).text;
  return typeof text === "string" ? text : null;
}

/**
 * キャプションを Gemini Flash に渡し、responseSchema による構造化 JSON を得る。
 * 鍵未設定・失敗時は throw せず { ok: false } を返す（呼び出し側でフォールバック）。
 */
export async function extractRecipeFromCaption(
  caption: string,
): Promise<AiResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // 鍵未設定でもアプリを落とさない。詳細はサーバログのみ。
    console.error("[instagram-ai] GEMINI_API_KEY is not set");
    return { ok: false };
  }

  const body = {
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: `キャプション:\n${caption}` }],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: INSTAGRAM_RECIPE_SCHEMA,
      temperature: 0.2,
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // 鍵はヘッダで渡し、URL（ログに残りやすい）には載せない。
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error("[instagram-ai] gemini responded", response.status);
      return { ok: false };
    }

    const payload: unknown = await response.json();
    const text = extractText(payload);
    if (text === null) {
      console.error("[instagram-ai] gemini response had no text part");
      return { ok: false };
    }

    return { ok: true, data: JSON.parse(text) as unknown };
  } catch (error) {
    // タイムアウト / ネットワーク / JSON parse 失敗。生エラーはログのみ。
    console.error("[instagram-ai] extractRecipeFromCaption", error);
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}
