import { describe, expect, it } from "vitest";
import {
  isBlockedAddress,
  isBlockedIpv4,
  isBlockedIpv6,
  isSafeImageUrl,
} from "./ip-guard";

describe("isBlockedAddress", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "::1",
    "::",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1", // 127.0.0.1 の hex 形式（Node URL の正規化形）
    "::ffff:169.254.169.254",
    "fe80::1",
    "fe90::1",
    "fea0::1",
    "febf::1",
    "fc00::1",
    "fd12::1",
    "ff02::1",
  ])("遮断対象を遮断する: %s", (ip) => {
    expect(isBlockedAddress(ip)).toBe(true);
  });

  it.each([
    "8.8.8.8",
    "1.1.1.1",
    "2606:4700:4700::1111",
    "2001:4860:4860::8888",
  ])("公開アドレスは許可する: %s", (ip) => {
    expect(isBlockedAddress(ip)).toBe(false);
  });

  it("不明な形式は遮断する", () => {
    expect(isBlockedAddress("not-an-ip")).toBe(true);
  });
});

describe("isBlockedIpv4", () => {
  it.each([
    "0.0.0.0",
    "10.0.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "100.64.0.1",
    "224.0.0.1",
  ])("private/予約は遮断する: %s", (ip) => {
    expect(isBlockedIpv4(ip)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "93.184.216.34"])(
    "公開は許可する: %s",
    (ip) => {
      expect(isBlockedIpv4(ip)).toBe(false);
    },
  );
});

describe("isSafeImageUrl", () => {
  it.each(["https://example.com/a.jpg", "http://img.cdn.jp/x.png"])(
    "公開ホストの画像 URL は許可する: %s",
    (url) => {
      expect(isSafeImageUrl(url)).toBe(true);
    },
  );

  it.each([
    "http://localhost/x.png",
    "https://127.0.0.1/x.png",
    "http://192.168.1.1/x.png",
    "http://[::1]/x.png",
    "ftp://example.com/x.png",
    "javascript:alert(1)",
  ])("危険・非対応の URL は拒否する: %s", (url) => {
    expect(isSafeImageUrl(url)).toBe(false);
  });

  it("undefined は拒否する", () => {
    expect(isSafeImageUrl(undefined)).toBe(false);
  });

  it("空文字は拒否する", () => {
    expect(isSafeImageUrl("")).toBe(false);
  });
});

describe("isBlockedIpv6", () => {
  it("hex 形式の IPv4-mapped loopback を遮断する", () => {
    expect(isBlockedIpv6("::ffff:7f00:1")).toBe(true);
  });

  it.each(["fe80::1", "fe90::1", "fea0::1", "febf::1"])(
    "link-local fe80::/10 を遮断する: %s",
    (ip) => {
      expect(isBlockedIpv6(ip)).toBe(true);
    },
  );

  it.each(["2606:4700:4700::1111", "2001:4860:4860::8888"])(
    "公開 IPv6 は許可する: %s",
    (ip) => {
      expect(isBlockedIpv6(ip)).toBe(false);
    },
  );
});
