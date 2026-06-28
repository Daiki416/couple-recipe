import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-center text-2xl font-semibold tracking-tight">
        ログイン
      </h1>
      <LoginForm />
      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        アカウントをお持ちでない方は{" "}
        <Link href="/signup" className="font-medium underline">
          新規登録
        </Link>
      </p>
    </div>
  );
}
