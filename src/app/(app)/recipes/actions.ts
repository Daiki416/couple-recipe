"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { codePointLength, hasControlChar } from "@/lib/validation/text";
import { createRecipeImageStorage } from "@/lib/storage.supabase";
import { validateImageFile } from "@/lib/recipe-image";

export type RecipeFormState = {
  error: string;
} | null;

// 入力長の上限（コードポイント単位）
const TITLE_MAX = 100;
const DESCRIPTION_MAX = 2000;
const NOTE_MAX = 2000;
const SOURCE_URL_MAX = 2000;
const INGREDIENT_NAME_MAX = 100;
const INGREDIENT_QUANTITY_MAX = 100;
const STEP_BODY_MAX = 2000;
const TAG_NAME_MAX = 30;
const TAG_MAX_COUNT = 20;

// 調理時間（分）の許容範囲
const COOKING_TIME_MIN = 1;
const COOKING_TIME_MAX = 1440;

// recipe_suggestions.id（UUID v4）の形式。採用時の削除対象を検証する。
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** parseRecipeForm の整形済みデータ。RPC の jsonb 引数にそのまま渡せる形。 */
type ParsedRecipe = {
  recipe: {
    title: string;
    description: string | null;
    note: string | null;
    source_url: string | null;
    servings: number | null;
    cooking_time_minutes: number | null;
    is_cooked: boolean;
  };
  ingredients: { name: string; quantity: string | null }[];
  steps: { body: string }[];
  tags: string[];
};

type ParseRecipeFormResult =
  | { ok: true; data: ParsedRecipe }
  | { ok: false; error: string };

/**
 * 任意整数フィールドの検証。空文字は null、範囲外/非整数は不正とする。
 */
function parseOptionalInt(
  raw: string,
  min: number,
  max: number,
): { ok: true; value: number | null } | { ok: false } {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: true, value: null };
  }
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false };
  }
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < min || value > max) {
    return { ok: false };
  }
  return { ok: true, value };
}

/**
 * レシピフォームの入力検証を行うローカル純粋関数（I/O を持たない）。
 * 詳細フォームのためユーザー列挙リスクはなく、NG 時は具体的な文言を返す。
 */
