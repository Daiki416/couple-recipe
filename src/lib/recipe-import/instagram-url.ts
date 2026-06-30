/**
 * Instagram の URL 判定を行う純粋ロジック（I/O を持たない）。
 * 取り込みオーケストレータ（index.ts）から利用する。
 */

/** ホスト名が Instagram 系（instagram.com とそのサブドメイン）か判定する。 */
export function isInstagramHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "instagram.com" || h.endsWith(".instagram.com");
}
