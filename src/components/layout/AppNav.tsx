"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/layout/Logo";

type NavItem = {
  href: string;
  label: string;
};

const navItems: NavItem[] = [
  { href: "/recipes", label: "レシピ一覧" },
  { href: "/recipes/new", label: "新規作成" },
  { href: "/settings", label: "設定" },
];

/**
 * 現在のパスがナビ項目のアクティブ対象かどうかを判定する。
 * 「/recipes/new」を「/recipes」の前方一致で誤判定しないよう、
 * /recipes は完全一致、それ以外は完全一致 or 配下パスで判定する。
 */
function isActive(pathname: string, href: string): boolean {
  if (href === "/recipes") {
    return pathname === "/recipes";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

const baseLinkClassName =
  "rounded-lg px-3 py-2 text-sm font-bold transition-colors";
const activeClassName = "bg-tomato text-white";
const inactiveClassName = "text-ink-soft hover:bg-cream-2";

export function AppNav() {
  const pathname = usePathname();

  return (
    <>
      {/* PC: 左サイドバー */}
      <nav className="hidden w-56 shrink-0 border-r-2 border-line px-3 py-6 md:flex md:flex-col md:gap-1">
        <Logo className="mb-4 px-3 text-lg" />
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(pathname, item.href) ? "page" : undefined}
            className={`${baseLinkClassName} ${
              isActive(pathname, item.href) ? activeClassName : inactiveClassName
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* スマホ: 下部タブバー */}
      <nav className="fixed bottom-0 left-0 right-0 z-10 flex border-t-2 border-line bg-paper md:hidden">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(pathname, item.href) ? "page" : undefined}
            className={`flex flex-1 items-center justify-center py-3 text-sm font-bold transition-colors ${
              isActive(pathname, item.href) ? "text-tomato" : "text-ink-soft"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