function parseRecipeForm(formData: FormData): ParseRecipeFormResult {
  // title: 必須・最大長・制御文字（改行含む）不可
  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    return { ok: false, error: "タイトルを入力してください。" };
  }
  if (
    codePointLength(title) > TITLE_MAX ||
    hasControlChar(title, { allowNewlineTab: false })
  ) {
    return {
      ok: false,
      error: `タイトルは${TITLE_MAX}文字以内で入力してください。`,
    };
  }

  // description: 任意・最大長・改行/タブのみ許可
  const description = String(formData.get("description") ?? "");
  if (
    codePointLength(description) > DESCRIPTION_MAX ||
    hasControlChar(description, { allowNewlineTab: true })
  ) {
    return {
      ok: false,
      error: `説明は${DESCRIPTION_MAX}文字以内で入力してください。`,
    };
  }

  // note（メモ）: 任意・最大長・改行/タブのみ許可（description と同じ作法）
  const note = String(formData.get("note") ?? "");
  if (
    codePointLength(note) > NOTE_MAX ||
    hasControlChar(note, { allowNewlineTab: true })
  ) {
    return {
      ok: false,
      error: `メモは${NOTE_MAX}文字以内で入力してください。`,
    };
  }

  // source_url: 任意・最大長・http/https 形式のみ
  const sourceUrl = String(formData.get("source_url") ?? "").trim();
  if (sourceUrl !== "") {
    if (
      codePointLength(sourceUrl) > SOURCE_URL_MAX ||
      !/^https?:\/\/\S+$/.test(sourceUrl)
    ) {
      return {
        ok: false,
        error: "出典 URL は http(s):// から始まる形式で入力してください。",
      };
    }
  }

  // servings: 任意・整数・1〜99
  const servingsResult = parseOptionalInt(
    String(formData.get("servings") ?? ""),
    1,
    99,
  );
  if (!servingsResult.ok) {
    return { ok: false, error: "人数は 1〜99 の整数で入力してください。" };
  }

  // cooking_time_minutes: 任意・整数・1〜1440 分
  const cookingTimeResult = parseOptionalInt(
    String(formData.get("cooking_time_minutes") ?? ""),
    COOKING_TIME_MIN,
    COOKING_TIME_MAX,
  );
  if (!cookingTimeResult.ok) {
    return {
      ok: false,
      error: `調理時間は ${COOKING_TIME_MIN}〜${COOKING_TIME_MAX} 分で入力してください。`,
    };
  }

  // 材料: name と quantity を index 対応で読み取り、name 空行は除去
  const ingredientNames = formData
    .getAll("ingredient_name")
    .map((v) => String(v));
  const ingredientQuantities = formData
    .getAll("ingredient_quantity")
    .map((v) => String(v));

  const ingredients: ParsedRecipe["ingredients"] = [];
  for (let i = 0; i < ingredientNames.length; i++) {
    const name = ingredientNames[i].trim();
    if (name === "") {
      continue;
    }
    if (
      codePointLength(name) > INGREDIENT_NAME_MAX ||
      hasControlChar(name, { allowNewlineTab: false })
    ) {
      return {
        ok: false,
        error: `材料名は${INGREDIENT_NAME_MAX}文字以内で入力してください。`,
      };
    }
    const rawQuantity = (ingredientQuantities[i] ?? "").trim();
    if (
      codePointLength(rawQuantity) > INGREDIENT_QUANTITY_MAX ||
      hasControlChar(rawQuantity, { allowNewlineTab: false })
    ) {
      return {
        ok: false,
        error: `分量は${INGREDIENT_QUANTITY_MAX}文字以内で入力してください。`,
      };
    }
    ingredients.push({
      name,
      quantity: rawQuantity === "" ? null : rawQuantity,
    });
  }

  // 手順: body 空行は除去
  const stepBodies = formData.getAll("step_body").map((v) => String(v));
  const steps: ParsedRecipe["steps"] = [];
  for (const raw of stepBodies) {
    const body = raw.trim();
    if (body === "") {
      continue;
    }
    if (
      codePointLength(body) > STEP_BODY_MAX ||
      hasControlChar(body, { allowNewlineTab: true })
    ) {
      return {
        ok: false,
        error: `手順は${STEP_BODY_MAX}文字以内で入力してください。`,
      };
    }
    steps.push({ body });
  }

  // タグ: 空除去 → 各タグの長さ/制御文字検証 → 重複除去 → 件数上限
  const tags: string[] = [];
  const seenTags = new Set<string>();
  for (const raw of formData.getAll("tag").map((v) => String(v))) {
    const name = raw.trim();
    if (name === "") {
      continue;
    }
    if (
      codePointLength(name) > TAG_NAME_MAX ||
      hasControlChar(name, { allowNewlineTab: false })
    ) {
      return {
        ok: false,
        error: `タグは${TAG_NAME_MAX}文字以内で入力してください。`,
      };
    }
    if (seenTags.has(name)) {
      continue;
    }
    seenTags.add(name);
    tags.push(name);
  }
  if (tags.length > TAG_MAX_COUNT) {
    return {
      ok: false,
      error: `タグは${TAG_MAX_COUNT}個以内で登録してください。`,
    };
  }

  return {
    ok: true,
    data: {
      recipe: {
        title,
        description: description.trim() === "" ? null : description,
        note: note.trim() === "" ? null : note,
        source_url: sourceUrl === "" ? null : sourceUrl,
        servings: servingsResult.value,
        cooking_time_minutes: cookingTimeResult.value,
        // チェックボックスは未チェック時に name 自体が送られないため、値ではなく
        // キーの有無で真偽を判定する（"on" などの値に依存しない）。
        is_cooked: formData.get("is_cooked") != null,
      },
      ingredients,
      steps,
      tags,
    },
  };
}

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

/**
 * FormData の image を取り出す。未指定 / 空 File（size 0）は null。
 * 「画像なし」と「空送信」を区別するため size 0 を弾く。
 */
function getUploadFile(formData: FormData): File | null {
  const value = formData.get("image");
  if (!(value instanceof File) || value.size === 0) {
    return null;
  }
  return value;
}

/** 既存メイン画像の特定削除に使う最小情報（id で確実に行を特定する）。 */
type MainImageRef = { id: string; storage_path: string };

/**
 * レシピにメイン画像（position=0）を保存する（best-effort）。
 * 検証 NG / Storage / DB 失敗時はサーバログのみで、レシピ処理は継続する。
 * 戻り値は「行の挿入まで完全に成功したか」。差し替え時に旧画像を消すかの判断に使う。
 */
