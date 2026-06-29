import { describe, expect, it } from "vitest";
import { splitPlainIngredient } from "./parsers";
import { parseYoutubeDescription } from "./youtube-parser";

const HARUAN = [
  "はるあんのおいしい料理動画へようこそ♪",
  "",
  "「ほうれん草のドライカレー」",
  "（たっぷり4人分）",
  "ほうれん草1袋",
  "玉ねぎひとつ",
  "オイル大さじ1",
  "合い挽き肉300g",
  "にんにくチューブ小さじ1",
  "トマト缶半分",
  "カレー粉大さじ3",
  "塩小さじ1〜",
  "クリームチーズ50g〜",
  "",
  "ごはんはもちろん、パンでもおいしいよ〜♡",
  "ワンパンカレー作ってみてね✌️",
  "",
  "＊＊＊",
  "",
  "・Instagram・",
  "https://www.instagram.com/haru_fuumi/ ",
  "",
  "・TikTok・",
  "https://www.tiktok.com/@haruanne22",
  "",
  "＊＊＊",
  "",
  "#はるあん料理部",
].join("\n");

const RYUJI = [
  "【至高の麻婆豆腐】",
  "是非お試しください！",
  "",
  "★今回のレシピはこちら↓",
  "ーーーーーーーーーーーーーー",
  "【至高の麻婆豆腐】（１～２人前）",
  "豚挽肉　　　100g",
  "ニンニク　　２かけ",
  "絹豆腐　　１丁分300ｇ",
  "（今回は150gのものを2個使いました）",
  "長ネギ　　1/2本",
  "豆板醤　　大さじ１",
  "甜麵醬　　大さじ１",
  "ラー油　　小さじ２",
  "創味シャンタン　小さじ1弱",
  "酒　　　　大さじ１",
  "醤油　　　小さじ2/3",
  "水　　　　200㏄",
  "塩　　　　ひとつまみほど",
  "胡椒　　　適量",
  "サラダ油　適量",
  "山椒　　　適量",
  "■水溶き片栗粉■",
  "片栗粉大さじ１と水大さじ２で",
  "ーーーーーーーーーーーーーー",
  "動画を見ていただいて楽しんで頂けましたら",
  "高評価＆チャンネル登録お願いします！",
  "ーーーーーーーーーーーーーーーーーーー",
  "料理のおにいさんリュウジです！",
  "◆ホームページ【バズレシピ.com】→　https://bazurecipe.com/",
  "○ツイッター　→　https://twitter.com/ore825",
  "○インスタ　　→    https://www.instagram.com/ryuji_foodlabo",
  "●お仕事の依頼等はこちらまで　→　bazurecipe@gmail.com",
  "",
  "～～書籍のお知らせ～～",
  "",
  "★第7回レシピ本大賞　グランプリ受賞作品★",
  "【ひと口で人間をダメにするウマさ! リュウジ式 悪魔のレシピ】",
  "→　https://www.amazon.co.jp/dp/490904423X",
  "",
  "#至高",
  "#麻婆豆腐",
  "#料理",
  "#バズレシピ",
  "#リュウジレシピ",
].join("\n");

