import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createRecipeImageStorage } from "@/lib/storage.supabase";
import { updateRecipe } from "@/app/(app)/recipes/actions";
import {
  RecipeForm,
  type RecipeFormValues,
} from "@/components/recipes/RecipeForm";

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: recipe } = await supabase
    .from("recipes")
    .select(
      "*, ingredients(*), recipe_steps(*), recipe_tags(tags(name)), recipe_images(storage_path, position)",
    )
    .eq("id", id)
    .order("position", { referencedTable: "ingredients", ascending: true })
    .order("position", { referencedTable: "recipe_steps", ascending: true })
    .maybeSingle();

  if (!recipe) {
    notFound();
  }

  // 既存メイン画像（position=0）の署名 URL（best-effort）。
  const imagePath =
    recipe.recipe_images.find((img) => img.position === 0)?.storage_path ??
    null;
  let defaultImageUrl: string | undefined;
  if (imagePath) {
    try {
      defaultImageUrl = await createRecipeImageStorage(supabase).getUrl(
        imagePath,
      );
    } catch (error) {
      console.error("[EditRecipePage] signed url", error);
    }
  }

  const { data: ing } = await supabase.from("ingredients").select("name");
  const ingredientSuggestions = [
    ...new Set((ing ?? []).map((r) => r.name)),
  ].slice(0, 500);

  const { data: tg } = await supabase.from("tags").select("name");
  const tagSuggestions = (tg ?? []).map((r) => r.name);

  const defaultValues: RecipeFormValues = {
    title: recipe.title,
    description: recipe.description ?? "",
    note: recipe.note ?? "",
    source_url: recipe.source_url ?? "",
    servings: recipe.servings !== null ? String(recipe.servings) : "",
    cooking_time_minutes:
      recipe.cooking_time_minutes !== null
        ? String(recipe.cooking_time_minutes)
        : "",
    is_cooked: recipe.is_cooked,
    ingredients: recipe.ingredients.map((ingredient) => ({
      name: ingredient.name,
      quantity: ingredient.quantity ?? "",
    })),
    steps: recipe.recipe_steps.map((step) => ({ body: step.body })),
    tags: recipe.recipe_tags
      .map((rt) => rt.tags?.name)
      .filter((name): name is string => Boolean(name)),
  };

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-round text-2xl font-bold text-ink">レシピを編集</h1>
        <Link
          href={`/recipes/${recipe.id}`}
          className="text-sm font-bold text-tomato"
        >
          詳細へ戻る
        </Link>
      </div>
      <RecipeForm
        action={updateRecipe}
        defaultValues={defaultValues}
        recipeId={recipe.id}
        defaultImageUrl={defaultImageUrl}
        ingredientSuggestions={ingredientSuggestions}
        tagSuggestions={tagSuggestions}
      />
    </main>
  );
}
