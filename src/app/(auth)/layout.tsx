import { Logo } from "@/components/layout/Logo";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Logo className="text-2xl" />
          <p className="text-sm text-ink-soft">
            ふたりで作った、おいしいレシピ帳。
          </p>
        </div>
        <div className="rounded-2xl border-2 border-ink bg-paper p-6 shadow-[4px_4px_0_0_rgba(46,42,38,0.12)]">
          {children}
        </div>
      </div>
    </div>
  );
}
