import { describe, expect, it } from "vitest";
import {
  buildRecipeContext,
  normalizeDraft,
  parseAssistantReply,
} from "./normalize";

describe("buildRecipeContext", () => {
  it("材料を recipe_id で紐付け、各レシピ先頭数件に絞る", () => {
    const recipes = [
      {
        id: "r1",
        title: "肉じゃが",
        tags: ["和食"],
        cooking_time_minutes: 40,
      },
    ];
    const ingredients = [
      { recipe_id: "r1", name: "じゃがいも" },
      { recipe_id: "r1", name: "牛肉" },
      { recipe_id: "r1", name: "玉ねぎ" },
      { recipe_id: "r1", name: "にんじん" },
      { recipe_id: "r1", name: "しらたき" },
      { recipe_id: "r1", name: "だし" },
      { recipe_id: "r1", name: "醤油" },
      { recipe_id: "other", name: "無関係" },
    ];
    const [ctx] = buildRecipeContext(recipes, ingredients);
    expect(ctx.id).toBe("r1");
    expect(ctx.title).toBe("肉じゃが");
    expect(ctx.cookingTimeMinutes).toBe(40);
    expect(ctx.ingredients).toHaveLength(6);
    expect(ctx.ingredients).not.toContain("無関係");
  });

  it("レシピ件数の上限を超えたら切り捨てる", () => {
    const recipes = Array.from({ length: 100 }, (_, i) => ({
      id: `r${i}`,
      title: `レシピ${i}`,
      tags: [],
      cooking_time_minutes: null,
    }));
    expect(buildRecipeContext(recipes, []).length).toBe(80);
  });
});

describe("normalizeDraft", () => {
  it("LLM のドラフトを RecipeFormValues へ正規化する", () => {
    const draft = normalizeDraft({
      title: "さっぱり鶏むね",
      description: "暑い日に",
      source_url: "https://evil.example/inject",
      servings: "2",
      cooking_time_minutes: "20",
      ingredients: [
        { name: "鶏むね肉", quantity: "1枚" },
        { name: "", quantity: "捨てる" },
      ],
      steps: [{ body: "切る" }, { body: "" }],
      tags: ["さっぱり", "さっぱり", "鶏"],
    });
    expect(draft.title).toBe("さっぱり鶏むね");
    expect(draft.servings).toBe("2");
    expect(draft.cooking_time_minutes).toBe("20");
    // AI が捏造した URL は信用せず常に空にする。
    expect(draft.source_url).toBe("");
    expect(draft.ingredients).toEqual([{ name: "鶏むね肉", quantity: "1枚" }]);
    expect(draft.steps).toEqual([{ body: "切る" }]);
    // タグは手動運用のため、AI が出しても取り込まず常に空 1 行にする。
    expect(draft.tags).toEqual([""]);
  });

  it("空・範囲外の数値フィールドは空文字にする", () => {
    const draft = normalizeDraft({
      title: "x",
      servings: "0",
      cooking_time_minutes: "99999",
    });
    expect(draft.servings).toBe("");
    expect(draft.cooking_time_minutes).toBe("");
  });

  it("抽出できない項目は空 1 行にする", () => {
    const draft = normalizeDraft({ title: "x" });
    expect(draft.ingredients).toEqual([{ name: "", quantity: "" }]);
    expect(draft.steps).toEqual([{ body: "" }]);
    expect(draft.tags).toEqual([""]);
  });

  it("オブジェクトでない入力でも落ちず空ドラフトを返す", () => {
    const draft = normalizeDraft(null);
    expect(draft.title).toBe("");
    expect(draft.ingredients).toEqual([{ name: "", quantity: "" }]);
  });
});

describe("parseAssistantReply", () => {
  const titles = new Map([
    ["r1", "肉じゃが"],
    ["r2", "鶏の照り焼き"],
  ]);

  it("existing モードは実在 recipeId のみ通し正規タイトルを使う", () => {
    const reply = parseAssistantReply(
      {
        message: "こちらはいかがですか",
        suggestions: [
          { type: "existing", recipeId: "r1", title: "捏造名", reason: "和食です" },
          { type: "existing", recipeId: "ghost", title: "幻", reason: "存在しない" },
          { type: "new", reason: "混ざった", draft: { title: "x" } },
        ],
      },
      "existing",
      titles,
    );
    expect(reply.message).toBe("こちらはいかがですか");
    expect(reply.suggestions).toHaveLength(1);
    const s = reply.suggestions[0];
    expect(s.type).toBe("existing");
    if (s.type === "existing") {
      expect(s.recipeId).toBe("r1");
      // 捏造タイトルではなく DB の正規タイトルを採用する。
      expect(s.title).toBe("肉じゃが");
      expect(s.reason).toBe("和食です");
    }
  });

  it("new モードは new のみ通しドラフトを正規化する", () => {
    const reply = parseAssistantReply(
      {
        message: "新しい提案です",
        suggestions: [
          { type: "new", reason: "条件に合います", draft: { title: "冷やし担々麺" } },
          { type: "existing", recipeId: "r1", title: "肉じゃが", reason: "既存" },
        ],
      },
      "new",
      titles,
    );
    expect(reply.suggestions).toHaveLength(1);
    const s = reply.suggestions[0];
    expect(s.type).toBe("new");
    if (s.type === "new") {
      expect(s.reason).toBe("条件に合います");
      expect(s.draft.title).toBe("冷やし担々麺");
      expect(s.draft.source_url).toBe("");
    }
  });

  it("不正な入力でも落ちず空の応答を返す", () => {
    const reply = parseAssistantReply("not json", "existing", titles);
    expect(reply.suggestions).toEqual([]);
    expect(typeof reply.message).toBe("string");
  });
});
