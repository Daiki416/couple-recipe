/**
 * (app) 配下共通のローディング UI。
 * ナビ切替時に即座に表示し、体感速度を改善する。
 * レトロ喫茶テイストの簡素なスケルトン。
 */
export default function AppLoading() {
  return (
    <main
      className="mx-auto w-full max-w-2xl flex-1 px-4 py-12"
      aria-busy
      aria-live="polite"
    >
      <span className="sr-only">読み込み中…</span>
      <div className="mb-6 h-8 w-40 animate-pulse rounded-lg bg-cream-2" />
      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl border-2 border-line bg-cream-2/60"
          />
        ))}
      </div>
    </main>
  );
}
