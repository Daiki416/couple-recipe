import { AppNav } from "@/components/layout/AppNav";
import { Logo } from "@/components/layout/Logo";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      {/* スマホ: トップバー（PC ではサイドバーにロゴを出すため非表示） */}
      <header className="flex items-center justify-center border-b-2 border-ink bg-paper px-4 py-3 md:hidden">
        <Logo />
      </header>
      <AppNav />
      <div className="flex flex-1 flex-col pb-16 md:pb-0">{children}</div>
    </div>
  );
}
