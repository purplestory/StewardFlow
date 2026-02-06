"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import LogoIcon from "@/components/common/LogoIcon";
import Link from "next/link";

export default function JoinRequestPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [hasOrganization, setHasOrganization] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        router.push("/login");
        return;
      }

      setIsAuthenticated(true);
      setEmail(user.email || "");

      // 프로필 확인
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("name, organization_id, phone")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("가입 신청 페이지 - 프로필 조회 오류:", profileError);
        console.error("에러 상세:", {
          code: profileError.code,
          message: profileError.message,
          details: profileError.details,
          hint: profileError.hint,
          userId: user.id,
        });
        setLoading(false);
        return;
      }

      // 디버깅: 프로필 데이터 확인
      console.log("가입 신청 페이지 - 프로필 데이터:", {
        userId: user.id,
        hasProfile: !!profileData,
        organizationId: profileData?.organization_id,
        name: profileData?.name,
      });

      if (profileData) {
        setName(profileData.name || "");
        setPhone(profileData.phone || "");
        setHasOrganization(!!profileData.organization_id);
        
        // 이미 기관이 있으면 메인 페이지로 리다이렉트
        if (profileData.organization_id) {
          console.log("가입 신청 페이지 - organization_id가 있어서 메인 페이지로 리다이렉트");
          router.push("/");
          return;
        }
      } else {
        console.log("가입 신청 페이지 - 프로필 데이터가 없음");
      }

      setLoading(false);
    };

    checkAuth();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;

    if (!user) {
      setMessage("로그인이 필요합니다.");
      setSubmitting(false);
      return;
    }

    // 프로필 확인 후 업데이트 또는 생성
    const { data: existingProfile, error: checkError } = await supabase
      .from("profiles")
      .select("id,organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (checkError) {
      console.error("프로필 확인 오류:", checkError);
      setMessage(`프로필 확인 중 오류가 발생했습니다: ${checkError.message}`);
      setSubmitting(false);
      return;
    }

    console.log("가입 신청 - 프로필 확인 결과:", {
      hasProfile: !!existingProfile,
      organizationId: existingProfile?.organization_id,
    });

    let saveError = null;
    let saveSuccess = false;

    if (existingProfile) {
      // 프로필이 있으면 업데이트
      console.log("가입 신청 - 프로필 업데이트 시도");
      const { error, data } = await supabase
        .from("profiles")
        .update({
          name: name.trim() || null,
          phone: phone.trim() || null,
          // organization_id는 기존 값 유지 (null이면 null 유지)
        })
        .eq("id", user.id)
        .select();

      saveError = error;
      saveSuccess = !error && !!data;
      console.log("가입 신청 - 프로필 업데이트 결과:", {
        success: saveSuccess,
        error: error?.message,
        data,
      });
    } else {
      // 프로필이 없으면 생성 (organization_id는 null로 유지)
      console.log("가입 신청 - 프로필 생성 시도");
      const { error, data } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          email: user.email || email || "",
          name: name.trim() || null,
          phone: phone.trim() || null,
          organization_id: null, // 가입 신청 상태
        })
        .select();

      saveError = error;
      saveSuccess = !error && !!data;
      console.log("가입 신청 - 프로필 생성 결과:", {
        success: saveSuccess,
        error: error?.message,
        data,
      });
    }

    if (saveError) {
      console.error("Profile update/insert error:", saveError);
      console.error("에러 상세:", {
        code: saveError.code,
        message: saveError.message,
        details: saveError.details,
        hint: saveError.hint,
        userId: user.id,
        hasExistingProfile: !!existingProfile,
      });
      setMessage(`정보 저장 중 오류가 발생했습니다: ${saveError.message || "알 수 없는 오류"}`);
      setSubmitting(false);
      return;
    }

    if (!saveSuccess) {
      console.error("프로필 저장 실패: saveSuccess가 false입니다");
      setMessage("정보 저장에 실패했습니다. 다시 시도해주세요.");
      setSubmitting(false);
      return;
    }

    // 저장 후 검증: 실제로 저장되었는지 확인
    const { data: verifyProfile, error: verifyError } = await supabase
      .from("profiles")
      .select("id,name,phone,organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (verifyError) {
      console.error("프로필 검증 오류:", verifyError);
      setMessage("정보는 저장되었지만 확인에 실패했습니다. 페이지를 새로고침해주세요.");
      setSubmitting(false);
      return;
    }

    if (!verifyProfile) {
      console.error("프로필이 저장되지 않았습니다.");
      setMessage("정보 저장에 실패했습니다. 다시 시도해주세요.");
      setSubmitting(false);
      return;
    }

    console.log("가입 신청 저장 완료:", {
      userId: user.id,
      name: verifyProfile.name,
      phone: verifyProfile.phone,
      organizationId: verifyProfile.organization_id,
    });

    // 가입 신청 완료 (organization_id가 null인 상태로 유지)
    // 관리자가 UserRoleManager에서 승인할 수 있음
    setMessage("가입 신청이 완료되었습니다. 관리자 승인 후 서비스를 이용하실 수 있습니다.");
    setSubmitting(false);
    
    // 2초 후 메인 페이지로 리다이렉트 (skip_redirect 파라미터 추가)
    setTimeout(() => {
      router.push("/?skip_redirect=true");
    }, 2000);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="space-y-2">
            <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600"></div>
            <p className="text-sm text-neutral-600">로딩 중...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (hasOrganization) {
    return null; // 리다이렉트 중
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-neutral-200 bg-white p-8">
        <div>
          {/* 로고 */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 flex items-center justify-center">
              <LogoIcon className="w-full h-full" />
            </div>
          </div>
          <h1 className="text-xl md:text-2xl font-semibold text-center mb-2">
            가입 신청
          </h1>
          <p className="text-sm text-neutral-600 text-center">
            StewardFlow 사용을 위해 가입 신청을 해주세요.
            <br />
            관리자 승인 후 서비스를 이용하실 수 있습니다.
          </p>
          
          {/* 안내 정보 */}
          <div className="mt-4 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
            <div className="font-medium text-amber-900">안내사항</div>
            <div className="space-y-1 text-amber-700">
              <p>• 초대코드 없이 가입하신 경우, 관리자 승인이 필요합니다.</p>
              <p>• 가입 신청 후 관리자가 기관, 부서, 권한을 지정하여 승인합니다.</p>
              <p>• 승인 전까지는 메인 페이지만 이용하실 수 있습니다.</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2 text-sm">
            <label htmlFor="email" className="font-medium">
              이메일
            </label>
            <input
              id="email"
              type="email"
              value={email}
              disabled
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-neutral-500"
              style={{ height: "38px" }}
            />
            <p className="text-xs text-neutral-500">
              로그인에 사용된 이메일입니다.
            </p>
          </div>

          <div className="space-y-2 text-sm">
            <label htmlFor="name" className="font-medium">
              이름
            </label>
            <input
              id="name"
              type="text"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 김철수"
              required
              style={{ height: "38px" }}
            />
          </div>

          <div className="space-y-2 text-sm">
            <label htmlFor="phone" className="font-medium">
              연락처 (선택사항)
            </label>
            <input
              id="phone"
              type="tel"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-0000-0000"
              style={{ height: "38px" }}
            />
          </div>

          <div className="space-y-2 text-sm">
            <label htmlFor="message" className="font-medium">
              가입 사유 (선택사항)
            </label>
            <textarea
              id="message"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2"
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
              placeholder="가입 사유를 간단히 입력해주세요"
              rows={4}
            />
          </div>

          {message && (
            <div
              className={`rounded-lg border p-3 text-sm ${
                message.includes("완료")
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
              role="status"
            >
              {message}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 btn-primary"
              style={{ height: "38px" }}
            >
              {submitting ? "신청 중..." : "가입 신청"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/?skip_redirect=true")}
              className="flex-1 btn-ghost"
              style={{ height: "38px" }}
            >
              취소
            </button>
          </div>
        </form>

        <div className="space-y-2">
          <p className="text-xs text-neutral-500 text-center">
            초대코드를 받으셨나요?{" "}
            <Link href="/join" className="underline">
              초대 링크로 가입하기
            </Link>
          </p>
          <div className="border-t border-neutral-200 pt-2">
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                router.push("/");
              }}
              className="w-full text-sm text-neutral-600 hover:text-neutral-900 py-2"
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
