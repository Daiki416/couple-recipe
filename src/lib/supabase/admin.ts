import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * service_role キーを使う管理用 Supabase クライアント。
 *
 * 注意: service_role は RLS をバイパスする「サーバー専用」の鍵。
 * クライアントコンポーネントからこのモジュールを import してはいけない
 * （"server-only" によりクライアントバンドルへの混入はビルド時に弾かれる）。
 * Server Action / Route Handler などサーバー実行文脈からのみ利用する。
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
