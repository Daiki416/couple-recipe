import { describe, expect, it } from "vitest";
import {
  clampText,
  compactIngredients,
  compactTags,
  decodeEntities,
  parseIso8601DurationToMinutes,
  parseServings,
  splitIngredient,
  stripHtml,
} from "./parsers";

describe("parseIso8601DurationToMinutes", () => {
  it("時+分を分へ変換する", () => {
    expect(parseIso8601DurationToMinutes("PT1H30M")).toBe(90);
  });

  it("分のみ", () => {
    expect(parseIso8601DurationToMinutes("PT45M")).toBe(45);
  });

  it("時のみ", () => {
    expect(parseIso8601DurationToMinutes("PT2H")).toBe(120);
  });

  it("日を含む", () => {
    expect(parseIso8601DurationToMinutes("P1DT0H")).toBe(1440);
  });

  it("秒は分へ切り捨て", () => {
    expect(parseIso8601DurationToMinutes("PT90S")).toBe(1);
  });

  it("構成要素が無い P/PT は null", () => {
    expect(parseIso8601DurationToMinutes("P")).toBeNull();
    expect(parseIso8601DurationToMinutes("PT")).toBeNull();
  });

  it("不正な文字列は null", () => {
    expect(parseIso8601DurationToMinutes("90分")).toBeNull();
    expect(parseIso8601DurationToMinutes("")).toBeNull();
  });
});

describe("parseServings", () => {
  it("数値", () => {
    expect(parseServings(4)).toBe(4);
  });

  it("人分表記", () => {
    expect(parseServings("4人分")).toBe(4);
  });

  it("範囲表記は先頭の整数", () => {
    expect(parseServings("4〜6人前")).toBe(4);
  });

  it("全角数字", () => {
    expect(parseServings("２人分")).toBe(2);
  });

  it("配列は最初の有効値", () => {
    expect(parseServings(["", "3人分"])).toBe(3);
  });

  it("数値を含まない文字列は null", () => {
    expect(parseServings("適量")).toBeNull();
  });

  it("0 以下や非整数は null", () => {
    expect(parseServings(0)).toBeNull();
    expect(parseServings(1.5)).toBeNull();
  });
});

describe("splitIngredient", () => {
  it("全角空白区切り", () => {
    expect(splitIngredient("鶏もも肉　300g")).toEqual({
      name: "鶏もも肉",
      quantity: "300g",
    });
  });

  it("2 連続半角空白区切り", () => {
    expect(splitIngredient("玉ねぎ  1個")).toEqual({
      name: "玉ねぎ",
      quantity: "1個",
    });
  });

  it("単一空白＋分量らしい末尾は分割", () => {
    expect(splitIngredient("醤油 大さじ2")).toEqual({
      name: "醤油",
      quantity: "大さじ2",
    });
  });

  it("単一空白でも分量らしくなければ分割しない", () => {
    expect(splitIngredient("ベビー リーフ")).toEqual({
      name: "ベビー リーフ",
      quantity: "",
    });
  });

  it("区切りなしは全体を名前に", () => {
    expect(splitIngredient("塩")).toEqual({ name: "塩", quantity: "" });
  });

  it("空文字", () => {
    expect(splitIngredient("   ")).toEqual({ name: "", quantity: "" });
  });
});

describe("stripHtml / decodeEntities", () => {
  it("タグ除去とエンティティデコード", () => {
    expect(stripHtml("<p>塩&amp;胡椒</p>")).toBe("塩&胡椒");
  });

  it("<br> は改行に", () => {
    expect(stripHtml("一つ<br>二つ")).toBe("一つ\n二つ");
  });

  it("数値参照をデコード", () => {
    expect(decodeEntities("&#39;&#x41;")).toBe("'A");
  });

  it("余分な空白を正規化", () => {
    expect(stripHtml("  a   b  ")).toBe("a b");
  });
});

describe("clampText", () => {
  it("上限を超えたらトリム", () => {
    expect(clampText("abcde", 3)).toBe("abc");
  });

  it("サロゲートペアを壊さない", () => {
    expect([...clampText("🍙🍙🍙", 2)].length).toBe(2);
  });
});

describe("compact*", () => {
  it("材料の空名を除去し上限トリム", () => {
    expect(
      compactIngredients([
        { name: "  ", quantity: "1" },
        { name: " 卵 ", quantity: " 2個 " },
      ]),
    ).toEqual([{ name: "卵", quantity: "2個" }]);
  });

  it("タグは空除去と重複除去", () => {
    expect(compactTags([" 和食 ", "和食", "", "簡単"])).toEqual([
      "和食",
      "簡単",
    ]);
  });
});
