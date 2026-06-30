/**
 * チャットの会話状態（モード＋メッセージ）を sessionStorage に退避・復元する
 * クライアント専用ヘルパー。タブ移動や新規作成画面への遷移で会話が消えないようにする。
 * DB 永続はしない方針のため、保持はセッション限り（タブを閉じると消える）。
 * 復元時は型を検証し、提案ドラフトは normalizeDraft で再正規化して改ざん値を信用しない。
 */

import { normalizeDraft } from "@/lib/chat/normalize";
import type {
  ChatConversation,
  ChatMode,
  ChatUiMessage,
  RecipeSuggestion,
} from "@/lib/chat/types";

const STORAGE_KEY = "futarigohan:chat-conversation";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** 1 件の提案を検証・再正規化する。不正なら null。 */
function parseSuggestion(value: unknown): RecipeSuggestion | null {
  if (!isRecord(value)) {
    return null;
  }
  if (value.type === "existing") {
    const { recipeId, title, reason } = value;
    if (
      typeof recipeId === "string" &&
      typeof title === "string" &&
      typeof reason === "string"
    ) {
      return { type: "existing", recipeId, title, reason };
    }
    return null;
  }
  if (value.type === "new") {
    const draft = normalizeDraft(value.draft);
    if (draft.title === "") {
      return null;
    }
    const reason = typeof value.reason === "string" ? value.reason : "";
    const suggestionId =
      typeof value.suggestionId === "string" ? value.suggestionId : undefined;
    return { type: "new", reason, draft, suggestionId };
  }
  return null;
}

/** 1 メッセージを検証する。不正なら null。 */
function parseMessage(value: unknown): ChatUiMessage | null {
  if (!isRecord(value) || typeof value.content !== "string") {
    return null;
  }
  if (value.role === "user") {
    return { role: "user", content: value.content };
  }
  if (value.role === "assistant") {
    const suggestions = Array.isArray(value.suggestions)
      ? value.suggestions
          .map(parseSuggestion)
          .filter((s): s is RecipeSuggestion => s !== null)
      : [];
    return { role: "assistant", content: value.content, suggestions };
  }
  return null;
}

/** 会話状態を退避する（送信のたびに呼ぶ）。 */
export function saveChatConversation(conversation: ChatConversation): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(conversation));
  } catch {
    // ストレージ不可（プライベートモード等）でも致命ではないため無視する。
  }
}

/**
 * 退避済みの会話状態を取り出す（チャット画面のマウント時に 1 回呼ぶ）。
 * 無い / 壊れている場合は null。メッセージは検証済みのものだけ復元する。
 */
export function loadChatConversation(): ChatConversation | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !Array.isArray(parsed.messages)) {
      return null;
    }
    const mode: ChatMode = parsed.mode === "new" ? "new" : "existing";
    const messages = parsed.messages
      .map(parseMessage)
      .filter((m): m is ChatUiMessage => m !== null);
    return { mode, messages };
  } catch {
    return null;
  }
}

/** 会話状態を消す（「会話をクリア」操作で呼ぶ）。 */
export function clearChatConversation(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // 同上。
  }
}
