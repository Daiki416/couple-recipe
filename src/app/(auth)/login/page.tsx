import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-center font-round text-xl font-bold text-ink">
        ログイン
      </h1>
      <LoginForm />
      <p className="text-center text-sm text-ink-soft">
        アカウントをお持ちでない方は{" "}
        <Link href="/signup" className="font-bold text-tomato">
          新規登録
        </Link>
      </p>
    </div>
  );
}
