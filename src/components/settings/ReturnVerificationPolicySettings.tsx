"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Notice from "@/components/common/Notice";

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
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    const loadSettings = async () => {
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

    loadSettings();
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

  if (loading) {
    return <p className="text-sm text-neutral-500">로딩 중...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">반납 확인 정책</h3>
        <p className="text-sm text-neutral-600 mb-4">
          물품, 공간, 차량 사용 후 반납 시 확인 절차를 설정할 수 있습니다.
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-neutral-200 rounded-lg gap-4">
            <div className="flex-1">
              <label className="font-medium text-sm">반납 확인 절차 활성화</label>
              <p className="text-xs text-neutral-500 mt-1">
                반납 시 사진 촬영 및 확인 절차를 필수로 진행합니다.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={returnVerificationPolicy.enabled === true}
                onChange={async (e) => {
                  const newPolicy = { ...returnVerificationPolicy, enabled: e.target.checked };
                  setReturnVerificationPolicy(newPolicy);
                  await handleSave(newPolicy);
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
            </label>
          </div>

          {returnVerificationPolicy.enabled && (
            <>
              <div className="flex items-center justify-between p-4 border border-neutral-200 rounded-lg gap-4">
                <div className="flex-1">
                  <label className="font-medium text-sm">사진 촬영 필수</label>
                  <p className="text-xs text-neutral-500 mt-1">
                    반납 시 반드시 사진을 촬영해야 합니다. (차량은 계기판 및 외관 사진 필수)
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={returnVerificationPolicy.require_photo !== false}
                    onChange={async (e) => {
                      const newPolicy = { ...returnVerificationPolicy, require_photo: e.target.checked };
                      setReturnVerificationPolicy(newPolicy);
                      await handleSave(newPolicy);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 border border-neutral-200 rounded-lg gap-4">
                <div className="flex-1">
                  <label className="font-medium text-sm">관리자 확인 필수</label>
                  <p className="text-xs text-neutral-500 mt-1">
                    반납 후 관리자 또는 부서 관리자의 확인이 필요합니다.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={returnVerificationPolicy.require_verification !== false}
                    onChange={async (e) => {
                      const newPolicy = { ...returnVerificationPolicy, require_verification: e.target.checked };
                      setReturnVerificationPolicy(newPolicy);
                      await handleSave(newPolicy);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                </label>
              </div>
            </>
          )}
        </div>
      </div>

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
