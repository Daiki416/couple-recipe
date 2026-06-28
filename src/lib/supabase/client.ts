import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * ブラウザ（クライアントコンポーネント）用の Supabase クライアント。
 * 公開可能な anon キーのみを使用する。
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
