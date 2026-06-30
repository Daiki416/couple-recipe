/**
 * LLM へ渡すプロンプト・構造化出力スキーマを組み立てる純粋関数群（I/O なし）。
 * プロバイダ非依存にし、ai.ts から利用する。
 */

import type { ChatMode, ChatRecipeContext, ChatTurn } from "@/lib/chat/types";

/** Gemini の responseSchema（OpenAPI サブセット）に渡す最小スキーマ型。`any` を避ける。 */
export type JsonSchema = {
  type: "STRING" | "NUMBER" | "BOOLEAN" | "ARRAY" | "OBJECT";
  description?: string;
  enum?: string[];
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
};

const DRAFT_SCHEMA: JsonSchema = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
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
    // タグはユーザーが手動で付ける運用のため、AI には生成させない。
  },
  required: ["title", "ingredients", "steps"],
};

/** モードごとの responseSchema を返す。existing は実在 ID 参照、new はドラフト。 */
export function buildResponseSchema(mode: ChatMode): JsonSchema {
  const suggestionProps: Record<string, JsonSchema> =
    mode === "existing"
      ? {
          type: { type: "STRING", enum: ["existing"] },
          recipeId: {
            type: "STRING",
            description: "候補レシピの id。必ず提示された一覧の id を使うこと",
          },
          title: { type: "STRING" },
          reason: { type: "STRING", description: "おすすめ理由を一言で" },
        }
      : {
          type: { type: "STRING", enum: ["new"] },
          reason: { type: "STRING", description: "提案理由を一言で" },
          draft: DRAFT_SCHEMA,
        };

  return {
    type: "OBJECT",
    properties: {
      message: { type: "STRING", description: "ユーザーへの短い返答" },
      suggestions: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: suggestionProps,
          required:
            mode === "existing"
              ? ["type", "recipeId", "reason"]
              : ["type", "reason", "draft"],
        },
      },
    },
    required: ["message", "suggestions"],
  };
}

const BASE_INSTRUCTION =
  "あなたは夫婦向けレシピ管理アプリ「ふたりごはん」の料理アシスタントです。" +
  "ユーザーは料理の雰囲気（さっぱり/こってり 等）や食材（野菜たっぷり 等）の希望を伝えます。" +
  "日本語で、家庭料理に即した現実的な提案をしてください。出力は必ず指定の JSON スキーマに従います。";

/** モードごとの system instruction を返す。 */
export function buildSystemInstruction(mode: ChatMode): string {
  if (mode === "existing") {
    return (
      `${BASE_INSTRUCTION}\n` +
      "【モード: 手持ちから探す】提示された『登録済みレシピ一覧』の中だけから、" +
      "希望に合うものを最大3件選んで suggestions に入れてください。" +
      "recipeId は必ず一覧に存在する id をそのまま使い、一覧に無いレシピを作ってはいけません。" +
      "合うものが無ければ suggestions を空にし、message でその旨を伝えてください。"
    );
  }
  return (
    `${BASE_INSTRUCTION}\n` +
    "【モード: 新しいレシピを提案】希望に合う新しいレシピを最大2件、" +
    "draft（title / description / servings / cooking_time_minutes / ingredients / steps）として" +
    "具体的に生成してください。分量と手順は家庭で再現できる粒度にし、" +
    "servings と cooking_time_minutes は半角整数の文字列にしてください。" +
    "タグはユーザーが手動で付けるため生成しないでください。"
  );
}

/** レシピコンテキストを LLM 向けの簡潔な JSON 文字列にする。 */
function formatRecipeContext(recipes: ChatRecipeContext[]): string {
  return JSON.stringify(
    recipes.map((r) => ({
      id: r.id,
      title: r.title,
      tags: r.tags,
      cookingTimeMinutes: r.cookingTimeMinutes,
      ingredients: r.ingredients,
    })),
  );
}

/** 直近の会話履歴を読みやすいテキストにする。 */
function formatHistory(history: ChatTurn[]): string {
  if (history.length === 0) {
    return "";
  }
  const lines = history
    .map((turn) => `${turn.role === "user" ? "ユーザー" : "アシスタント"}: ${turn.content}`)
    .join("\n");
  return `これまでの会話:\n${lines}\n\n`;
}

/** ユーザープロンプトを組み立てる。existing モードでは候補一覧を同梱する。 */
export function buildUserPrompt(params: {
  mode: ChatMode;
  message: string;
  history: ChatTurn[];
  recipes: ChatRecipeContext[];
}): string {
  const { mode, message, history, recipes } = params;
  const historyText = formatHistory(history);
  const requestText = `今回のリクエスト: ${message}`;

  if (mode === "existing") {
    return (
      `${historyText}登録済みレシピ一覧(JSON):\n${formatRecipeContext(recipes)}\n\n${requestText}`
    );
  }
  return `${historyText}${requestText}`;
}
