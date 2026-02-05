"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Notice from "@/components/common/Notice";

type OrganizationFeatures = {
  equipment?: boolean;
  spaces?: boolean;
  vehicles?: boolean;
};

type OwnershipPolicies = {
  spaces?: "organization_only" | "department_allowed";
  vehicles?: "organization_only" | "department_allowed";
};

type ReturnVerificationPolicy = {
  enabled?: boolean;
  require_photo?: boolean;
  require_verification?: boolean;
};

type PolicySettingsProps = {
  organizationId: string | null;
};

export default function PolicySettings({ organizationId }: PolicySettingsProps) {
  const [features, setFeatures] = useState<OrganizationFeatures>({
    equipment: true,
    spaces: true,
    vehicles: false,
  });
  const [ownershipPolicies, setOwnershipPolicies] = useState<OwnershipPolicies>({
    spaces: "organization_only",
    vehicles: "organization_only",
  });
  const [returnVerificationPolicy, setReturnVerificationPolicy] = useState<ReturnVerificationPolicy>({
    enabled: false,
    require_photo: true,
    require_verification: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    const loadSettings = async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("features,ownership_policies,return_verification_policy")
        .eq("id", organizationId)
        .maybeSingle();

      if (error) {
        console.error("Error loading policies:", error);
        setLoading(false);
        return;
      }

      if (data) {
        if (data.features) {
          setFeatures({
            equipment: data.features.equipment ?? true,
            spaces: data.features.spaces ?? true,
            vehicles: data.features.vehicles ?? false,
          });
        }
        if (data.ownership_policies) {
          setOwnershipPolicies({
            spaces: data.ownership_policies.spaces ?? "organization_only",
            vehicles: data.ownership_policies.vehicles ?? "organization_only",
          });
        }
        if (data.return_verification_policy) {
          setReturnVerificationPolicy({
            enabled: data.return_verification_policy.enabled ?? false,
            require_photo: data.return_verification_policy.require_photo ?? true,
            require_verification: data.return_verification_policy.require_verification ?? true,
          });
        }
      }

      setLoading(false);
    };

    loadSettings();
  }, [organizationId]);

  const handleSave = async () => {
    if (!organizationId) {
      setMessage("기관이 설정되지 않았습니다.");
      return;
    }

    setSaving(true);
    setMessage(null);

    const { error } = await supabase
      .from("organizations")
      .update({
        ownership_policies: ownershipPolicies,
        return_verification_policy: returnVerificationPolicy,
      })
      .eq("id", organizationId);

    if (error) {
      setMessage(`저장 오류: ${error.message}`);
    } else {
      setMessage("설정이 저장되었습니다.");
    }

    setSaving(false);
  };

  if (loading) {
    return <p className="text-sm text-neutral-500">로딩 중...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">소유 정책 설정</h3>
        <p className="text-sm text-neutral-600 mb-4">
          공간과 차량의 소유 구조를 설정할 수 있습니다. 각 기관마다 정책이 다를 수 있습니다.
        </p>

        <div className="space-y-4">
          {features.spaces !== false && (
            <div className="p-4 border border-neutral-200 rounded-lg mb-6">
              <label className="block form-label mb-3">
                공간 소유 정책
              </label>
              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="spaces_ownership"
                    value="organization_only"
                    checked={ownershipPolicies.spaces === "organization_only"}
                    onChange={() =>
                      setOwnershipPolicies({ ...ownershipPolicies, spaces: "organization_only" })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm">항상 기관 소유 (일반적)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="spaces_ownership"
                    value="department_allowed"
                    checked={ownershipPolicies.spaces === "department_allowed"}
                    onChange={() =>
                      setOwnershipPolicies({ ...ownershipPolicies, spaces: "department_allowed" })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm">부서 소유 허용</span>
                </label>
              </div>
            </div>
          )}

          {features.vehicles === true && (
            <div className="p-4 border border-neutral-200 rounded-lg mb-6">
              <label className="block form-label mb-3">
                차량 소유 정책
              </label>
              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="vehicles_ownership"
                    value="organization_only"
                    checked={ownershipPolicies.vehicles === "organization_only"}
                    onChange={() =>
                      setOwnershipPolicies({ ...ownershipPolicies, vehicles: "organization_only" })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm">항상 기관 소유 (일반적)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="vehicles_ownership"
                    value="department_allowed"
                    checked={ownershipPolicies.vehicles === "department_allowed"}
                    onChange={() =>
                      setOwnershipPolicies({ ...ownershipPolicies, vehicles: "department_allowed" })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm">부서 소유 허용</span>
                </label>
              </div>
            </div>
          )}

          <div className="p-4 border border-neutral-200 rounded-lg bg-neutral-50">
            <p className="text-xs text-neutral-600">
              <strong>참고:</strong> 물품은 부서 소유와 기관 공용 둘 다 가능합니다. (설정 불필요)
            </p>
          </div>
        </div>
      </div>

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
                onChange={(e) =>
                  setReturnVerificationPolicy({ ...returnVerificationPolicy, enabled: e.target.checked })
                }
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
                    onChange={(e) =>
                      setReturnVerificationPolicy({ ...returnVerificationPolicy, require_photo: e.target.checked })
                    }
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
                    onChange={(e) =>
                      setReturnVerificationPolicy({ ...returnVerificationPolicy, require_verification: e.target.checked })
                    }
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

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-primary w-auto"
        >
          {saving ? "저장 중..." : "설정 저장"}
        </button>
      </div>
    </div>
  );
}
