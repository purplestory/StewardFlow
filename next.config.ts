import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Next.js 16+ middleware 경고 억제
  // Supabase SSR의 경우 middleware가 세션 새로고침에 필요하므로 유지
  experimental: {
    // middleware 경고 억제 (Supabase SSR 호환성 유지)
  },
};

export default nextConfig;