describe("parseYoutubeDescription", () => {
  it("見出し＋箇条書き＋番号付きで材料と手順を分割する", () => {
    const text = [
      "今日のレシピです",
      "",
      "【材料】",
      "・鶏もも肉 300g",
      "・塩 少々",
      "",
      "【作り方】",
      "1. 肉を切る",
      "2. 焼く",
    ].join("\n");
    const result = parseYoutubeDescription(text);

    expect(result.ingredients).toEqual([
      { name: "鶏もも肉", quantity: "300g" },
      { name: "塩", quantity: "少々" },
    ]);
    expect(result.steps).toEqual([{ body: "肉を切る" }, { body: "焼く" }]);
    expect(result.description).toBe("今日のレシピです");
  });

  it("見出しなし・箇条書きのみは材料として拾う", () => {
    const text = ["・玉ねぎ 1個", "・人参 1本"].join("\n");
    const result = parseYoutubeDescription(text);
    expect(result.ingredients).toEqual([
      { name: "玉ねぎ", quantity: "1個" },
      { name: "人参", quantity: "1本" },
    ]);
    expect(result.steps).toEqual([]);
  });

  it("見出しなし・番号付きのみは手順として拾う", () => {
    const text = ["1. 下ごしらえ", "2) 加熱する"].join("\n");
    const result = parseYoutubeDescription(text);
    expect(result.steps).toEqual([
      { body: "下ごしらえ" },
      { body: "加熱する" },
    ]);
    expect(result.ingredients).toEqual([]);
  });

  it("構造化できない場合は全文を説明に格納する", () => {
    const text = "チャンネル登録よろしくお願いします。今日は天気が良いですね。";
    const result = parseYoutubeDescription(text);
    expect(result.ingredients).toEqual([]);
    expect(result.steps).toEqual([]);
    expect(result.description).toBe(text);
  });

  it("材料:/手順: のコロン見出しにも対応する", () => {
    const text = [
      "材料:",
      "・卵 2個",
      "手順:",
      "1. 割る",
    ].join("\n");
    const result = parseYoutubeDescription(text);
    expect(result.ingredients).toEqual([{ name: "卵", quantity: "2個" }]);
    expect(result.steps).toEqual([{ body: "割る" }]);
  });

  it("はるあん実データ: 分量を含む連続行のみ材料として抽出する", () => {
    const result = parseYoutubeDescription(HARUAN);

    const names = result.ingredients.map((i) => i.name);
    expect(names).toEqual([
      "ほうれん草",
      "玉ねぎ",
      "オイル",
      "合い挽き肉",
      "にんにくチューブ",
      "トマト缶",
      "カレー粉",
      "塩",
      "クリームチーズ",
    ]);
    expect(result.ingredients).toHaveLength(9);
    expect(result.steps).toEqual([]);
    expect(result.servings).toBe(4);

    const description = result.description ?? "";
    expect(description).not.toContain("http");
    expect(description).not.toContain("#");
    expect(description).not.toContain("＊＊＊");
    expect(description).not.toContain("Instagram");
    expect(description).not.toContain("TikTok");
  });

  it("リュウジ実データ: 材料を抽出し SNS/宣伝/URL を混入させない", () => {
    const result = parseYoutubeDescription(RYUJI);

    const names = result.ingredients.map((i) => i.name).join("\n");
    for (const expected of [
      "豚挽肉",
      "ニンニク",
      "絹豆腐",
      "長ネギ",
      "豆板醤",
      "山椒",
    ]) {
      expect(names).toContain(expected);
    }

    const noise = /(ツイッター|インスタ|大賞|受賞|http|@)/;
    expect(
      result.ingredients.every((i) => !noise.test(i.name + i.quantity)),
    ).toBe(true);

    expect([1, 2]).toContain(result.servings);
  });

  it("splitPlainIngredient: 分量を含まないノイズ行は null になる", () => {
    expect(splitPlainIngredient("https://www.instagram.com/haru_fuumi/")).toBeNull();
    expect(
      splitPlainIngredient("お仕事の依頼等はこちらまで bazurecipe@gmail.com"),
    ).toBeNull();
    expect(splitPlainIngredient("#麻婆豆腐")).toBeNull();
    expect(splitPlainIngredient("・Instagram・")).toBeNull();
    expect(splitPlainIngredient("＊＊＊")).toBeNull();
    expect(splitPlainIngredient("「料理名」")).toBeNull();
    expect(splitPlainIngredient("２～３人前")).toBeNull();
    expect(splitPlainIngredient("2019年レシピ本大賞入選☆")).toBeNull();
    expect(splitPlainIngredient("グランプリ受賞作品★")).toBeNull();
  });

  it("splitPlainIngredient: 分量を含む行は名前と分量に分割する", () => {
    expect(splitPlainIngredient("ほうれん草1袋")).toEqual({
      name: "ほうれん草",
      quantity: "1袋",
    });
    expect(splitPlainIngredient("合い挽き肉300g")).toEqual({
      name: "合い挽き肉",
      quantity: "300g",
    });
    expect(splitPlainIngredient("にんにくチューブ小さじ1")).toEqual({
      name: "にんにくチューブ",
      quantity: "小さじ1",
    });
    expect(splitPlainIngredient("トマト缶半分")).toEqual({
      name: "トマト缶",
      quantity: "半分",
    });
    expect(splitPlainIngredient("豚挽肉　　　100g")).toEqual({
      name: "豚挽肉",
      quantity: "100g",
    });
    expect(splitPlainIngredient("塩小さじ1〜")).toEqual({
      name: "塩",
      quantity: "小さじ1〜",
    });
  });

  it("散在する単発の分量行は連続要件(2件以上)で拾わない", () => {
    const text = ["メモ書きです", "牛乳 200ml", "また見てね"].join("\n");
    const result = parseYoutubeDescription(text);
    expect(result.ingredients).toEqual([]);
  });
});
