import type { RecipeFormValues } from "@/components/recipes/RecipeForm";

/**
 * 取り込み元（一般サイト / YouTube）から抽出した中立的な解析結果。
 * 表示や保存に依らないドメイン中立の形で持ち、最終的に
 * import-actions で {@link RecipeFormValues} へ正規化する。
 */
export type ImportedRecipe = {
  title?: string;
  description?: string;
  /** 入力された取り込み元 URL。 */
  sourceUrl: string;
  servings?: number;
  cookingTimeMinutes?: number;
  ingredients: { name: string; quantity: string }[];
  steps: { body: string }[];
  tags?: string[];
  /** 画像候補 URL（表示のみ。Storage には取り込まない）。 */
  imageUrl?: string;
};

/**
 * Server Action `importRecipeFromUrl` の戻り値。
 * 成功時はプリフィル用の {@link RecipeFormValues} を返す。DB 保存はしない。
 */
export type ImportResult =
  | { ok: true; data: RecipeFormValues; imageUrl?: string; warning?: string }
  | { ok: false; error: string };

/**
 * 取り込み失敗時に、ユーザー向けの安全な文言（{@link userMessage}）を
 * 添えて投げるエラー。生のキーや外部 API の生メッセージは含めない。
 */
export class RecipeImportError extends Error {
  constructor(
    public readonly userMessage: string,
    message?: string,
  ) {
    super(message ?? userMessage);
    this.name = "RecipeImportError";
  }
}
