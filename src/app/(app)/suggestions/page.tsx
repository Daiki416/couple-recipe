import { deleteSuggestion } from "@/app/(app)/suggestions/actions";
import { SuggestionCard } from "@/components/suggestions/SuggestionCard";
import { normalizeDraft } from "@/lib/chat/normalize";
import { createClient } from "@/lib/supabase/server";

export default async function SuggestionsPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("recipe_suggestions")
    .select("id, draft, source_prompt, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[SuggestionsPage]", error);
  }

  // jsonb の draft は信用せず normalizeDraft で再正規化し、タイトル空は除外する。
  const suggestions = (data ?? [])
    .map((row) => ({
      id: row.id,
      sourcePrompt: row.source_prompt,
      draft: normalizeDraft(row.draft),
    }))
    .filter((s) => s.draft.title !== "");

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
      <div className="mb-6">
        <h1 className="font-round text-2xl font-bold text-ink">AIの提案</h1>
        <p className="mt-1 text-sm text-ink-soft">
          AI が考えた新しいレシピの控えです。気に入ったら「レシピにする」で登録できます。
        </p>
      </div>

      {suggestions.length === 0 ? (
        <p className="rounded-xl border-2 border-dashed border-line bg-paper/60 px-4 py-10 text-center text-ink-soft">
          まだ提案がありません。
          <br />
          「AI に相談」で新しいレシピを提案してもらうと、ここに並びます。
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {suggestions.map((s) => (
            <SuggestionCard
              key={s.id}
              id={s.id}
              draft={s.draft}
              sourcePrompt={s.sourcePrompt}
              deleteAction={deleteSuggestion}
            />
          ))}
        </div>
      )}
    </main>
  );
}
