"use client";

import { useActionState } from "react";
import {
  updateDisplayName,
  updateEmail,
  updateHouseholdName,
  updatePassword,
  deleteAccount,
  type SettingsActionState,
} from "@/app/(app)/settings/actions";
import {
  cardClass,
  dangerButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/lib/ui";

/** Server Action の結果メッセージ表示。成功は ink・先頭にチェック、失敗は tomato。 */
function FormMessage({ state }: { state: SettingsActionState }) {
  if (!state) {
    return null;
  }
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={`text-sm font-bold ${state.ok ? "text-ink" : "text-tomato"}`}
    >
      {state.ok ? `✓ ${state.message}` : state.message}
    </p>
  );
}

/** 各設定セクションを包むカード。見出し＋説明＋本体を縦に並べる。 */
function SettingsCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`${cardClass} p-5 ${className ?? ""}`}>
      <h2 className="font-round text-lg font-bold text-ink">{title}</h2>
      {description && (
        <p className="mt-1 text-sm text-ink-soft">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function DisplayNameForm({ defaultName }: { defaultName: string }) {
  const [state, formAction, pending] = useActionState<
    SettingsActionState,
    FormData
  >(updateDisplayName, null);

  return (
    <SettingsCard title="表示名" description="ふたりの中で表示される名前です。">
      <form action={formAction} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="display_name" className={labelClass}>
            表示名
          </label>
          <input
            id="display_name"
            name="display_name"
            type="text"
            maxLength={50}
            required
            defaultValue={defaultName}
            className={inputClass}
          />
        </div>
        <FormMessage state={state} />
        <div>
          <button
            type="submit"
            disabled={pending}
            className={primaryButtonClass}
          >
            {pending ? "保存中..." : "変更する"}
          </button>
        </div>
      </form>
    </SettingsCard>
  );
}

export function HouseholdForm({ defaultName }: { defaultName: string }) {
  const [state, formAction, pending] = useActionState<
    SettingsActionState,
    FormData
  >(updateHouseholdName, null);

  return (
    <SettingsCard title="世帯名" description="ふたりのレシピ帳の名前です。">
      <form action={formAction} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="household_name" className={labelClass}>
            世帯名
          </label>
          <input
            id="household_name"
            name="household_name"
            type="text"
            maxLength={50}
            required
            defaultValue={defaultName}
            className={inputClass}
          />
        </div>
        <FormMessage state={state} />
        <div>
          <button
            type="submit"
            disabled={pending}
            className={primaryButtonClass}
          >
            {pending ? "保存中..." : "変更する"}
          </button>
        </div>
      </form>
    </SettingsCard>
  );
}

export function EmailForm({ currentEmail }: { currentEmail: string }) {
  const [state, formAction, pending] = useActionState<
    SettingsActionState,
    FormData
  >(updateEmail, null);

  return (
    <SettingsCard
      title="メールアドレス"
      description="変更すると新しいアドレス宛に確認メールが届きます。"
    >
      <form action={formAction} className="flex flex-col gap-3">
        <p className="text-sm text-ink-soft">現在: {currentEmail}</p>
        <div className="flex flex-col gap-1">
          <label htmlFor="new_email" className={labelClass}>
            新しいメールアドレス
          </label>
          <input
            id="new_email"
            name="new_email"
            type="email"
            autoComplete="email"
            required
            className={inputClass}
          />
        </div>
        <FormMessage state={state} />
        <div>
          <button
            type="submit"
            disabled={pending}
            className={primaryButtonClass}
          >
            {pending ? "送信中..." : "確認メールを送る"}
          </button>
        </div>
      </form>
    </SettingsCard>
  );
}

export function PasswordForm() {
  const [state, formAction, pending] = useActionState<
    SettingsActionState,
    FormData
  >(updatePassword, null);

  return (
    <SettingsCard
      title="パスワード"
      description="現在のパスワードを確認してから変更します。"
    >
      <form action={formAction} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="current_password" className={labelClass}>
            現在のパスワード
          </label>
          <input
            id="current_password"
            name="current_password"
            type="password"
            autoComplete="current-password"
            required
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="new_password" className={labelClass}>
            新しいパスワード
          </label>
          <input
            id="new_password"
            name="new_password"
            type="password"
            autoComplete="new-password"
            required
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="confirm_password" className={labelClass}>
            新しいパスワード（確認）
          </label>
          <input
            id="confirm_password"
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            required
            className={inputClass}
          />
        </div>
        <FormMessage state={state} />
        <div>
          <button
            type="submit"
            disabled={pending}
            className={primaryButtonClass}
          >
            {pending ? "変更中..." : "変更する"}
          </button>
        </div>
      </form>
    </SettingsCard>
  );
}

export function DeleteAccountForm() {
  const [state, formAction, pending] = useActionState<
    SettingsActionState,
    FormData
  >(deleteAccount, null);

  return (
    <SettingsCard
      title="アカウント削除"
      description="アカウントとログイン情報を削除します。この操作は取り消せません。"
      className="border-tomato"
    >
      <form
        action={formAction}
        onSubmit={(e) => {
          if (
            !confirm(
              "本当にアカウントを削除しますか？この操作は取り消せません。",
            )
          ) {
            e.preventDefault();
          }
        }}
        className="flex flex-col gap-3"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="delete_current_password" className={labelClass}>
            現在のパスワード
          </label>
          <input
            id="delete_current_password"
            name="current_password"
            type="password"
            autoComplete="current-password"
            required
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="delete_confirm" className={labelClass}>
            確認のため「削除」と入力
          </label>
          <input
            id="delete_confirm"
            name="confirm"
            type="text"
            placeholder="削除"
            required
            className={inputClass}
          />
        </div>
        <FormMessage state={state} />
        <div>
          <button
            type="submit"
            disabled={pending}
            className={dangerButtonClass}
          >
            {pending ? "削除中..." : "アカウントを削除する"}
          </button>
        </div>
      </form>
    </SettingsCard>
  );
}
