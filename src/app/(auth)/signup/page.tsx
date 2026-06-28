import Link from "next/link";
import { SignupForm } from "@/components/auth/SignupForm";

export default function SignupPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-center text-2xl font-semibold tracking-tight">
        新規登録
      </h1>
      <SignupForm />
      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        すでにアカウントをお持ちの方は{" "}
        <Link href="/login" className="font-medium underline">
          ログイン
        </Link>
      </p>
    </div>
  );
}
