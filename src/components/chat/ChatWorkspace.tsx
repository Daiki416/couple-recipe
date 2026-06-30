"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { sendChatMessage } from "@/app/(app)/chat/actions";
import {
  clearChatConversation,
  loadChatConversation,
  saveChatConversation,
} from "@/lib/chat/conversation-storage";
import { saveAiRecipeDraft } from "@/lib/chat/draft-storage";
import type {
  ChatMode,
  ChatTurn,
  ChatUiMessage,
  RecipeSuggestion,
} from "@/lib/chat/types";
import {
  activePillClass,
  cardClass,
  inputClass,
  pillClass,
  primaryButtonClass,
  subButtonClass,
} from "@/lib/ui";

const MODE_LABEL: Record<ChatMode, string> = {
  existing: "手持ちから探す",
  new: "新しいレシピを提案",
};

const HISTORY_MAX_TURNS = 20;

const GENERIC_ERROR =
  "うまく応答できませんでした。時間をおいて再度お試しください。";

export function ChatWorkspace() {
  const router = useRouter();
  const [mode, setMode] = useState<ChatMode>("existing");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatUiMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const hydratedRef = useRef(false);

  // マウント後に 1 度だけ sessionStorage から会話を復元する。
  // SSR とのハイドレーション不一致を避けるため、初期値ではなく useEffect で読む。
  useEffect(() => {
    const saved = loadChatConversation();
    if (saved) {
      // sessionStorage はクライアントのみで読めるため、マウント後に状態へ反映する。
      /* eslint-disable react-hooks/set-state-in-effect */
      setMode(saved.mode);
      setMessages(saved.messages);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, []);

  // 会話の変更を sessionStorage へ保存する。
  // 初回（復元前）の保存はスキップし、空状態での上書きを防ぐ。
  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }
    saveChatConversation({ mode, messages });
  }, [mode, messages]);

  const handleClear = () => {
    clearChatConversation();
    setMessages([]);
    setError(null);
  };

  const handleSend = () => {
    const message = input.trim();
    if (message === "" || pending) {
      return;
    }
    setError(null);

    // 送信前の履歴（直近のみ）をテキストターンへ変換して渡す。
    const history: ChatTurn[] = messages
      .slice(-HISTORY_MAX_TURNS)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setInput("");

    startTransition(async () => {
      const result = await sendChatMessage({ mode, message, history });
      if (!result.ok) {
        setError(result.error || GENERIC_ERROR);
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.reply.message,
          suggestions: result.reply.suggestions,
        },
      ]);
    });
  };

  const handleRegister = (suggestion: RecipeSuggestion) => {
    if (suggestion.type !== "new") {
      return;
    }
    // 自動保存済みの提案 id を一緒に渡し、作成成功時に元の提案を消す。
    saveAiRecipeDraft(suggestion.draft, suggestion.suggestionId);
    router.push("/recipes/new");
  };

  return (
    <div className="flex flex-col gap-6">
      {/* モード切替（セグメント） */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold text-ink">提案のしかた</span>
        <div className="flex flex-wrap gap-2">
          {(["existing", "new"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={mode === m ? activePillClass : pillClass}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-soft">
          {mode === "existing"
            ? "登録済みのレシピから、ご希望に近いものを選んで提案します。"
            : "ご希望に合う新しいレシピを考えます。気に入ったら登録できます。"}
        </p>
      </div>

      {/* 会話 */}
      <div className="flex flex-col gap-4">
        {messages.length > 0 && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-ink-soft underline underline-offset-2 hover:text-tomato"
            >
              会話をクリア
            </button>
          </div>
        )}

        {messages.length === 0 && (
          <p className="rounded-xl border-2 border-dashed border-line bg-paper/60 px-4 py-10 text-center text-ink-soft">
            「さっぱりした和食」「野菜たっぷりで時短」など、
            <br />
            食べたい雰囲気や食材を伝えてみてください。
          </p>
        )}

        {messages.map((m, index) =>
          m.role === "user" ? (
            <div key={index} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap rounded-xl border-2 border-tomato-deep bg-tomato px-4 py-2 text-sm font-bold text-white">
                {m.content}
              </p>
            </div>
          ) : (
            <div key={index} className="flex flex-col gap-3">
              {m.content !== "" && (
                <p className={`${cardClass} max-w-[85%] whitespace-pre-wrap px-4 py-2 text-sm text-ink`}>
                  {m.content}
                </p>
              )}
              {m.suggestions.map((s, sIndex) => (
                <SuggestionCard
                  key={sIndex}
                  suggestion={s}
                  onRegister={handleRegister}
                />
              ))}
            </div>
          ),
        )}

        {pending && (
          <p className="text-sm text-ink-soft">考えています…</p>
        )}
      </div>

      {error && (
        <p className="text-sm font-bold text-tomato" role="alert">
          {error}
        </p>
      )}

      {/* 入力 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          maxLength={500}
          placeholder="食べたい雰囲気や食材を入力"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              handleSend();
            }
          }}
          className={`${inputClass} w-0 min-w-0 grow`}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={pending || input.trim() === ""}
          className={primaryButtonClass}
        >
          {pending ? "送信中..." : "送信"}
        </button>
      </div>
    </div>
  );
}

function SuggestionCard({
  suggestion,
  onRegister,
}: {
  suggestion: RecipeSuggestion;
  onRegister: (suggestion: RecipeSuggestion) => void;
}) {
  if (suggestion.type === "existing") {
    return (
      <Link
        href={`/recipes/${suggestion.recipeId}`}
        className={`${cardClass} flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-cream-2`}
      >
        <span className="font-round font-bold text-ink">
          {suggestion.title}
        </span>
        {suggestion.reason !== "" && (
          <span className="text-sm text-ink-soft">{suggestion.reason}</span>
        )}
      </Link>
    );
  }

  const { draft } = suggestion;
  const ingredients = draft.ingredients.filter((i) => i.name !== "");
  const steps = draft.steps.map((s) => s.body).filter((body) => body !== "");

  return (
    <div className={`${cardClass} flex flex-col gap-3 px-4 py-3`}>
      <span className="font-round font-bold text-ink">{draft.title}</span>
      {suggestion.reason !== "" && (
        <span className="text-sm text-ink-soft">{suggestion.reason}</span>
      )}
      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
        {draft.cooking_time_minutes !== "" && (
          <div className="flex gap-1">
            <dt className="font-bold">調理時間</dt>
            <dd>{draft.cooking_time_minutes}分</dd>
          </div>
        )}
        {draft.servings !== "" && (
          <div className="flex gap-1">
            <dt className="font-bold">人数</dt>
            <dd>{draft.servings}人分</dd>
          </div>
        )}
      </dl>

      {ingredients.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold text-ink">材料</span>
          <ul className="flex flex-col text-sm text-ink">
            {ingredients.map((ing, i) => (
              <li
                key={i}
                className="flex justify-between gap-3 border-b border-dashed border-line/60 py-1"
              >
                <span>{ing.name}</span>
                {ing.quantity !== "" && (
                  <span className="shrink-0 text-ink-soft">{ing.quantity}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {steps.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold text-ink">作り方</span>
          <ol className="flex flex-col gap-1.5 text-sm text-ink">
            {steps.map((body, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-round font-bold text-tomato">
                  {i + 1}.
                </span>
                <span className="whitespace-pre-wrap">{body}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onRegister(suggestion)}
          className={subButtonClass}
        >
          このレシピを登録
        </button>
      </div>
    </div>
  );
}
