import { describe, expect, it } from "vitest";
import {
  cleanCaption,
  extractInstagramCaption,
  normalizeInstagramRecipe,
} from "./instagram-parser";

describe("extractInstagramCaption", () => {
  it("社交プレフィックスを除去して引用本文をアンラップする", () => {
    expect(
      extractInstagramCaption('123 likes, 4 comments - user on June 1, 2026: "本文"'),
    ).toBe("本文");
  });

  it("カンマ区切り数値・大文字 Likes でも除去する", () => {
    expect(
      extractInstagramCaption(
        '1,234 Likes, 56 Comments - cook on December 31, 2025: "材料と作り方"',
      ),
    ).toBe("材料と作り方");
  });

  it("プレフィックス無しの素テキストはそのまま返す", () => {
    expect(extractInstagramCaption("ただのキャプション")).toBe(
      "ただのキャプション",
    );
  });
});

describe("cleanCaption", () => {
  it("末尾の連続ハッシュタグを除去し本文中は温存する", () => {
    expect(
      cleanCaption("カレーの作り方 #料理 を紹介 #recipe #ごはん ＃時短"),
    ).toBe("カレーの作り方 #料理 を紹介");
  });

  it("前後をトリムする", () => {
    expect(cleanCaption("  本文  ")).toBe("本文");
  });
});

describe("normalizeInstagramRecipe", () => {
  it("正常な JSON を中立フィールドへ正規化する", () => {
    const fields = normalizeInstagramRecipe({
      title: "トマトパスタ",
      description: "",
      servings: "2人分",
      cooking_time_minutes: "20",
      ingredients: [
        { name: "パスタ", quantity: "200g" },
        { name: "", quantity: "適量" },
      ],
      steps: [{ body: "茹でる" }, { body: "" }],
    });
    expect(fields.title).toBe("トマトパスタ");
    expect(fields.description).toBeUndefined();
    expect(fields.servings).toBe(2);
    expect(fields.cookingTimeMinutes).toBe(20);
    expect(fields.ingredients).toEqual([{ name: "パスタ", quantity: "200g" }]);
    expect(fields.steps).toEqual([{ body: "茹でる" }]);
  });

  it("欠損・不正型でも落ちず空配列 / undefined にする", () => {
    const fields = normalizeInstagramRecipe({
      ingredients: "not-array",
      servings: 0,
      cooking_time_minutes: "9999",
    });
    expect(fields.title).toBeUndefined();
    expect(fields.description).toBeUndefined();
    expect(fields.servings).toBeUndefined();
    expect(fields.cookingTimeMinutes).toBeUndefined();
    expect(fields.ingredients).toEqual([]);
    expect(fields.steps).toEqual([]);
  });

  it("非オブジェクトでも落ちない", () => {
    const fields = normalizeInstagramRecipe(null);
    expect(fields.ingredients).toEqual([]);
    expect(fields.steps).toEqual([]);
  });
});
