import Link from "next/link";
import type { SearchFilters } from "@/app/(app)/recipes/searchParams";

type RecipeFilterProps = {
  tagSuggestions: string[];
  keywordSuggestions: string[];
  current: SearchFilters;
};

const inputClassName =
  "rounded-md border border-zinc-300 px-3 py-2 text-base outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900";

const buttonClassName =
  "rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

const clearLinkClassName =
  "rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";

const activePillClassName =
  "rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

const pillClassName =
  "rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800";

/**
 * 現在の絞り込み（キーワード・調理時間・選択中タグ）を保ったまま、
 * 指定タグの ON/OFF をトグルした遷移先 URL を組み立てる。
 * これによりタグのピルをタップした瞬間に絞り込みが切り替わる。
 */
function buildTagToggleHref(current: SearchFilters, tag: string): string {
  const params = new URLSearchParams();
  if (current.q) {
    params.set("q", current.q);
  }
  if (current.maxTime !== null) {
    params.set("max_time", String(current.maxTime));
  }
  const nextTags = current.tags.includes(tag)
    ? current.tags.filter((t) => t !== tag)
    : [...current.tags, tag];
  for (const t of nextTags) {
    params.append("tag", t);
  }
  const qs = params.toString();
  return qs ? `/recipes?${qs}` : "/recipes";
}

export function RecipeFilter({
  tagSuggestions,
  keywordSuggestions,
  current,
}: RecipeFilterProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 rounded-md border border-zinc-200 px-4 py-4 dark:border-zinc-800">
      <form method="get" action="/recipes" className="flex flex-col gap-4">
        {/* キーワード/調理時間の検索時に、選択中タグの絞り込みを保持する */}
        {current.tags.map((t) => (
          <input key={t} type="hidden" name="tag" value={t} />
        ))}

        <div className="flex flex-col gap-1">
          <label htmlFor="q" className="text-sm font-medium">
            キーワード（レシピ名・食材名）
          </label>
          <div className="flex gap-2">
            <input
              id="q"
              type="text"
              name="q"
              maxLength={100}
              list="keyword-suggestions"
              defaultValue={current.q ?? ""}
              className={`${inputClassName} flex-1`}
            />
            <button type="submit" className={buttonClassName}>
              検索
            </button>
          </div>
          <datalist id="keyword-suggestions">
            {keywordSuggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>

        <div className="flex flex-wrap gap-6">
          <div className="flex flex-col gap-1">
            <label htmlFor="max_time" className="text-sm font-medium">
              調理時間（分以下）
            </label>
            <input
              id="max_time"
              type="number"
              name="max_time"
              min={1}
              max={1440}
              defaultValue={current.maxTime ?? ""}
              className={`${inputClassName} w-32`}
            />
          </div>
        </div>
      </form>

      {tagSuggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">タグ</span>
          <div className="flex flex-wrap gap-2">
            {tagSuggestions.map((name) => {
              const active = current.tags.includes(name);
              return (
                <Link
                  key={name}
                  href={buildTagToggleHref(current, name)}
                  aria-pressed={active}
                  className={active ? activePillClassName : pillClassName}
                >
                  #{name}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <Link href="/recipes" className={clearLinkClassName}>
          クリア
        </Link>
      </div>
    </div>
  );
}
