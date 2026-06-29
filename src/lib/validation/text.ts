// 入力検証で使う文字列ユーティリティ（I/O を持たない純粋関数）。
// 制御文字判定とコードポイント数の単一ソース。
// 各 Server Action / searchParams から import し、検証強度のドリフトを防ぐ。

/**
 * 制御文字を含むかどうかを判定する。
 * C0 制御文字(0x00-0x1F) / DEL(0x7f) / C1 制御文字(0x80-0x9F) を対象とする。
 * @param allowNewlineTab true のとき TAB/LF/CR は許可する（複数行テキスト用）。既定は false。
 */
export function hasControlChar(
  value: string,
  { allowNewlineTab = false }: { allowNewlineTab?: boolean } = {},
): boolean {
  return [...value].some((ch) => {
    const code = ch.codePointAt(0) ?? 0;
    if (allowNewlineTab && (code === 0x09 || code === 0x0a || code === 0x0d)) {
      return false;
    }
    return code <= 0x1f || code === 0x7f || (code >= 0x80 && code <= 0x9f);
  });
}

/** コードポイント数を返す（サロゲートペアを 1 文字として数える）。 */
export function codePointLength(value: string): number {
  return [...value].length;
}
