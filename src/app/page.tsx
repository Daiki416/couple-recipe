import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  // middleware が getUser で検証・リフレッシュ済みのため、
  // ここは存在確認のみ。getClaims で Auth への往復を 1 回減らす。
  const { data } = await supabase.auth.getClaims();

  // middleware を主防御とし、ここは防御的フォールバック。
  if (!data?.claims) {
    redirect("/login");
  }

  redirect("/recipes");
}
