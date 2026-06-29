import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ふたりごはん",
  description: "ふたりで作った、おいしいレシピ帳。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- JPフォント(Reggae One/Zen Maru/Zen Kaku)の字形欠けを避けるため意図的に<link>方式を採用 */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Reggae+One&family=Zen+Kaku+Gothic+New:wght@400;500;700&family=Zen+Maru+Gothic:wght@500;700&display=swap"
        />
      </head>
      <body className="flex min-h-full flex-col bg-cream text-ink">
        {children}
      </body>
    </html>
  );
}
