import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  const missing = [];
  if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseAnonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  
  throw new Error(
    `Supabase 환경 변수가 설정되지 않았습니다: ${missing.join(", ")}. Vercel 환경 변수 설정을 확인하세요.`
  );
}

// URL 유효성 검사
if (!supabaseUrl.startsWith("http://") && !supabaseUrl.startsWith("https://")) {
  throw new Error(
    `Invalid Supabase URL: "${supabaseUrl}". Must be a valid HTTP or HTTPS URL. 현재 값: "${process.env.NEXT_PUBLIC_SUPABASE_URL}"`
  );
}

const baseOptions = {
  db: {
    schema: "public" as const,
  },
  global: {
    headers: {
      "x-client-info": "steward-flow",
    },
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
};

export const supabase =
  typeof window === "undefined"
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        ...baseOptions,
      })
    : createBrowserClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          flowType: "implicit",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
        cookieOptions: {
          path: "/",
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        },
        ...baseOptions,
      });
