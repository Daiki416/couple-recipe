import type { RecipeFormValues } from "@/components/recipes/RecipeForm";

/**
 * AI チャットのモード。
 * - existing: 登録済みレシピ（自世帯）から条件に合うものを選んで提案する。
 * - new: 条件に合う新しいレシピを生成し、採用したら登録できる。
 */
export type ChatMode = "existing" | "new";

/**
 * AI が返す 1 件の提案。
 * - existing: 自世帯の実在レシピへの参照（recipeId は検証済みのものだけ通す）。
 * - new: 新規レシピのドラフト（RecipeForm のプリフィル値）。
 */
export type RecipeSuggestion =
  | { type: "existing"; recipeId: string; title: string; reason: string }
  | {
      type: "new";
      reason: string;
      draft: RecipeFormValues;
      // 自動保存した recipe_suggestions の id。採用時に渡すと元の提案が削除される。
      // 保存に失敗した場合は undefined（採用しても提案は残るが致命ではない）。
      suggestionId?: string;
    };

/** AI の 1 応答。メッセージ本文と提案リスト。 */
export type AssistantReply = {
  message: string;
  suggestions: RecipeSuggestion[];
};

/** 会話履歴の 1 ターン（LLM へ渡すのはこのテキストのみ）。 */
export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

/**
 * LLM へ渡す自世帯レシピの最小情報。
 * id / title / tags / 調理時間 / 材料名（先頭数件）のみに絞り、プロンプト肥大を防ぐ。
 */
export type ChatRecipeContext = {
  id: string;
  title: string;
  tags: string[];
  cookingTimeMinutes: number | null;
  ingredients: string[];
};

/** Server Action `sendChatMessage` の戻り値。詳細エラーは返さず汎用文言のみ。 */
export type ChatActionResult =
  | { ok: true; reply: AssistantReply }
  | { ok: false; error: string };

/** 画面に積む 1 メッセージ。assistant のみ提案を持つ。 */
export type ChatUiMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; suggestions: RecipeSuggestion[] };

/**
 * チャット画面の表示状態。タブ移動で消えないよう sessionStorage に退避する単位。
 * 永続（DB）保存はしない方針のため、セッション限りで保持する。
 */
export type ChatConversation = {
  mode: ChatMode;
  messages: ChatUiMessage[];
};
