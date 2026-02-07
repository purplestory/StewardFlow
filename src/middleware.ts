import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Next.js 16+ 권장 방식: middleware 대신 proxy 패턴 사용
// 하지만 Supabase SSR의 경우 middleware가 여전히 필요하므로
// 경고를 억제하기 위해 주석 추가 및 최신 패턴 적용
export async function middleware(request: NextRequest) {
  // RSC(React Server Components) 요청은 수정하지 않고 그대로 통과시킴.
  // 미들웨어에서 응답/쿠키를 건드리면 CORS "access control checks" 오류가 발생할 수 있음.
  const isRsc =
    request.nextUrl.searchParams.has("_rsc") ||
    request.headers.get("RSC") === "1" ||
    request.headers.get("Next-Router-Prefetch") === "1";
  if (isRsc) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh session if expired - required for Server Components
  // This ensures the session is available in Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Log for debugging (only in development)
  if (process.env.NODE_ENV === "development") {
    console.log(`[Middleware] User: ${user?.id || "none"}, Path: ${request.nextUrl.pathname}`);
  }

  return supabaseResponse;
}

// Next.js 16+ matcher config
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
