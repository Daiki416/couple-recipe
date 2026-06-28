import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/auth/LogoutButton";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // middleware を主防御とし、ここは防御的フォールバック。
  if (!user) {
    redirect("/login");
  }

  const displayName =
    (user.user_metadata?.display_name as string | undefined) ?? user.email;

  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 px-4 py-12">
      <p className="text-lg">
        ログイン中: <span className="font-semibold">{displayName}</span>
      </p>
      <LogoutButton />
    </main>
  );
}
