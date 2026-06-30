import Link from "next/link";
import { AppNav } from "@/components/layout/AppNav";
import { Logo } from "@/components/layout/Logo";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      {/* スマホ: トップバー（PC ではサイドバーにロゴを出すため非表示）。
          3 カラムにしてロゴを中央、設定への歯車を右端に置く。 */}
      <header className="grid grid-cols-3 items-center border-b-2 border-ink bg-paper px-4 py-3 md:hidden">
        <div aria-hidden />
        <div className="flex justify-center">
          <Logo />
        </div>
        <div className="flex justify-end">
          <Link
            href="/settings"
            aria-label="設定"
            className="rounded-lg p-1.5 text-ink-soft transition-colors hover:bg-cream-2 hover:text-ink"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            </svg>
          </Link>
        </div>
      </header>
      <AppNav />
      <div className="flex min-w-0 w-full flex-1 flex-col overflow-x-clip pb-16 md:pb-0">
        {children}
      </div>
    </div>
  );
}
