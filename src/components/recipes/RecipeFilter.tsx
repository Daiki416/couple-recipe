import Link from "next/link";
import type { SearchFilters } from "@/app/(app)/recipes/searchParams";
import {
  activePillClass,
  inputClass,
  labelClass,
  outlineButtonClass,
  pillClass,
  primaryButtonClass,
} from "@/lib/ui";

type RecipeFilterProps = {
  tagSuggestions: string[];
  keywordSuggestions: string[];
  current: SearchFilters;
};

/**
 * 現在の絞り込み（キーワード・調理時間・並び替え・選択中タグ）を保ったまま、
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
  if (current.cooked !== null) {
    params.set("cooked", current.cooked ? "yes" : "no");
  }
  if (current.sort !== "default") {
    params.set("sort", current.sort);
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
    <div className="mb-6 flex flex-col gap-4 rounded-xl border-2 border-line bg-paper px-4 py-4">
      <form method="get" action="/recipes" className="flex flex-col gap-4">
        {/* キーワード/調理時間の検索時に、選択中タグの絞り込みを保持する */}
        {current.tags.map((t) => (
          <input key={t} type="hidden" name="tag" value={t} />
        ))}

        <div className="flex flex-col gap-1">
          <label htmlFor="q" className={labelClass}>
            キーワード（レシピ名・食材名）
          </label>
          <div className="flex flex-col gap-2">
            <input
              id="q"
              type="text"
              name="q"
              maxLength={100}
              list="keyword-suggestions"
              defaultValue={current.q ?? ""}
              className={`${inputClass} w-full`}
            />
            <button type="submit" className={`${primaryButtonClass} self-start`}>
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
            <label htmlFor="max_time" className={labelClass}>
              調理時間（分以下）
            </label>
            <input
              id="max_time"
              type="number"
              name="max_time"
              min={1}
              max={1440}
              defaultValue={current.maxTime ?? ""}
              className={`${inputClass} w-32`}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="cooked" className={labelClass}>
              作ったか
            </label>
            <select
              id="cooked"
              name="cooked"
              defaultValue={
                current.cooked === true
                  ? "yes"
                  : current.cooked === false
                    ? "no"
                    : ""
              }
              className={inputClass + " w-44"}
            >
              <option value="">すべて</option>
              <option value="yes">作ったことある</option>
              <option value="no">まだ料理してない</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="sort" className={labelClass}>
              並び替え
            </label>
            <select
              id="sort"
              name="sort"
              defaultValue={current.sort}
              className={inputClass + " w-44"}
            >
              <option value="default">新着順</option>
              <option value="kana">あいうえお順</option>
              <option value="time">調理時間が短い順</option>
            </select>
          </div>
        </div>
      </form>

      {tagSuggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className={labelClass}>タグ</span>
          <div className="flex flex-wrap gap-2">
            {tagSuggestions.map((name) => {
              const active = current.tags.includes(name);
              return (
                <Link
                  key={name}
                  href={buildTagToggleHref(current, name)}
                  aria-pressed={active}
                  className={active ? activePillClass : pillClass}
                >
                  #{name}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <Link href="/recipes" className={outlineButtonClass}>
          クリア
        </Link>
      </div>
    </div>
  );
}
