"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export default function QueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 데이터가 stale로 간주되는 시간 (5분)
            staleTime: 1000 * 60 * 5,
            // 캐시에 보관하는 시간 (10분)
            gcTime: 1000 * 60 * 10,
            // 자동 리프레시 비활성화 (수동 리프레시만)
            refetchOnWindowFocus: false,
            // 네트워크 재연결 시 리프레시
            refetchOnReconnect: true,
            // 에러 발생 시 재시도 횟수
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
