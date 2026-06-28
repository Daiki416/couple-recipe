import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

/**
 * 認証不要でアクセスできるルート（未認証でも到達可能）。
 */
const PUBLIC_ROUTES = ["/login", "/signup"];

/**
 * proxy（旧 middleware）から呼ばれるセッション更新処理。
 * createServerClient を request/response の cookie にブリッジし、
 * getUser() でトークンをリフレッシュしつつ認証ガードのリダイレクト判定を行う。
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // createServerClient 生成と getUser の間に他処理を挟まないこと。
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  // 未認証 × 保護ルート → /login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return redirectWithCookies(url, supabaseResponse);
  }

  // 認証済み × /login・/signup → /
  if (user && isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return redirectWithCookies(url, supabaseResponse);
  }

  return supabaseResponse;
}

/**
 * redirect レスポンスを生成し、getUser でリフレッシュされた
 * supabaseResponse の Cookie を引き継ぐ。
 * @supabase/ssr 公式パターンの「redirect でも response cookie をコピー」推奨に一致。
 * ResponseCookie ごと set し、HttpOnly/Secure/SameSite 等の属性も保持する。
 */
function redirectWithCookies(url: URL, supabaseResponse: NextResponse) {
  const res = NextResponse.redirect(url);
  supabaseResponse.cookies.getAll().forEach((cookie) => res.cookies.set(cookie));
  return res;
}
