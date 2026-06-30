/**
 * AI が提案した新規レシピのドラフトを、チャット画面から新規作成画面へ
 * sessionStorage 経由で受け渡すためのクライアント専用ヘルパー。
 * 取り出し時は normalizeDraft で再正規化し、改ざんされた値を信用しない。
 */

import type { RecipeFormValues } from "@/components/recipes/RecipeForm";
import { normalizeDraft } from "@/lib/chat/normalize";

const STORAGE_KEY = "futarigohan:ai-recipe-draft";
const SUGGESTION_ID_KEY = "futarigohan:ai-recipe-suggestion-id";

/**
 * ドラフトを退避する（チャット／AI の提案一覧の「レシピにする」で呼ぶ）。
 * suggestionId を渡すと、採用後に該当の保存済み提案を消すための id も一緒に退避する。
 * 渡さない場合は前回の id を残さないよう削除する。
 */
export function saveAiRecipeDraft(
  draft: RecipeFormValues,
  suggestionId?: string,
): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    if (suggestionId !== undefined && suggestionId !== "") {
      sessionStorage.setItem(SUGGESTION_ID_KEY, suggestionId);
    } else {
      sessionStorage.removeItem(SUGGESTION_ID_KEY);
    }
  } catch {
    // ストレージ不可（プライベートモード等）でも致命ではないため無視する。
  }
}

/**
 * 退避済みドラフトを取り出して削除する（/recipes/new の初回表示で 1 回だけ呼ぶ）。
 * 無い / 壊れている / タイトルが空なら null を返す。
 */
export function takeAiRecipeDraft(): RecipeFormValues | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return null;
    }
    sessionStorage.removeItem(STORAGE_KEY);
    const draft = normalizeDraft(JSON.parse(raw) as unknown);
    return draft.title === "" ? null : draft;
  } catch {
    return null;
  }
}

/**
 * 退避済みの提案 id を取り出して削除する（/recipes/new の初回表示で 1 回だけ呼ぶ）。
 * 無い場合は null。採用後に元の提案を消す連携にのみ使う。
 */
export function takeAiSuggestionId(): string | null {
  try {
    const raw = sessionStorage.getItem(SUGGESTION_ID_KEY);
    if (raw === null) {
      return null;
    }
    sessionStorage.removeItem(SUGGESTION_ID_KEY);
    return raw === "" ? null : raw;
  } catch {
    return null;
  }
}
