"use server";

import { createClient } from "@/lib/supabase/server";
import { generateRecipeChat } from "@/lib/ai";
import { buildRecipeContext, parseAssistantReply } from "@/lib/chat/normalize";
import type {
  AssistantReply,
  ChatActionResult,
  ChatMode,
  ChatRecipeContext,
  ChatTurn,
} from "@/lib/chat/types";
import type { Json } from "@/types/database";
import { codePointLength, hasControlChar } from "@/lib/validation/text";

// 入力の上限。プロンプト肥大と濫用を防ぐ。
const MESSAGE_MAX = 500;
const HISTORY_MAX_TURNS = 20;
const HISTORY_CONTENT_MAX = 2000;

const GENERIC_ERROR =
  "うまく応答できませんでした。時間をおいて再度お試しください。";

type ChatInput = {
  mode: ChatMode;
  message: string;
  history: ChatTurn[];
};

/** 1 つのテキストが上限・制御文字（改行/タブは許可）を満たすか。 */
function isValidText(value: string, max: number): boolean {
  return (
    codePointLength(value) <= max &&
    !hasControlChar(value, { allowNewlineTab: true })
  );
}

/** 会話履歴を検証し、不正なら null。件数・各テキストの上限を確認する。 */
function sanitizeHistory(history: ChatTurn[]): ChatTurn[] | null {
  if (history.length > HISTORY_MAX_TURNS) {
    return null;
  }
  for (const turn of history) {
    if (turn.role !== "user" && turn.role !== "assistant") {
      return null;
    }
    if (!isValidText(turn.content, HISTORY_CONTENT_MAX)) {
      return null;
    }
  }
  return history;
}

/** existing モード用に自世帯レシピのコンテキストを取得する（RLS 経由）。 */
async function loadRecipeContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<ChatRecipeContext[]> {
  const { data: recipes, error } = await supabase.rpc("search_recipes", {});
  if (error || !recipes || recipes.length === 0) {
    if (error) {
      console.error("[sendChatMessage] search_recipes", error);
    }
    return [];
  }

  const limited = recipes.slice(0, 80);
  const ids = limited.map((r) => r.id);
  const { data: ingredients, error: ingError } = await supabase
    .from("ingredients")
    .select("recipe_id, name")
    .in("recipe_id", ids);
  if (ingError) {
    console.error("[sendChatMessage] ingredients", ingError);
  }

  return buildRecipeContext(
    limited.map((r) => ({
      id: r.id,
      title: r.title,
      tags: r.tags,
      cooking_time_minutes: r.cooking_time_minutes,
    })),
    ingredients ?? [],
  );
}

/**
 * new 提案の各ドラフトを recipe_suggestions に保存する（RLS 経由）。
 * 後から「AIの提案」面で見返して採用/削除できるようにするための副作用。
 * best-effort: 失敗してもチャット応答は壊さず、詳細は console.error のみ。
 */
async function saveNewSuggestions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  sourcePrompt: string,
  reply: AssistantReply,
): Promise<void> {
  const drafts = reply.suggestions.filter((s) => s.type === "new");
  if (drafts.length === 0) {
    return;
  }

  // RLS の with check は household_id = current_household_id() を要求するため、
  // 既存レシピと同じヘルパで自世帯 id を取得して明示的に埋める。
  const { data: householdId, error: hhError } = await supabase.rpc(
    "current_household_id",
  );
  if (hhError || !householdId) {
    if (hhError) {
      console.error("[sendChatMessage] current_household_id", hhError);
    }
    return;
  }

  const rows = drafts.map((s) => ({
    household_id: householdId,
    created_by: userId,
    draft: s.draft as unknown as Json,
    source_prompt: sourcePrompt,
  }));

  // 挿入順で id を受け取り、各 new 提案へ戻す（チャットから採用した際に元の提案を消すため）。
  const { data: inserted, error } = await supabase
    .from("recipe_suggestions")
    .insert(rows)
    .select("id");
  if (error || !inserted) {
    console.error("[sendChatMessage] save suggestions", error);
    return;
  }
  drafts.forEach((draft, i) => {
    const id = inserted[i]?.id;
    if (typeof id === "string") {
      draft.suggestionId = id;
    }
  });
}

/**
 * AI チャットの送信を処理する Server Action。
 * 認証必須。LLM へ渡すのは絞り込んだレシピ情報のみ。鍵・生レスポンスは外へ出さない。
 * 詳細エラーは console.error のみで、ユーザーには汎用文言を返す。
 */
export async function sendChatMessage(
  input: ChatInput,
): Promise<ChatActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "ログインが必要です。" };
  }

  const mode: ChatMode = input.mode === "new" ? "new" : "existing";

  const message = input.message.trim();
  if (message === "") {
    return { ok: false, error: "メッセージを入力してください。" };
  }
  if (!isValidText(message, MESSAGE_MAX)) {
    return {
      ok: false,
      error: `メッセージは${MESSAGE_MAX}文字以内で入力してください。`,
    };
  }

  const history = sanitizeHistory(Array.isArray(input.history) ? input.history : []);
  if (history === null) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const recipes =
    mode === "existing" ? await loadRecipeContext(supabase) : [];
  const recipeTitleById = new Map(recipes.map((r) => [r.id, r.title]));

  const result = await generateRecipeChat({ mode, message, history, recipes });
  if (!result.ok) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const reply = parseAssistantReply(result.data, mode, recipeTitleById);

  // new モードの提案は後で見返せるよう保存する（best-effort、応答は壊さない）。
  if (mode === "new") {
    await saveNewSuggestions(supabase, user.id, message, reply);
  }

  return { ok: true, reply };
}
