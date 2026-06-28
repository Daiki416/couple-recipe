import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // middleware を主防御とし、ここは防御的フォールバック。
  if (!user) {
    redirect("/login");
  }

  redirect("/recipes");
}
