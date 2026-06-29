import { describe, expect, it } from "vitest";
import { extractJsonLdRecipe } from "./jsonld";

function script(json: unknown): string {
  return `<html><head><script type="application/ld+json">${JSON.stringify(
    json,
  )}</script></head><body></body></html>`;
}

describe("extractJsonLdRecipe", () => {
  it("単体の Recipe を抽出する", () => {
    const html = script({
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "肉じゃが",
      recipeIngredient: ["じゃがいも 3個", "牛肉 200g"],
      recipeInstructions: ["切る", "煮る"],
      totalTime: "PT40M",
      recipeYield: "4人分",
      image: "https://example.com/a.jpg",
    });
    const recipe = extractJsonLdRecipe(html);
    expect(recipe?.name).toBe("肉じゃが");
    expect(recipe?.ingredients).toEqual(["じゃがいも 3個", "牛肉 200g"]);
    expect(recipe?.instructions).toEqual(["切る", "煮る"]);
    expect(recipe?.totalTime).toBe("PT40M");
    expect(recipe?.recipeYield).toBe("4人分");
    expect(recipe?.image).toBe("https://example.com/a.jpg");
  });

  it("@graph 内の Recipe を抽出する", () => {
    const html = script({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebSite", name: "サイト" },
        { "@type": "Recipe", name: "カレー", recipeIngredient: ["ルー"] },
      ],
    });
    const recipe = extractJsonLdRecipe(html);
    expect(recipe?.name).toBe("カレー");
    expect(recipe?.ingredients).toEqual(["ルー"]);
  });

  it("トップレベル配列と @type 配列ゆれを扱う", () => {
    const html = script([
      { "@type": "BreadcrumbList" },
      { "@type": ["Recipe", "Thing"], name: "味噌汁" },
    ]);
    const recipe = extractJsonLdRecipe(html);
    expect(recipe?.name).toBe("味噌汁");
  });

  it("HowToStep / HowToSection の手順を平坦化する", () => {
    const html = script({
      "@type": "Recipe",
      name: "煮物",
      recipeInstructions: [
        { "@type": "HowToStep", text: "下ごしらえ" },
        {
          "@type": "HowToSection",
          itemListElement: [
            { "@type": "HowToStep", text: "炒める" },
            { "@type": "HowToStep", text: "煮込む" },
          ],
        },
      ],
    });
    const recipe = extractJsonLdRecipe(html);
    expect(recipe?.instructions).toEqual(["下ごしらえ", "炒める", "煮込む"]);
  });

  it("image オブジェクト/配列から URL を取り出す", () => {
    const html = script({
      "@type": "Recipe",
      name: "サラダ",
      image: [{ "@type": "ImageObject", url: "https://example.com/b.jpg" }],
    });
    expect(extractJsonLdRecipe(html)?.image).toBe("https://example.com/b.jpg");
  });

  it("Recipe が無ければ null", () => {
    const html = script({ "@type": "Article", name: "記事" });
    expect(extractJsonLdRecipe(html)).toBeNull();
  });

  it("壊れた JSON-LD はスキップする", () => {
    const html = `<script type="application/ld+json">{ broken</script>${script(
      { "@type": "Recipe", name: "親子丼", recipeIngredient: ["卵"] },
    )}`;
    expect(extractJsonLdRecipe(html)?.name).toBe("親子丼");
  });
});
