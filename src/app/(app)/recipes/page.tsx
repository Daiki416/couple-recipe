import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createRecipeImageStorage } from "@/lib/storage.supabase";
import {
  parseSearchParams,
  sortRecipes,
} from "@/app/(app)/recipes/searchParams";
import { RecipeFilter } from "@/components/recipes/RecipeFilter";
import { cardClass, pillClass, primaryButtonClass } from "@/lib/ui";

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
  const [
    { data: recipes, error },
    { data: tg },
    { data: titleRows },
    { data: ingRows },
  ] = await Promise.all([
    supabase.rpc("search_recipes", {
      p_q: filters.q ?? undefined,
      p_max_time: filters.maxTime ?? undefined,
      p_tags: filters.tags.length ? filters.tags : undefined,
    }),
    supabase.from("tags").select("name"),
    supabase.from("recipes").select("title"),
    supabase.from("ingredients").select("name"),
  ]);

  // エラーを握り潰すと障害が「0件」に化けて気づけないため、明示的に分岐する。
  if (error) {
    console.error("[RecipesPage] search_recipes", error);
  }

  // クライアント指定の並び替えを適用（非破壊。default はサーバ順を維持）。
  const sorted = recipes ? sortRecipes(recipes, filters.sort) : recipes;

  // 一覧サムネ用に、各レシピのメイン画像（position=0）の署名 URL を一括生成する（N+1 回避）。
  const imageUrlByRecipe = new Map<string, string>();
  if (sorted && sorted.length > 0) {
    const { data: imageRows, error: imageError } = await supabase
      .from("recipe_images")
      .select("recipe_id, storage_path")
      .eq("position", 0)
      .in(
        "recipe_id",
        sorted.map((r) => r.id),
      );
    if (imageError) {
      console.error("[RecipesPage] recipe_images", imageError);
    } else if (imageRows && imageRows.length > 0) {
      try {
        const storage = createRecipeImageStorage(supabase);
        const signed = await storage.getUrls(
          imageRows.map((row) => row.storage_path),
        );
        for (const row of imageRows) {
          const url = signed.get(row.storage_path);
          if (url) {
            imageUrlByRecipe.set(row.recipe_id, url);
          }
        }
      } catch (signError) {
        console.error("[RecipesPage] signed urls", signError);
      }
    }
  }

  const tagSuggestions = (tg ?? []).map((r) => r.name);

  // キーワード欄のサジェスト（自世帯のレシピ名＋食材名、重複除去）
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
        <h1 className="font-round text-2xl font-bold text-ink">レシピ一覧</h1>
        <Link href="/recipes/new" className={primaryButtonClass}>
          新規作成
        </Link>
      </div>

      <RecipeFilter
        tagSuggestions={tagSuggestions}
        keywordSuggestions={keywordSuggestions}
        current={filters}
      />

      {error ? (
        <p className="rounded-xl border-2 border-dashed border-line bg-paper/60 px-4 py-12 text-center text-tomato">
          レシピの取得に失敗しました。時間をおいて再度お試しください。
        </p>
      ) : !sorted || sorted.length === 0 ? (
        <p className="rounded-xl border-2 border-dashed border-line bg-paper/60 px-4 py-12 text-center text-ink-soft">
          {hasActiveFilter
            ? "条件に一致するレシピがありません。"
            : "まだレシピがありません。右上の『新規作成』から、ふたりの一品を追加しましょう。"}
        </p>
      ) : (
        <ul className={`${cardClass} divide-y-2 divide-line`}>
          {sorted.map((recipe) => {
            const thumbUrl = imageUrlByRecipe.get(recipe.id);
            return (
              <li key={recipe.id} className="flex gap-3 px-4 py-3">
                {thumbUrl && (
                  <Link
                    href={`/recipes/${recipe.id}`}
                    className="shrink-0"
                    aria-hidden
                    tabIndex={-1}
                  >
                    {/* private 画像のため next/image ではなく素の img を使う。 */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumbUrl}
                      alt=""
                      className="size-14 rounded-lg border-2 border-line object-cover"
                    />
                  </Link>
                )}
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/recipes/${recipe.id}`}
                    className="group flex items-baseline gap-2"
                  >
                    <span className="min-w-0 font-round font-bold transition-colors group-hover:text-tomato">
                      {recipe.title}
                    </span>
                    {recipe.cooking_time_minutes !== null && (
                      <>
                        <span className="menu-leader" aria-hidden />
                        <span className="shrink-0 font-bold text-mustard">
                          {recipe.cooking_time_minutes}
                          <span className="text-xs">分</span>
                        </span>
                      </>
                    )}
                  </Link>
                  {recipe.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {recipe.tags.map((name) => (
                        <Link
                          key={name}
                          href={`/recipes?tag=${encodeURIComponent(name)}`}
                          className={pillClass}
                        >
                          {name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
