/**
 * YouTube の URL 判定・videoId 抽出を行う純粋ロジック（I/O を持たない）。
 * 取り込みオーケストレータ（index.ts）と Data API 層（youtube.ts）から共用する。
 */

/** ホスト名が YouTube 系（youtube.com / youtu.be とそのサブドメイン）か判定する。 */
export function isYoutubeHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === "youtube.com" ||
    h.endsWith(".youtube.com") ||
    h === "youtu.be" ||
    h.endsWith(".youtu.be")
  );
}

function isYoutubeComHost(host: string): boolean {
  return host === "youtube.com" || host.endsWith(".youtube.com");
}

function isYoutuBeHost(host: string): boolean {
  return host === "youtu.be" || host.endsWith(".youtu.be");
}

function isValidId(id: string | undefined): id is string {
  return typeof id === "string" && /^[\w-]{11}$/.test(id);
}

/** 各種 YouTube URL（m./music./www. 等を含む）から videoId を抽出する。 */
export function extractVideoId(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();

  if (isYoutuBeHost(host)) {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return isValidId(id) ? id : null;
  }

  if (isYoutubeComHost(host)) {
    const v = url.searchParams.get("v");
    if (v && isValidId(v)) {
      return v;
    }
    const segments = url.pathname.split("/").filter(Boolean);
    if (
      (segments[0] === "shorts" ||
        segments[0] === "embed" ||
        segments[0] === "v" ||
        segments[0] === "live") &&
      isValidId(segments[1])
    ) {
      return segments[1];
    }
  }

  return null;
}
