import Link from "next/link";
import { ChatWorkspace } from "@/components/chat/ChatWorkspace";
import { subButtonClass } from "@/lib/ui";

export default function ChatPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-round text-2xl font-bold text-ink">AI に相談</h1>
          <p className="mt-1 text-sm text-ink-soft">
            食べたい雰囲気や食材を伝えると、ふたりごはんが献立を提案します。
          </p>
        </div>
        <Link href="/suggestions" className={subButtonClass}>
          AIの提案を見る
        </Link>
      </div>
      <ChatWorkspace />
    </main>
  );
}