async function saveRecipeImage(
  supabase: ServerSupabase,
  recipeId: string,
  file: File,
): Promise<boolean> {
  const validation = validateImageFile(file);
  if (!validation.ok) {
    console.error("[saveRecipeImage] invalid file", validation.reason);
    return false;
  }

  const { data: householdId, error: householdError } = await supabase.rpc(
    "current_household_id",
  );
  if (householdError || !householdId) {
    console.error("[saveRecipeImage] household", householdError);
    return false;
  }

  const path = `${householdId}/${recipeId}/${crypto.randomUUID()}.${validation.ext}`;
  const storage = createRecipeImageStorage(supabase);
  try {
    await storage.upload(file, path);
  } catch (error) {
    console.error("[saveRecipeImage] upload", error);
    return false;
  }

  const { error: insertError } = await supabase
    .from("recipe_images")
    .insert({ recipe_id: recipeId, storage_path: path, position: 0 });
  if (insertError) {
    console.error("[saveRecipeImage] insert", insertError);
    // 行が作れなかった場合は orphan を残さないよう掃除する（best-effort）。
    try {
      await storage.remove(path);
    } catch (cleanupError) {
      console.error("[saveRecipeImage] cleanup", cleanupError);
    }
    return false;
  }
  return true;
}

/**
 * レシピの既存メイン画像（position=0）を控える（差し替え時の旧画像削除に使う）。
 * 取得失敗時は空配列を返し、旧画像には触れない（既存写真を維持する）。
 */
async function fetchMainImages(
  supabase: ServerSupabase,
  recipeId: string,
): Promise<MainImageRef[]> {
  const { data, error } = await supabase
    .from("recipe_images")
    .select("id, storage_path")
    .eq("recipe_id", recipeId)
    .eq("position", 0);
  if (error) {
    console.error("[fetchMainImages] select", error);
    return [];
  }
  return data ?? [];
}

/**
 * 控えておいたメイン画像を Storage と行から削除する（best-effort）。
 * 行は id で特定して消す（position=0 一括ではなく旧行のみを確実に削除する）。
 */
async function deleteMainImages(
  supabase: ServerSupabase,
  images: MainImageRef[],
): Promise<void> {
  if (images.length === 0) {
    return;
  }

  const storage = createRecipeImageStorage(supabase);
  for (const image of images) {
    try {
      await storage.remove(image.storage_path);
    } catch (storageError) {
      console.error("[deleteMainImages] storage", storageError);
    }
  }

  const { error: deleteError } = await supabase
    .from("recipe_images")
    .delete()
    .in(
      "id",
      images.map((image) => image.id),
    );
  if (deleteError) {
    console.error("[deleteMainImages] delete", deleteError);
  }
}

/**
 * レシピの既存メイン画像（position=0）を Storage と行から削除する（best-effort）。
 * remove_image=1（削除のみ）のパスで使う。
 */
async function removeRecipeImage(
  supabase: ServerSupabase,
  recipeId: string,
): Promise<void> {
  await deleteMainImages(supabase, await fetchMainImages(supabase, recipeId));
}

/**
 * レシピを新規作成する Server Action。
 * 成功時は詳細ページへ redirect する。
 */
export async function createRecipe(
  _prevState: RecipeFormState,
  formData: FormData,
): Promise<RecipeFormState> {
  const parsed = parseRecipeForm(formData);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_recipe", {
    p_recipe: parsed.data.recipe,
    p_ingredients: parsed.data.ingredients,
    p_steps: parsed.data.steps,
    p_tags: parsed.data.tags,
  });

  if (error) {
    // 詳細はサーバログのみに記録し、ユーザーには汎用文言を返す。
    console.error("[createRecipe]", error);
    return { error: "レシピの保存に失敗しました。時間をおいて再度お試しください。" };
  }

  // AI 提案から採用した場合は、元の提案を削除する（best-effort・RLS スコープ）。
  // 失敗してもレシピ作成は成功扱いとし、詳細はサーバログのみに記録する。
  // suggestion_id は hidden input 由来で改ざんされ得るため、UUID 形式のみ受け付ける
  // （不正値は無視。DB エラーとログ汚染を防ぐ）。
  const suggestionId = String(formData.get("suggestion_id") ?? "").trim();
  if (UUID_RE.test(suggestionId)) {
    const { error: deleteError } = await supabase
      .from("recipe_suggestions")
      .delete()
      .eq("id", suggestionId);
    if (deleteError) {
      console.error("[createRecipe] delete suggestion", deleteError);
    } else {
      revalidatePath("/suggestions");
    }
  }

  // メイン画像があれば保存（best-effort・失敗してもレシピ作成は成功扱い）。
  const imageFile = getUploadFile(formData);
  if (imageFile) {
    await saveRecipeImage(supabase, String(data), imageFile);
  }

  revalidatePath("/recipes");
  // redirect は内部で例外を投げるため try/catch の外で呼ぶ。
  redirect(`/recipes/${data}`);
}

