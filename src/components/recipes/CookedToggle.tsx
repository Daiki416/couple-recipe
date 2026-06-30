"use client";

import { toggleCooked } from "@/app/(app)/recipes/actions";
import { activePillClass, pillClass } from "@/lib/ui";

type CookedToggleProps = {
  recipeId: string;
  isCooked: boolean;
};

/**
 * レシピ一覧のワンタップ・インライントグル。
 * submit で is_cooked を反転 → Server Action 側で revalidate（楽観更新はしない）。
 */
export function CookedToggle({ recipeId, isCooked }: CookedToggleProps) {
  return (
    <form action={toggleCooked} className="shrink-0">
      <input type="hidden" name="recipe_id" value={recipeId} />
      <input type="hidden" name="next" value={isCooked ? "0" : "1"} />
      <button
        type="submit"
        aria-pressed={isCooked}
        aria-label={
          isCooked ? "作ったことありを解除する" : "作ったことありにする"
        }
        className={isCooked ? activePillClass : pillClass}
      >
        {isCooked ? "作った" : "まだ"}
      </button>
    </form>
  );
}
