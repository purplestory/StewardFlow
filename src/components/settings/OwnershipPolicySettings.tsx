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

type OwnershipPolicySettingsProps = {
  organizationId: string | null;
};

export default function OwnershipPolicySettings({ organizationId }: OwnershipPolicySettingsProps) {
  const [features, setFeatures] = useState<OrganizationFeatures>({
    equipment: true,
    spaces: true,
    vehicles: false,
  });
  const [ownershipPolicies, setOwnershipPolicies] = useState<OwnershipPolicies>({
    spaces: "organization_only",
    vehicles: "organization_only",
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
        .select("features,ownership_policies")
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
      }

      setLoading(false);
    };

    loadSettings();
  }, [organizationId]);

  const handleSave = async (newPolicies: OwnershipPolicies) => {
    if (!organizationId) {
      setMessage("기관이 설정되지 않았습니다.");
      return;
    }

    setMessage(null);

    const { error } = await supabase
      .from("organizations")
      .update({
        ownership_policies: newPolicies,
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
                    onChange={async () => {
                      const newPolicies = { ...ownershipPolicies, spaces: "organization_only" };
                      setOwnershipPolicies(newPolicies);
                      await handleSave(newPolicies);
                    }}
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
                    onChange={async () => {
                      const newPolicies = { ...ownershipPolicies, spaces: "department_allowed" };
                      setOwnershipPolicies(newPolicies);
                      await handleSave(newPolicies);
                    }}
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
                    onChange={async () => {
                      const newPolicies = { ...ownershipPolicies, vehicles: "organization_only" };
                      setOwnershipPolicies(newPolicies);
                      await handleSave(newPolicies);
                    }}
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
                    onChange={async () => {
                      const newPolicies = { ...ownershipPolicies, vehicles: "department_allowed" };
                      setOwnershipPolicies(newPolicies);
                      await handleSave(newPolicies);
                    }}
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
