import "server-only";
import type { ImportedRecipe } from "./types";
import { extractFromHtml } from "./generic";
import { safeFetchText } from "./http";
import { fetchYoutubeRecipe } from "./youtube";
import { isYoutubeHost } from "./youtube-url";

/**
 * URL を取り込みドメイン中立の {@link ImportedRecipe} を返すオーケストレータ。
 * I/O（fetch）を行う唯一の層。ホスト名で YouTube / 一般サイトを振り分ける。
 */
export async function runImport(rawUrl: string): Promise<ImportedRecipe> {
  const url = new URL(rawUrl);
  if (isYoutubeHost(url.hostname)) {
    return fetchYoutubeRecipe(rawUrl);
  }
  const html = await safeFetchText(rawUrl);
  return extractFromHtml(html, rawUrl);
}
