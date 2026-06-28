"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
  "rounded-md px-3 py-2 text-sm font-medium transition-colors";
const activeClassName =
  "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900";
const inactiveClassName =
  "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800";

export function AppNav() {
  const pathname = usePathname();

  return (
    <>
      {/* PC: 左サイドバー */}
      <nav className="hidden w-56 shrink-0 border-r border-zinc-200 px-3 py-6 md:flex md:flex-col md:gap-1 dark:border-zinc-800">
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
      <nav className="fixed bottom-0 left-0 right-0 z-10 flex border-t border-zinc-200 bg-white md:hidden dark:border-zinc-800 dark:bg-zinc-950">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(pathname, item.href) ? "page" : undefined}
            className={`flex flex-1 items-center justify-center py-3 text-sm font-medium transition-colors ${
              isActive(pathname, item.href)
                ? "text-zinc-900 dark:text-zinc-100"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
