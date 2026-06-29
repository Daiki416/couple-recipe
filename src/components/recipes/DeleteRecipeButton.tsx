"use client";

import { deleteRecipe } from "@/app/(app)/recipes/actions";
import { dangerButtonClass } from "@/lib/ui";

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
      <button type="submit" className={dangerButtonClass}>
        削除
      </button>
    </form>
  );
}
