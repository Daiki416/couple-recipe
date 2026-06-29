// 喫茶トーンの共通 UI クラス文字列。各コンポーネントはここを import して使う。
// 見た目（クラス）の一元管理が目的で、ロジックは持たない。

export const labelClass = "text-sm font-bold text-ink";

export const inputClass =
  "rounded-lg border-2 border-line bg-paper px-3 py-2 text-base text-ink outline-none transition-colors placeholder:text-ink-soft/60 focus:border-tomato focus-visible:border-tomato";

// ホーロー看板風のプライマリボタン（影付き・押下で沈む）。
export const primaryButtonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border-2 border-ink bg-tomato px-4 py-2 text-sm font-bold text-white shadow-[2px_2px_0_0_var(--color-ink)] transition-all hover:bg-tomato-deep active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-60";

export const outlineButtonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border-2 border-ink bg-paper px-4 py-2 text-sm font-bold text-ink transition-colors hover:bg-cream-2";

export const subButtonClass =
  "inline-flex items-center justify-center rounded-lg border-2 border-line px-3 py-1.5 text-sm font-bold text-ink-soft transition-colors hover:border-ink hover:text-ink whitespace-nowrap shrink-0";

export const dangerButtonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border-2 border-tomato px-4 py-2 text-sm font-bold text-tomato transition-colors hover:bg-tomato hover:text-white disabled:opacity-60";

export const cardClass =
  "rounded-xl border-2 border-ink bg-paper shadow-[3px_3px_0_0_rgba(46,42,38,0.12)]";

export const pillClass =
  "rounded-full border-2 border-line bg-cream-2 px-2.5 py-0.5 text-xs font-bold text-ink-soft transition-colors hover:border-ink hover:text-ink";

export const activePillClass =
  "rounded-full border-2 border-ink bg-tomato px-2.5 py-0.5 text-xs font-bold text-white transition-colors hover:bg-tomato-deep";
