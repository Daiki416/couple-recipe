import { describe, expect, it } from "vitest";
import { parseSearchParams } from "./searchParams";

describe("parseSearchParams: cooked", () => {
  it('cooked="yes" は true（作ったことある）になる', () => {
    expect(parseSearchParams({ cooked: "yes" }).cooked).toBe(true);
  });

  it('cooked="no" は false（まだ料理してない）になる', () => {
    expect(parseSearchParams({ cooked: "no" }).cooked).toBe(false);
  });

  it("cooked 未指定は null（すべて）になる", () => {
    expect(parseSearchParams({}).cooked).toBeNull();
  });

  it("不正値は null（すべて）にフォールバックする", () => {
    expect(parseSearchParams({ cooked: "maybe" }).cooked).toBeNull();
    expect(parseSearchParams({ cooked: "" }).cooked).toBeNull();
    expect(parseSearchParams({ cooked: "true" }).cooked).toBeNull();
  });

  it("配列で渡された場合は先頭値を採用する", () => {
    expect(parseSearchParams({ cooked: ["yes", "no"] }).cooked).toBe(true);
  });
});
