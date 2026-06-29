import Link from "next/link";
import { SignupForm } from "@/components/auth/SignupForm";

export default function SignupPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-center font-round text-xl font-bold text-ink">
        新規登録
      </h1>
      <SignupForm />
      <p className="text-center text-sm text-ink-soft">
        すでにアカウントをお持ちの方は{" "}
        <Link href="/login" className="font-bold text-tomato">
          ログイン
        </Link>
      </p>
    </div>
  );
}
