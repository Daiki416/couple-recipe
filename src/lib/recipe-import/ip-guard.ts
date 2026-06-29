import net from "node:net";

/**
 * 宛先 IP が遮断対象（private / loopback / link-local / mapped IPv4 等）かを判定する
 * 純粋ロジック。I/O を持たず、SSRF ガード（http.ts）から利用する。
 * net.isIP に通る正規形の文字列を前提とする（URL 正規化は呼び出し側の責務）。
 */

/** IPv4 文字列が遮断対象（private / loopback / link-local 等）か判定する。 */
export function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10/8
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local (169.254.169.254 含む)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true; // 192.168/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a === 192 && b === 0) return true; // 192.0.0/24, 192.0.2/24
  if (a === 198 && (b === 18 || b === 19)) return true; // ベンチマーク 198.18/15
  if (a === 198 && b === 51) return true; // TEST-NET-2 198.51.100/24
  if (a === 203 && b === 0) return true; // TEST-NET-3 203.0.113/24
  if (a >= 224) return true; // multicast / reserved 224/4, 240/4, 255.255.255.255
  return false;
}

/** 16 進グループ 2 つ（::ffff:HHHH:HHHH）を IPv4 ドット表記へ変換する。 */
function hexGroupsToIpv4(g1: string, g2: string): string {
  const high = Number.parseInt(g1, 16);
  const low = Number.parseInt(g2, 16);
  return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
}

/** IPv6 文字列が遮断対象か判定する（mapped IPv4 は埋め込み v4 を再検査）。 */
export function isBlockedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true; // loopback / unspecified

  // IPv4-mapped / IPv4-compatible（ドット表記）: ::ffff:a.b.c.d
  const dotted = lower.match(/(?:::ffff:|::)(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    return isBlockedIpv4(dotted[1]);
  }
  // IPv4-mapped（hex 表記）: ::ffff:HHHH:HHHH（Node の URL は ::ffff:7f00:1 に正規化する）
  const hex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    return isBlockedIpv4(hexGroupsToIpv4(hex[1], hex[2]));
  }

  if (/^fe[89ab]/.test(lower)) return true; // link-local fe80::/10 (fe80〜febf)
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA fc00::/7
  if (lower.startsWith("ff")) return true; // multicast
  return false;
}

/** net.isIP で v4/v6 を振り分けて遮断判定する。不明な形式は遮断する。 */
export function isBlockedAddress(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return isBlockedIpv4(ip);
  if (family === 6) return isBlockedIpv6(ip);
  return true; // 不明な形式は遮断
}

/**
 * 外部 HTML 由来の画像 URL をクライアントで自動ロードしてよいか判定する純粋関数。
 * http/https のみを許可し、localhost / *.local / private・loopback 等の IP を除外する。
 * （クライアント側 SSRF / トラッキング抑止のための事前フィルタ）
 */
export function isSafeImageUrl(url: string | undefined | null): boolean {
  if (!url) {
    return false;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname === "local" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".localhost")
  ) {
    return false;
  }

  // IPv6 リテラルは URL.hostname で角括弧を保ったまま返るため取り除く。
  const host =
    hostname.startsWith("[") && hostname.endsWith("]")
      ? hostname.slice(1, -1)
      : hostname;
  if (net.isIP(host) > 0) {
    return !isBlockedAddress(host);
  }

  return true;
}
