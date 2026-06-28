import { createRecipe } from "@/app/(app)/recipes/actions";
import { RecipeForm } from "@/components/recipes/RecipeForm";
import { createClient } from "@/lib/supabase/server";

export default async function NewRecipePage() {
  const supabase = await createClient();

  const { data: ing } = await supabase.from("ingredients").select("name");
  const ingredientSuggestions = [
    ...new Set((ing ?? []).map((r) => r.name)),
  ].slice(0, 500);

  const { data: tg } = await supabase.from("tags").select("name");
  const tagSuggestions = (tg ?? []).map((r) => r.name);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">レシピを作成</h1>
      </div>
      <RecipeForm
        action={createRecipe}
        ingredientSuggestions={ingredientSuggestions}
        tagSuggestions={tagSuggestions}
      />
    </main>
  );
}
