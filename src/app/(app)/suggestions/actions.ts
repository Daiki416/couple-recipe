"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * 保存済みの AI 提案を削除する Server Action。
 * RLS により自世帯の提案のみ削除できる。詳細はサーバログのみに記録する。
 */
export async function deleteSuggestion(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("recipe_suggestions")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[deleteSuggestion]", error);
    return;
  }

  revalidatePath("/suggestions");
}
