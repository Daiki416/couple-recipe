"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type SettingsActionState = { ok: boolean; message: string } | null;

// 失敗時にユーザーへ見せる汎用文言（生エラーは漏らさず console.error のみ）。
const GENERIC_ERROR =
  "保存に失敗しました。時間をおいて再度お試しください。";

/** コードポイント数を返す（サロゲートペアを 1 文字として数える）。 */
function codePointLength(value: string): number {
  return [...value].length;
}

/**
 * 制御文字を含むかどうかを判定する。
 * C0 制御文字(0x00-0x1F) / DEL(0x7f) / C1 制御文字(0x80-0x9F) を対象とする。
 */
function hasControlChar(value: string): boolean {
  return [...value].some((ch) => {
    const code = ch.codePointAt(0) ?? 0;
    return code <= 0x1f || code === 0x7f || (code >= 0x80 && code <= 0x9f);
  });
}

/**
 * 表示名（1〜50 コードポイント・制御文字なし）の検証付きで更新する。
 */
export async function updateDisplayName(
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const displayName = String(formData.get("display_name") ?? "").trim();
  if (
    !displayName ||
    hasControlChar(displayName) ||
    codePointLength(displayName) > 50
  ) {
    return { ok: false, message: "表示名は1〜50文字で入力してください。" };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, message: GENERIC_ERROR };
    }

    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName })
      .eq("id", user.id);
    if (error) {
      console.error("[updateDisplayName]", error);
      return { ok: false, message: GENERIC_ERROR };
    }
  } catch (error) {
    console.error("[updateDisplayName]", error);
    return { ok: false, message: GENERIC_ERROR };
  }

  revalidatePath("/settings");
  return { ok: true, message: "表示名を変更しました。" };
}

/**
 * 世帯名（1〜50 コードポイント・制御文字なし）の検証付きで更新する。
 */
export async function updateHouseholdName(
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const name = String(formData.get("household_name") ?? "").trim();
  if (!name || hasControlChar(name) || codePointLength(name) > 50) {
    return { ok: false, message: "世帯名は1〜50文字で入力してください。" };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, message: GENERIC_ERROR };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("household_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || !profile?.household_id) {
      console.error("[updateHouseholdName] profile", profileError);
      return { ok: false, message: GENERIC_ERROR };
    }

    const { error } = await supabase
      .from("households")
      .update({ name })
      .eq("id", profile.household_id);
    if (error) {
      console.error("[updateHouseholdName]", error);
      return { ok: false, message: GENERIC_ERROR };
    }
  } catch (error) {
    console.error("[updateHouseholdName]", error);
    return { ok: false, message: GENERIC_ERROR };
  }

  revalidatePath("/settings");
  return { ok: true, message: "世帯名を変更しました。" };
}

/**
 * メールアドレスを変更する。確認メール送信で完了する 2 段階方式。
 */
export async function updateEmail(
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const email = String(formData.get("new_email") ?? "").trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      ok: false,
      message: "メールアドレスの形式が正しくありません。",
    };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, message: GENERIC_ERROR };
    }

    const { error } = await supabase.auth.updateUser({ email });
    if (error) {
      console.error("[updateEmail]", error);
      return { ok: false, message: GENERIC_ERROR };
    }
  } catch (error) {
    console.error("[updateEmail]", error);
    return { ok: false, message: GENERIC_ERROR };
  }

  return {
    ok: true,
    message:
      "確認メールを送信しました。新しいメールアドレス宛のリンクを開くと変更が完了します。",
  };
}

/**
 * パスワードを変更する。現在のパスワードで再認証してから更新する。
 */
export async function updatePassword(
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const currentPassword = String(formData.get("current_password") ?? "");
  const newPassword = String(formData.get("new_password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (!newPassword || newPassword.length < 6) {
    return {
      ok: false,
      message: "新しいパスワードは6文字以上で入力してください。",
    };
  }
  if (newPassword !== confirmPassword) {
    return { ok: false, message: "新しいパスワードが一致しません。" };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) {
      return { ok: false, message: GENERIC_ERROR };
    }

    // 現在のパスワードで再認証（なりすまし防止）。
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (signInError) {
      console.error("[updatePassword] reauth", signInError);
      return {
        ok: false,
        message: "現在のパスワードが正しくありません。",
      };
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) {
      console.error("[updatePassword]", error);
      return { ok: false, message: GENERIC_ERROR };
    }
  } catch (error) {
    console.error("[updatePassword]", error);
    return { ok: false, message: GENERIC_ERROR };
  }

  return { ok: true, message: "パスワードを変更しました。" };
}

/**
 * アカウントを削除する。現在パスワードでの再認証＋確認語「削除」一致の
 * 二段で本人確認したうえで、service_role でユーザーを削除 →
 * サインアウト → /login へ遷移する。
 */
export async function deleteAccount(
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const currentPassword = String(formData.get("current_password") ?? "");
  const confirm = String(formData.get("confirm") ?? "").trim();
  if (confirm !== "削除") {
    return {
      ok: false,
      message: "確認のため『削除』と入力してください。",
    };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) {
      return { ok: false, message: GENERIC_ERROR };
    }

    // 現在のパスワードで再認証（なりすまし防止）。再認証＋確認語の二段。
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (signInError) {
      console.error("[deleteAccount] reauth", signInError);
      return {
        ok: false,
        message: "現在のパスワードが正しくありません。",
      };
    }

    const { error } = await createAdminClient().auth.admin.deleteUser(user.id);
    if (error) {
      console.error("[deleteAccount]", error);
      return { ok: false, message: GENERIC_ERROR };
    }

    await supabase.auth.signOut();
  } catch (error) {
    console.error("[deleteAccount]", error);
    return { ok: false, message: GENERIC_ERROR };
  }

  // redirect は内部で例外を投げるため try/catch の外で呼ぶ。
  redirect("/login");
}
