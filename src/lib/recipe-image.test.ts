import { describe, expect, it } from "vitest";
import {
  MAX_IMAGE_BYTES,
  isAllowedImageMime,
  validateImageFile,
} from "./recipe-image";

describe("isAllowedImageMime", () => {
  it.each(["image/jpeg", "image/png", "image/webp"])(
    "許可 mime は true: %s",
    (mime) => {
      expect(isAllowedImageMime(mime)).toBe(true);
    },
  );

  it.each(["image/gif", "image/svg+xml", "application/pdf", "", "text/plain"])(
    "非許可 mime は false: %s",
    (mime) => {
      expect(isAllowedImageMime(mime)).toBe(false);
    },
  );
});

describe("validateImageFile", () => {
  it.each([
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/webp", "webp"],
  ])("許可 mime は拡張子を導出する: %s", (type, ext) => {
    const result = validateImageFile({ type, size: 1024 });
    expect(result).toEqual({ ok: true, mime: type, ext });
  });

  it("空 File（size 0）は empty", () => {
    const result = validateImageFile({ type: "image/jpeg", size: 0 });
    expect(result).toEqual({ ok: false, reason: "empty" });
  });

  it("非許可 mime は unsupported_type", () => {
    const result = validateImageFile({ type: "image/gif", size: 1024 });
    expect(result).toEqual({ ok: false, reason: "unsupported_type" });
  });

  it("上限ちょうどは許可（境界値）", () => {
    const result = validateImageFile({
      type: "image/jpeg",
      size: MAX_IMAGE_BYTES,
    });
    expect(result.ok).toBe(true);
  });

  it("上限超過は too_large（境界値）", () => {
    const result = validateImageFile({
      type: "image/jpeg",
      size: MAX_IMAGE_BYTES + 1,
    });
    expect(result).toEqual({ ok: false, reason: "too_large" });
  });
});
