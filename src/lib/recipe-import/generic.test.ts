import { describe, expect, it } from "vitest";
import { extractFromHtml } from "./generic";

describe("extractFromHtml", () => {
  it("JSON-LD Recipe を優先して構造化抽出する", () => {
    const html = `<html><head>
      <script type="application/ld+json">${JSON.stringify({
        "@type": "Recipe",
        name: "肉じゃが",
        description: "定番の和食",
        recipeIngredient: ["じゃがいも　3個", "牛肉　200g"],
        recipeInstructions: ["材料を切る", "煮込む"],
        totalTime: "PT40M",
        recipeYield: "4人分",
        image: "https://example.com/a.jpg",
        keywords: "和食, 定番",
      })}</script>
      </head><body></body></html>`;
    const result = extractFromHtml(html, "https://example.com/recipe");

    expect(result.title).toBe("肉じゃが");
    expect(result.description).toBe("定番の和食");
    expect(result.sourceUrl).toBe("https://example.com/recipe");
    expect(result.servings).toBe(4);
    expect(result.cookingTimeMinutes).toBe(40);
    expect(result.ingredients).toEqual([
      { name: "じゃがいも", quantity: "3個" },
      { name: "牛肉", quantity: "200g" },
    ]);
    expect(result.steps).toEqual([{ body: "材料を切る" }, { body: "煮込む" }]);
    expect(result.tags).toEqual(["和食", "定番"]);
    expect(result.imageUrl).toBe("https://example.com/a.jpg");
  });

  it("JSON-LD が無ければ OGP / meta でフォールバックする", () => {
    const html = `<html><head>
      <meta property="og:title" content="絶品パスタ" />
      <meta name="description" content="簡単に作れる" />
      <meta property="og:image" content="https://example.com/p.jpg" />
      </head><body></body></html>`;
    const result = extractFromHtml(html, "https://example.com/pasta");

    expect(result.title).toBe("絶品パスタ");
    expect(result.description).toBe("簡単に作れる");
    expect(result.imageUrl).toBe("https://example.com/p.jpg");
    expect(result.ingredients).toEqual([]);
    expect(result.steps).toEqual([]);
  });

  it("OGP が無ければ <title> をタイトルに使う", () => {
    const html = `<html><head><title>わが家のカレー</title></head><body></body></html>`;
    expect(extractFromHtml(html, "https://example.com").title).toBe(
      "わが家のカレー",
    );
  });
});
