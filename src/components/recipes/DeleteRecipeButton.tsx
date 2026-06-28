"use client";

import { deleteRecipe } from "@/app/(app)/recipes/actions";

type DeleteRecipeButtonProps = {
  recipeId: string;
};

export function DeleteRecipeButton({ recipeId }: DeleteRecipeButtonProps) {
  return (
    <form
      action={deleteRecipe}
      onSubmit={(e) => {
        if (!confirm("このレシピを削除しますか？")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={recipeId} />
      <button
        type="submit"
        className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
      >
        削除
      </button>
    </form>
  );
}
