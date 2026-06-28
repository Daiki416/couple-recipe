import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { parseSearchParams } from "@/app/(app)/recipes/searchParams";
import { RecipeFilter } from "@/components/recipes/RecipeFilter";

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const filters = parseSearchParams(sp);

  const supabase = await createClient();
  // gen types の Args は optional（未指定 = SQL の default null）。
  // 未指定にしたい値は undefined を渡してキー自体を省略する。
  const { data: recipes, error } = await supabase.rpc("search_recipes", {
    p_q: filters.q ?? undefined,
    p_max_time: filters.maxTime ?? undefined,
    p_tags: filters.tags.length ? filters.tags : undefined,
  });

  // エラーを握り潰すと障害が「0件」に化けて気づけないため、明示的に分岐する。
  if (error) {
    console.error("[RecipesPage] search_recipes", error);
  }

  const { data: tg } = await supabase.from("tags").select("name");
  const tagSuggestions = (tg ?? []).map((r) => r.name);

  // キーワード欄のサジェスト（自世帯のレシピ名＋食材名、重複除去）
  const { data: titleRows } = await supabase.from("recipes").select("title");
  const { data: ingRows } = await supabase.from("ingredients").select("name");
  const keywordSuggestions = [
    ...new Set([
      ...(titleRows ?? []).map((r) => r.title),
      ...(ingRows ?? []).map((r) => r.name),
    ]),
  ].slice(0, 500);

  const hasActiveFilter =
    filters.q !== null || filters.maxTime !== null || filters.tags.length > 0;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">レシピ一覧</h1>
        <Link
          href="/recipes/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          新規作成
        </Link>
      </div>

      <RecipeFilter
        tagSuggestions={tagSuggestions}
        keywordSuggestions={keywordSuggestions}
        current={filters}
      />

      {error ? (
        <p className="rounded-md border border-dashed border-red-300 px-4 py-12 text-center text-sm text-red-600 dark:border-red-800 dark:text-red-400">
          レシピの取得に失敗しました。時間をおいて再度お試しください。
        </p>
      ) : !recipes || recipes.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 px-4 py-12 text-center text-sm text-zinc-500 dark:border-zinc-700">
          {hasActiveFilter
            ? "条件に一致するレシピがありません。"
            : "まだレシピがありません。「新規作成」から追加してください。"}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {recipes.map((recipe) => (
            <li
              key={recipe.id}
              className="flex flex-col gap-2 rounded-md border border-zinc-200 px-4 py-3 dark:border-zinc-800"
            >
              <Link
                href={`/recipes/${recipe.id}`}
                className="flex items-center justify-between gap-3 transition-opacity hover:opacity-70"
              >
                <span className="font-medium">{recipe.title}</span>
                <span className="flex items-center gap-3 text-sm text-zinc-500">
                  {recipe.servings !== null && (
                    <span>{recipe.servings}人前</span>
                  )}
                  {recipe.cooking_time_minutes !== null && (
                    <span>{recipe.cooking_time_minutes}分</span>
                  )}
                </span>
              </Link>
              {recipe.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {recipe.tags.map((name) => (
                    <Link
                      key={name}
                      href={`/recipes?tag=${encodeURIComponent(name)}`}
                      className="rounded-full border border-zinc-300 px-2 py-0.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                      {name}
                    </Link>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
