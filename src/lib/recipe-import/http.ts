import "server-only";
import dns from "node:dns/promises";
import net from "node:net";
import { isBlockedAddress } from "./ip-guard";

/**
 * 外部 URL を取得する I/O 層。SSRF 対策として取得前・各リダイレクトホップで
 * スキーム検証と DNS 解決後の宛先 IP 検査を行う。
 */

const MAX_BYTES = 3_000_000;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;
const USER_AGENT =
  "FutarigohanBot/1.0 (+https://github.com; recipe import; respect robots)";

/**
 * URL が安全に取得可能か検証する。
 * - scheme は http/https のみ
 * - ホスト名を DNS 解決し、全ての宛先 IP が遮断対象でないこと
 * 違反時は例外を投げる。
 */
export async function assertSafeUrl(raw: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("invalid url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("unsupported scheme");
  }
  const host = url.hostname;
  const literal = host.startsWith("[") ? host.slice(1, -1) : host;
  if (net.isIP(literal)) {
    if (isBlockedAddress(literal)) {
      throw new Error("blocked address");
    }
    return;
  }
  const addresses = await dns.lookup(host, { all: true });
  if (addresses.length === 0) {
    throw new Error("dns resolution failed");
  }
  for (const addr of addresses) {
    if (isBlockedAddress(addr.address)) {
      throw new Error("blocked address");
    }
  }
}

/** content-type / 先頭バイトから charset を推定する。 */
function detectCharset(contentType: string, head: Uint8Array): string {
  const fromHeader = contentType.match(/charset=([\w-]+)/i)?.[1];
  if (fromHeader) {
    return normalizeCharset(fromHeader);
  }
  // 先頭バイトを ASCII とみなして meta charset を探す。
  const ascii = new TextDecoder("ascii").decode(head.slice(0, 2048));
  const metaCharset =
    ascii.match(/<meta[^>]*charset\s*=\s*["']?([\w-]+)/i)?.[1] ??
    ascii.match(/content\s*=\s*["'][^"']*charset=([\w-]+)/i)?.[1];
  return metaCharset ? normalizeCharset(metaCharset) : "utf-8";
}

function normalizeCharset(label: string): string {
  const lower = label.toLowerCase();
  try {
    // 不正なラベルは TextDecoder 生成時に例外。検証のみ行う。
    new TextDecoder(lower);
    return lower;
  } catch {
    return "utf-8";
  }
}

/** レスポンスボディをサイズ上限まで読み取る。 */
async function readLimited(res: Response, maxBytes: number): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("empty body");
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (value) {
      chunks.push(value);
      total += value.length;
      if (total > maxBytes) {
        await reader.cancel();
        break;
      }
    }
  }
  const out = new Uint8Array(Math.min(total, maxBytes));
  let offset = 0;
  for (const chunk of chunks) {
    const remaining = out.length - offset;
    if (remaining <= 0) {
      break;
    }
    const slice = chunk.subarray(0, remaining);
    out.set(slice, offset);
    offset += slice.length;
  }
  return out;
}

/**
 * 安全に HTML テキストを取得する。
 * リダイレクトは手動追跡し各ホップで再検証、HTML 以外・サイズ超過・タイムアウトは弾く。
 */
export async function safeFetchText(initialUrl: string): Promise<string> {
  let currentUrl = initialUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertSafeUrl(currentUrl);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
        },
      });
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) {
        throw new Error("redirect without location");
      }
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    if (!res.ok) {
      throw new Error(`fetch failed: ${res.status}`);
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml\+xml|application\/xml/i.test(contentType)) {
      throw new Error("not html");
    }

    const bytes = await readLimited(res, MAX_BYTES);
    const charset = detectCharset(contentType, bytes);
    return new TextDecoder(charset).decode(bytes);
  }

  throw new Error("too many redirects");
}
