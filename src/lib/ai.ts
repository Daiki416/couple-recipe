import "server-only";

import {
  buildResponseSchema,
  buildSystemInstruction,
  buildUserPrompt,
} from "@/lib/chat/prompt";
import type { ChatMode, ChatRecipeContext, ChatTurn } from "@/lib/chat/types";

/**
 * 構造化レシピチャットのプロバイダ抽象。
 * 返すのは検証前の生 JSON 値（unknown）。検証・正規化は呼び出し側（normalize）で行う。
 * 鍵・外部 API の生レスポンスはここから外へ出さない。
 */
export type RecipeChatRequest = {
  mode: ChatMode;
  message: string;
  history: ChatTurn[];
  recipes: ChatRecipeContext[];
};

export type AiResult = { ok: true; data: unknown } | { ok: false };

export type RecipeChatProvider = (
  request: RecipeChatRequest,
) => Promise<AiResult>;

// Gemini Flash 系（無料枠で使えるモデル・差し替え可）。
// gemini-2.0-flash はプロジェクトによって無料枠が割り当てられない（limit:0 で 429）ことがあるため、
// 無料枠が有効な gemini-2.5-flash を既定にする。プロバイダを変える場合は generateRecipeChat ごと差し替える。
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const REQUEST_TIMEOUT_MS = 20000;

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
 * Gemini Flash を REST fetch で呼び、responseSchema による構造化 JSON を得る。
 * 追加依存（SDK）は使わない。鍵未設定・失敗時は throw せず { ok: false } を返す。
 */
export const generateRecipeChat: RecipeChatProvider = async (request) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // 鍵未設定でもアプリを落とさない。詳細はサーバログのみ。
    console.error("[ai] GEMINI_API_KEY is not set");
    return { ok: false };
  }

  const body = {
    systemInstruction: {
      parts: [{ text: buildSystemInstruction(request.mode) }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: buildUserPrompt(request) }],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: buildResponseSchema(request.mode),
      temperature: request.mode === "new" ? 0.8 : 0.4,
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
      console.error("[ai] gemini responded", response.status);
      return { ok: false };
    }

    const payload: unknown = await response.json();
    const text = extractText(payload);
    if (text === null) {
      console.error("[ai] gemini response had no text part");
      return { ok: false };
    }

    return { ok: true, data: JSON.parse(text) as unknown };
  } catch (error) {
    // タイムアウト / ネットワーク / JSON parse 失敗。生エラーはログのみ。
    console.error("[ai] generateRecipeChat", error);
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
};
