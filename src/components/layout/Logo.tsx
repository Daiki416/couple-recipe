import Link from "next/link";

type LogoProps = {
  className?: string;
};

/**
 * アプリ名ロゴ。/recipes へ戻るリンクを兼ねる。
 * 先頭に赤白チェック（ギンガム）の丸マークを添える。
 */
export function Logo({ className }: LogoProps) {
  return (
    <Link
      href="/recipes"
      className={`inline-flex items-center gap-2 whitespace-nowrap font-display text-tomato ${className ?? ""}`}
    >
      <span
        className="inline-block h-5 w-5 rounded-full border-2 border-ink gingham"
        aria-hidden
      />
      ふたりごはん
    </Link>
  );
}
