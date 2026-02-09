"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase"; // Supabase Client
import { 
  getInviteByToken, 
  acceptInviteByToken, 
  setPendingJoinTokenCookie, 
  getAndClearPendingJoinTokenCookie 
} from "@/actions/invite-actions";
import Link from "next/link";
import LogoIcon from "@/components/common/LogoIcon";
import { 
  getOrigin, 
  setJoinRedirectCookie, 
  getJoinRedirectCookie, 
  clearJoinRedirectCookie 
} from "@/lib/utils";

// 토큰 추출 헬퍼 함수
function extractTokenFromInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/")) {
    try {
      const url = trimmed.startsWith("/") ? new URL(trimmed, window.location.origin) : new URL(trimmed);
      const t = url.searchParams.get("token");
      if (t) return decodeURIComponent(t).trim();
      const m = url.pathname.match(/\/join\/([^/?]+)/);
      if (m?.[1]) return decodeURIComponent(m[1]).trim();
    } catch {
      /* ignore */
    }
  }
  return trimmed;
}

function JoinPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tokenFromUrl = searchParams.get("token");
  
  // 상태 관리
  const [token, setToken] = useState(tokenFromUrl || "");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [phone, setPhone] = useState("");
  
  const [loading, setLoading] = useState(!!tokenFromUrl);
  const [signingUp, setSigningUp] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const [inviteInfo, setInviteInfo] = useState<{
    email: string;
    organization_name: string;
    role: string;
    department: string | null;
    name: string | null;
    inviter?: {
      name: string | null;
      department: string | null;
      organization_name: string | null;
    };
  } | null>(null);

  // 1. URL 토큰 동기화
  useEffect(() => {
    const t = searchParams.get("token");
    if (t