import { describe, expect, it } from "vitest";
import { extractVideoId, isYoutubeHost } from "./youtube-url";

describe("extractVideoId", () => {
  it.each([
    ["https://www.youtube.com/watch?v=Myqnk5iOb30", "Myqnk5iOb30"],
    ["https://m.youtube.com/watch?v=Myqnk5iOb30", "Myqnk5iOb30"],
    ["https://music.youtube.com/watch?v=Myqnk5iOb30", "Myqnk5iOb30"],
    ["https://youtube.com/watch?v=Myqnk5iOb30", "Myqnk5iOb30"],
    ["https://www.youtube.com/shorts/rjMNV4tdKJw", "rjMNV4tdKJw"],
    ["https://m.youtube.com/shorts/rjMNV4tdKJw", "rjMNV4tdKJw"],
    ["https://youtu.be/rjMNV4tdKJw", "rjMNV4tdKJw"],
    ["https://www.youtube.com/embed/rjMNV4tdKJw", "rjMNV4tdKJw"],
  ])("ID を抽出する: %s", (url, expected) => {
    expect(extractVideoId(url)).toBe(expected);
  });

  it.each([
    "https://example.com/watch?v=Myqnk5iOb30",
    "https://www.youtube.com/",
    "https://www.youtube.com/watch?v=short",
    "not a url",
    "https://notyoutube.com.evil.com/watch?v=Myqnk5iOb30",
  ])("非YouTube/不正は null: %s", (url) => {
    expect(extractVideoId(url)).toBeNull();
  });
});

describe("isYoutubeHost", () => {
  it.each(["youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"])(
    "YouTube 系は true: %s",
    (host) => {
      expect(isYoutubeHost(host)).toBe(true);
    },
  );

  it.each(["example.com", "notyoutube.com.evil.com"])(
    "非YouTube は false: %s",
    (host) => {
      expect(isYoutubeHost(host)).toBe(false);
    },
  );
});
