import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function normalizeHost(host?: string | null): string | null {
  if (!host) return null;
  const trimmed = host.trim();
  if (!trimmed) return null;
  const withoutProtocol = trimmed.replace(/^https?:\/\//i, "");
  const onlyHost = withoutProtocol.split("/")[0];
  return onlyHost.toLowerCase();
}

export async function proxy(request: NextRequest) {
  // 프리뷰 랜덤 URL(커밋 단위)을 브랜치 고정 URL로 통일해 OAuth redirect URI 불일치를 줄인다.
  const requestHost = normalizeHost(request.headers.get("host"));
  const canonicalPreviewHost = normalizeHost(
    process.env.NEXT_PUBLIC_CANONICAL_PREVIEW_HOST || process.env.VERCEL_BRANCH_URL
  );
  const isCommitPreviewHost = Boolean(
    requestHost && /-[a-z0-9]{9}-[a-z0-9-]+\.vercel\.app$/.test(requestHost)
  );
  const shouldRedirectToCanonicalPreviewHost = Boolean(
    isCommitPreviewHost &&
    requestHost &&
      canonicalPreviewHost &&
      requestHost !== canonicalPreviewHost &&
      canonicalPreviewHost.endsWith(".vercel.app")
  );

  if (shouldRedirectToCanonicalPreviewHost) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.host = canonicalPreviewHost!;
    const forwardedProto = request.headers.get("x-forwarded-proto");
    if (forwardedProto === "http" || forwardedProto === "https") {
      redirectUrl.protocol = `${forwardedProto}:`;
    }
    return NextResponse.redirect(redirectUrl, 307);
  }

  // RSC(React Server Components) 요청은 수정하지 않고 그대로 통과시킴.
  // 미들웨어에서 응답/쿠키를 건드리면 CORS "access control checks" 오류가 발생할 수 있음.
  const isRsc =
    request.nextUrl.searchParams.has("_rsc") ||
    request.headers.get("RSC") === "1" ||
    request.headers.get("Next-Router-Prefetch") === "1";
  if (isRsc) {
    return NextResponse.next();
  }

  const supabaseResponse = NextResponse.next({
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
  await supabase.auth.getUser();

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
