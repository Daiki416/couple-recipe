import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeleteRecipeButton } from "@/components/recipes/DeleteRecipeButton";
import { outlineButtonClass, pillClass } from "@/lib/ui";

/**
 * href として安全に描画できる URL のみを返す（多層防御）。
 * parseRecipeForm を迂回した経路（PostgREST 直叩き等）で
 * javascript: 等のスキームが保存された場合でもリンクを無効化する。
 * http/https 以外は null を返す。
 */
function safeHttpUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? raw : null;
  } catch {
    return null;
  }
}

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: recipe } = await supabase
    .from("recipes")
    .select("*, ingredients(*), recipe_steps(*), recipe_tags(tags(name))")
    .eq("id", id)
    .order("position", { referencedTable: "ingredients", ascending: true })
    .order("position", { referencedTable: "recipe_steps", ascending: true })
    .maybeSingle();

  if (!recipe) {
    notFound();
  }

  const sourceUrl = recipe.source_url ? safeHttpUrl(recipe.source_url) : null;
  const tagNames = recipe.recipe_tags
    .map((rt) => rt.tags?.name)
    .filter((name): name is string => Boolean(name));

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
      <div className="mb-6 flex items-start justify-between gap-4">
        <h1 className="font-round text-2xl font-bold text-ink">
          {recipe.title}
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/recipes/${recipe.id}/edit`}
            className={outlineButtonClass}
          >
            編集
          </Link>
          <DeleteRecipeButton recipeId={recipe.id} />
        </div>
      </div>

      <dl className="mb-6 flex flex-wrap gap-x-8 gap-y-2 text-sm text-ink-soft">
        {recipe.servings !== null && (
          <div className="flex gap-2">
            <dt>人数</dt>
            <dd>{recipe.servings}人前</dd>
          </div>
        )}
        {recipe.cooking_time_minutes !== null && (
          <div className="flex gap-2">
            <dt>調理時間</dt>
            <dd>{recipe.cooking_time_minutes}分</dd>
          </div>
        )}
        {sourceUrl && (
          <div className="flex gap-2">
            <dt>出典</dt>
            <dd>
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-tomato underline"
              >
                リンク
              </a>
            </dd>
          </div>
        )}
      </dl>

      {tagNames.length > 0 && (
        <ul className="mb-6 flex flex-wrap gap-2">
          {tagNames.map((name) => (
            <li key={name}>
              <Link
                href={`/recipes?tag=${encodeURIComponent(name)}`}
                className={`inline-block ${pillClass}`}
              >
                {name}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {recipe.description && (
        <p className="mb-8 whitespace-pre-wrap text-base">
          {recipe.description}
        </p>
      )}

      <section className="mb-8">
        <h2 className="mb-2 font-round text-lg font-bold text-ink">材料</h2>
        {recipe.ingredients.length === 0 ? (
          <p className="text-sm text-ink-soft">登録されていません。</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {recipe.ingredients.map((ingredient) => (
              <li
                key={ingredient.id}
                className="flex justify-between border-b border-line py-1"
              >
                <span>{ingredient.name}</span>
                {ingredient.quantity && (
                  <span className="text-ink-soft">{ingredient.quantity}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-round text-lg font-bold text-ink">手順</h2>
        {recipe.recipe_steps.length === 0 ? (
          <p className="text-sm text-ink-soft">登録されていません。</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {recipe.recipe_steps.map((step, index) => (
              <li key={step.id} className="flex gap-3">
                <span className="shrink-0 font-bold text-ink-soft">
                  {index + 1}.
                </span>
                <span className="whitespace-pre-wrap">{step.body}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
