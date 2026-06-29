import "server-only";
import { RecipeImportError, type ImportedRecipe } from "./types";
import { clampText, LIMITS, stripHtml } from "./parsers";
import { parseYoutubeDescription } from "./youtube-parser";
import { extractVideoId } from "./youtube-url";

/**
 * YouTube Data API v3 を使って概要欄からレシピを取り込む I/O 層。
 * API キーや生レスポンスはクライアントへ返さない。失敗時は RecipeImportError を投げ、
 * その userMessage を import-actions 側がユーザー向け文言として利用する。
 */

const TIMEOUT_MS = 10_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

type YoutubeSnippet = {
  title?: string;
  description?: string;
  thumbnail?: string;
};

/** Data API のレスポンスから snippet を型ガードで取り出す。 */
function extractSnippet(json: unknown): YoutubeSnippet | null {
  if (!isRecord(json) || !Array.isArray(json.items) || json.items.length === 0) {
    return null;
  }
  const item = json.items[0];
  if (!isRecord(item) || !isRecord(item.snippet)) {
    return null;
  }
  const snippet = item.snippet;
  let thumbnail: string | undefined;
  if (isRecord(snippet.thumbnails)) {
    for (const key of ["maxres", "standard", "high", "medium", "default"]) {
      const entry = snippet.thumbnails[key];
      if (isRecord(entry) && typeof entry.url === "string") {
        thumbnail = entry.url;
        break;
      }
    }
  }
  return {
    title: asString(snippet.title),
    description: asString(snippet.description),
    thumbnail,
  };
}

/** YouTube 動画概要欄から ImportedRecipe を構築する。 */
export async function fetchYoutubeRecipe(url: string): Promise<ImportedRecipe> {
  const videoId = extractVideoId(url);
  if (!videoId) {
    throw new RecipeImportError(
      "YouTube の URL を認識できませんでした。",
      "invalid youtube url",
    );
  }
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new RecipeImportError(
      "サーバーに YouTube API キーが設定されていません。",
      "YOUTUBE_API_KEY missing",
    );
  }

  const endpoint = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${encodeURIComponent(
    videoId,
  )}&key=${encodeURIComponent(apiKey)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let json: unknown;
  try {
    const res = await fetch(endpoint, { signal: controller.signal });
    if (!res.ok) {
      throw new RecipeImportError(
        `YouTube API がエラーを返しました（${res.status}）。`,
        `youtube api error: ${res.status}`,
      );
    }
    json = await res.json();
  } finally {
    clearTimeout(timer);
  }

  const snippet = extractSnippet(json);
  if (!snippet) {
    throw new RecipeImportError(
      "動画情報を取得できませんでした。URL をご確認ください。",
      "youtube video not found",
    );
  }

  const parsed = parseYoutubeDescription(snippet.description ?? "");
  return {
    title: snippet.title
      ? clampText(stripHtml(snippet.title), LIMITS.TITLE)
      : undefined,
    description: parsed.description,
    sourceUrl: url,
    servings: parsed.servings,
    ingredients: parsed.ingredients,
    steps: parsed.steps,
    imageUrl: snippet.thumbnail,
  };
}
