import Link from "next/link";
import type { SearchFilters } from "@/app/(app)/recipes/searchParams";

type RecipeFilterProps = {
  tagSuggestions: string[];
  current: SearchFilters;
};

const inputClassName =
  "rounded-md border border-zinc-300 px-3 py-2 text-base outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900";

const buttonClassName =
  "rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

const clearLinkClassName =
  "rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";

export function RecipeFilter({ tagSuggestions, current }: RecipeFilterProps) {
  return (
    <form
      method="get"
      action="/recipes"
      className="mb-6 flex flex-col gap-4 rounded-md border border-zinc-200 px-4 py-4 dark:border-zinc-800"
    >
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
            defaultValue={current.q ?? ""}
            className={`${inputClassName} flex-1`}
          />
          <button type="submit" className={buttonClassName}>
            検索
          </button>
        </div>
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

      {tagSuggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">タグ</span>
          <div className="flex flex-wrap gap-3">
            {tagSuggestions.map((name) => (
              <label key={name} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  name="tag"
                  value={name}
                  defaultChecked={current.tags.includes(name)}
                  className="size-4"
                />
                {name}
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <Link href="/recipes" className={clearLinkClassName}>
          クリア
        </Link>
      </div>
    </form>
  );
}
