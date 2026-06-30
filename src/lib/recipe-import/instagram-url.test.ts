import { describe, expect, it } from "vitest";
import { isInstagramHost } from "./instagram-url";

describe("isInstagramHost", () => {
  it.each(["instagram.com", "www.instagram.com"])(
    "Instagram 系は true: %s",
    (host) => {
      expect(isInstagramHost(host)).toBe(true);
    },
  );

  it.each(["youtube.com", "notinstagram.com.evil.com"])(
    "非Instagram は false: %s",
    (host) => {
      expect(isInstagramHost(host)).toBe(false);
    },
  );
});
