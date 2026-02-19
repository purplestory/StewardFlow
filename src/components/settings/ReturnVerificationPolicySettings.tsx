"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Notice from "@/components/common/Notice";
import SectionCard from "@/components/ui/SectionCard";

type ReturnVerificationPolicy = {
  enabled?: boolean;
  require_photo?: boolean;
  require_verification?: boolean;
};

type ReturnVerificationPolicySettingsProps = {
  organizationId: string | null;
};

export default function ReturnVerificationPolicySettings({ organizationId }: ReturnVerificationPolicySettingsProps) {
  const [returnVerificationPolicy, setReturnVerificationPolicy] = useState<ReturnVerificationPolicy>({
    enabled: false,
    require_photo: true,
    require_verification: true,
  });
  const [loading, setLoading] = useState(Boolean(organizationId));
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) {
      return;
    }

    const loadSettings = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("organizations")
        .select("return_verification_policy")
        .eq("id", organizationId)
        .maybeSingle();

      if (error) {
        console.error("Error loading return verification policy:", error);
        setLoading(false);
        return;
      }

      if (data?.return_verification_policy) {
        setReturnVerificationPolicy({
          enabled: data.return_verification_policy.enabled ?? false,
          require_photo: data.return_verification_policy.require_photo ?? true,
          require_verification: data.return_verification_policy.require_verification ?? true,
        });
      }

      setLoading(false);
    };

    const timer = setTimeout(() => {
      void loadSettings();
    }, 0);

    return () => clearTimeout(timer);
  }, [organizationId]);

  const handleSave = async (newPolicy: ReturnVerificationPolicy) => {
    if (!organizationId) {
      setMessage("기관이 설정되지 않았습니다.");
      return;
    }

    setMessage(null);

    const { error } = await supabase
      .from("organizations")
      .update({
        return_verification_policy: newPolicy,
      })
      .eq("id", organizationId);

    if (error) {
      setMessage(`저장 오류: ${error.message}`);
    } else {
      setMessage("설정이 저장되었습니다.");
      // 성공 메시지를 2초 후 자동으로 숨김
      setTimeout(() => setMessage(null), 2000);
    }
  };

  const isLoading = organizationId ? loading : false;

  if (isLoading) {
    return <p className="text-sm text-neutral-500">로딩 중...</p>;
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="반납 확인 정책"
        description="물품, 공간, 차량 사용 후 반납 시 확인 절차를 설정할 수 있습니다."
      >
        <div className="module-list">
          <div className="flex items-center justify-between gap-4 px-4 py-4">
            <div className="flex-1">
              <label className="text-sm font-medium">반납 확인 절차 활성화</label>
              <p className="mt-1 text-xs text-neutral-500">
                반납 시 사진 촬영 및 확인 절차를 필수로 진행합니다.
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={returnVerificationPolicy.enabled === true}
                onChange={async (e) => {
                  const newPolicy = { ...returnVerificationPolicy, enabled: e.target.checked };
                  setReturnVerificationPolicy(newPolicy);
                  await handleSave(newPolicy);
                }}
                className="peer sr-only"
              />
              <div className="toggle-switch"></div>
            </label>
          </div>

          {returnVerificationPolicy.enabled && (
            <>
              <div className="flex items-center justify-between gap-4 px-4 py-4">
                <div className="flex-1">
                  <label className="text-sm font-medium">사진 촬영 필수</label>
                  <p className="mt-1 text-xs text-neutral-500">
                    반납 시 반드시 사진을 촬영해야 합니다. (차량은 계기판 및 외관 사진 필수)
                  </p>
                </div>
                <label className="relative inline-flex flex-shrink-0 cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={returnVerificationPolicy.require_photo !== false}
                    onChange={async (e) => {
                      const newPolicy = { ...returnVerificationPolicy, require_photo: e.target.checked };
                      setReturnVerificationPolicy(newPolicy);
                      await handleSave(newPolicy);
                    }}
                    className="peer sr-only"
                  />
                  <div className="toggle-switch"></div>
                </label>
              </div>

              <div className="flex items-center justify-between gap-4 px-4 py-4">
                <div className="flex-1">
                  <label className="text-sm font-medium">관리자 확인 필수</label>
                  <p className="mt-1 text-xs text-neutral-500">
                    반납 후 관리자 또는 부서 관리자의 확인이 필요합니다.
                  </p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={returnVerificationPolicy.require_verification !== false}
                    onChange={async (e) => {
                      const newPolicy = { ...returnVerificationPolicy, require_verification: e.target.checked };
                      setReturnVerificationPolicy(newPolicy);
                      await handleSave(newPolicy);
                    }}
                    className="peer sr-only"
                  />
                  <div className="toggle-switch"></div>
                </label>
              </div>
            </>
          )}
        </div>
      </SectionCard>

      {message && (
        <Notice
          variant={message.includes("오류") ? "warning" : "neutral"}
          className="text-left"
        >
          {message}
        </Notice>
      )}
    </div>
  );
}
