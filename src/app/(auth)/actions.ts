"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = {
  error: string;
} | null;

/**
 * 認証フォームのサーバ側入力検証の結果。
 * ok=false のときは error にユーザー向け汎用文言を持つ。
 */
type ParseAuthFormResult =
  | { ok: true; email: string; password: string; displayName: string }
  | { ok: false; error: string };

/**
 * login/signup 共通の入力検証を行うローカル純粋関数（I/O を持たない）。
 * 検証 NG 時はユーザー列挙を防ぐため汎用固定文言を返す。
 * @param requireDisplayName signup のとき true（display_name を必須検証する）
 */
function parseAuthForm(
  formData: FormData,
  { requireDisplayName }: { requireDisplayName: boolean },
): ParseAuthFormResult {
  const genericError = "入力内容をご確認ください。";

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();

  // email: 必須 + 簡易形式チェック
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: genericError };
  }

  // password: 必須 + 最小長（Supabase Auth 既定の 6 文字。設定変更時は要追従）
  if (!password || password.length < 6) {
    return { ok: false, error: genericError };
  }

  if (requireDisplayName) {
    // display_name: 必須 + 最大長 50（コードポイント単位） + 制御文字を含む入力は拒否。
    // C0 制御文字(0x00-0x1F) / DEL(0x7f) / C1 制御文字(0x80-0x9F) のいずれかを含めば NG。
    const codePoints = [...displayName];
    const hasControlChar = codePoints.some((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code <= 0x1f || code === 0x7f || (code >= 0x80 && code <= 0x9f);
    });
    if (!displayName || hasControlChar || codePoints.length > 50) {
      return { ok: false, error: genericError };
    }
  }

  return { ok: true, email, password, displayName };
}

/**
 * メール+パスワードでログインする Server Action。
 * 失敗時はエラー文字列を return、成功時は /recipes へ redirect。
 */
export async function login(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = parseAuthForm(formData, { requireDisplayName: false });
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.email,
    password: parsed.password,
  });

  if (error) {
    // 詳細はサーバログのみに記録し、ユーザーには汎用文言を返す。
    console.error("[login]", error);
    return { error: "メールアドレスまたはパスワードが正しくありません。" };
  }

  // redirect は内部で例外を投げるため try/catch の外で呼ぶ。
  redirect("/recipes");
}

/**
 * メール+パスワード+表示名でサインアップする Server Action。
 * display_name は options.data.display_name に渡し、
 * DB の handle_new_user トリガが raw_user_meta_data から拾う。
 */
export async function signup(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = parseAuthForm(formData, { requireDisplayName: true });
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.email,
    password: parsed.password,
    options: {
      data: {
        display_name: parsed.displayName,
      },
    },
  });

  if (error) {
    // 生 error.message は漏洩させず、サーバログのみに記録する。
    console.error("[signup]", error);
    return { error: "アカウントの作成に失敗しました。入力内容をご確認ください。" };
  }

  redirect("/");
}

/**
 * ログアウトして /login へ redirect する Server Action。
 */
export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