/**
 * 既存レシピを更新する Server Action。
 * 成功時は詳細ページへ redirect する。
 */
export async function updateRecipe(
  _prevState: RecipeFormState,
  formData: FormData,
): Promise<RecipeFormState> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return { error: "レシピの保存に失敗しました。時間をおいて再度お試しください。" };
  }

  const parsed = parseRecipeForm(formData);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_recipe", {
    p_id: id,
    p_recipe: parsed.data.recipe,
    p_ingredients: parsed.data.ingredients,
    p_steps: parsed.data.steps,
    p_tags: parsed.data.tags,
  });

  if (error) {
    console.error("[updateRecipe]", error);
    return { error: "レシピの保存に失敗しました。時間をおいて再度お試しください。" };
  }

  // 画像の差し替え / 削除（best-effort）。
  // 差し替え時は、新画像が「検証→アップロード→行挿入」まで完全に成功してから
  // 旧画像を削除する。途中で失敗したら旧画像には一切触れず、既存の正常な写真を
  // 維持する（新旧の position=0 が一瞬併存しても、旧行は id で特定削除する）。
  // 新画像が無く remove_image=1 のときは単純に既存画像を削除する。
  const imageFile = getUploadFile(formData);
  const removeImage = String(formData.get("remove_image") ?? "") === "1";
  if (imageFile) {
    const previousImages = await fetchMainImages(supabase, id);
    const saved = await saveRecipeImage(supabase, id, imageFile);
    if (saved) {
      await deleteMainImages(supabase, previousImages);
    }
  } else if (removeImage) {
    await removeRecipeImage(supabase, id);
  }

  revalidatePath("/recipes");
  revalidatePath(`/recipes/${id}`);
  redirect(`/recipes/${id}`);
}

/**
 * レシピを削除する Server Action。
 * RLS により自世帯のレシピのみ削除でき、子テーブルは cascade で消える。
 */
export async function deleteRecipe(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return;
  }

  const supabase = await createClient();

  // レシピ削除前に Storage の画像を掃除する（行は cascade で消える）。
  // 掃除に失敗してもレシピ削除は続行する（best-effort）。
  const { data: imageRows } = await supabase
    .from("recipe_images")
    .select("storage_path")
    .eq("recipe_id", id);
  if (imageRows && imageRows.length > 0) {
    const storage = createRecipeImageStorage(supabase);
    for (const row of imageRows) {
      try {
        await storage.remove(row.storage_path);
      } catch (storageError) {
        console.error("[deleteRecipe] storage", storageError);
      }
    }
  }

  const { error } = await supabase.from("recipes").delete().eq("id", id);

  if (error) {
    console.error("[deleteRecipe]", error);
    return;
  }

  revalidatePath("/recipes");
  redirect("/recipes");
}

/**
 * 一覧のインライントグル用 Server Action。
 * 「作ったことがある」フラグ（is_cooked）を切り替える。
 * RLS により自世帯のレシピのみ更新でき、エラーはサーバログのみに記録する
 * （ユーザーには出さない・redirect しない）。
 */
export async function toggleCooked(formData: FormData) {
  const id = String(formData.get("recipe_id") ?? "").trim();
  // hidden 由来で改ざんされ得るため UUID 形式のみ受け付ける（不正値は無視）。
  if (!UUID_RE.test(id)) {
    return;
  }
  const next = String(formData.get("next") ?? "") === "1";

  const supabase = await createClient();
  const { error } = await supabase
    .from("recipes")
    .update({ is_cooked: next })
    .eq("id", id);

  if (error) {
    console.error("[toggleCooked]", error);
    return;
  }

  revalidatePath("/recipes");
}
