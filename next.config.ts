import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // レシピ写真アップロードの安全弁。
    // 圧縮失敗時は原本を送るため、アプリが許可する画像サイズ
    // （recipe-image.ts の MAX_IMAGE_BYTES = 8MB）より必ず大きくし、
    // multipart/form-data のオーバーヘッド分も見て余裕を持たせる。
    // 不変条件: MAX_IMAGE_BYTES < bodySizeLimit（上限画像でも Server Action 到達前に弾かれない）。
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
