"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Notice from "@/components/common/Notice";

type AssetAdminActionsProps = {
  assetId: string;
  assetStatus: "available" | "rented" | "repair" | "lost" | "retired";
  ownerScope: "organization" | "department";
  ownerDepartment: string;
};

export default function AssetAdminActions({
  assetId,
  assetStatus,
  ownerScope,
  ownerDepartment,
}: AssetAdminActionsProps) {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [role, setRole] = useState<"admin" | "manager" | "user" | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [nextOwnerScope, setNextOwnerScope] = useState(ownerScope);
  const [nextOwnerDepartment, setNextOwnerDepartment] =
    useState(ownerDepartment || "");
  const [updating, setUpdating] = useState(false);
  const [localStatus, setLocalStatus] = useState(assetStatus);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user ?? null;

      if (!user) {
        if (isMounted) {
          setRole(null);
          setLoading(false);
        }
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("organization_id,role")
        .eq("id", user.id)
        .maybeSingle();

      if (!isMounted) return;

      setRole((profileData?.role as "admin" | "manager" | "user") ?? "user");
      const orgId = profileData?.organization_id ?? null;
      setOrganizationId(orgId);
      setUserId(user.id);

      // 부서 목록 로드
      if (orgId) {
        const { data: deptData } = await supabase
          .from("departments")
          .select("id,name")
          .eq("organization_id", orgId)
          .order("name", { ascending: true });
        
        if (deptData) {
          setDepartments(deptData);
        }
      }

      setLoading(false);
    };

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  const canEdit = role === "admin" || role === "manager";

  const handleTransfer = async () => {
    if (!canEdit) {
      setMessage("부서 이동은 관리자/부서 관리자만 가능합니다.");
      return;
    }

    if (!organizationId || !userId) {
      setMessage("기관 정보를 확인할 수 없습니다.");
      return;
    }

    const normalizedDepartment =
      nextOwnerScope === "organization"
        ? "기관 공용"
        : (nextOwnerDepartment?.trim() || "");

    if (!normalizedDepartment) {
      setMessage("부서명을 입력해주세요.");
      return;
    }

    setUpdating(true);
    setMessage(null);

    const { error } = await supabase
      .from("assets")
      .update({
        owner_scope: nextOwnerScope,
        owner_department: normalizedDepartment,
      })
      .eq("id", assetId);

    if (error) {
      setMessage(error.message);
      setUpdating(false);
      return;
    }

    await supabase.from("audit_logs").insert({
      organization_id: organizationId,
      actor_id: userId,
      action: "asset_department_transfer",
      target_type: "asset",
      target_id: assetId,
      metadata: {
        from_scope: ownerScope,
        from_department: ownerDepartment,
        to_scope: nextOwnerScope,
        to_department: normalizedDepartment,
      },
    });

    setMessage("부서 이동이 완료되었습니다.");
    setUpdating(false);
  };

  const handleRetire = async () => {
    if (!canEdit) {
      setMessage("상태 변경은 관리자/부서 관리자만 가능합니다.");
      return;
    }

    if (!organizationId || !userId) {
      setMessage("기관 정보를 확인할 수 없습니다.");
      return;
    }

    setUpdating(true);
    setMessage(null);

    const { error } = await supabase
      .from("assets")
      .update({ status: "retired" })
      .eq("id", assetId);

    if (error) {
      setMessage(error.message);
      setUpdating(false);
      return;
    }

    await supabase.from("audit_logs").insert({
      organization_id: organizationId,
      actor_id: userId,
      action: "asset_status_update",
      target_type: "asset",
      target_id: assetId,
      metadata: {
        status: "retired",
      },
    });

    setLocalStatus("retired");
    setMessage("불용품으로 전환되었습니다.");
    setUpdating(false);
  };

  if (loading) {
    return (
      <Notice>관리자 기능을 불러오는 중입니다.</Notice>
    );
  }

  if (!role) {
    return (
      <Notice>
        로그인 후 관리 기능을 이용할 수 있습니다.{" "}
        <a href="/login" className="underline">
          로그인
        </a>
        으로 이동해 주세요.
      </Notice>
    );
  }

  if (!canEdit) {
    return (
      <Notice variant="warning">
        관리자/부서 관리자만 변경할 수 있습니다.
      </Notice>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-6">
      <div>
        <h2 className="text-lg font-semibold">관리자/부서 관리자 전용</h2>
        <p className="mt-1 text-sm text-neutral-600">
          자산 상태 변경 및 부서 이동을 처리합니다.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-2">
          <span className="form-label">소유 범위</span>
          <select
            className="form-select"
            value={nextOwnerScope}
            onChange={(event) => {
              const value = event.target.value as "organization" | "department";
              setNextOwnerScope(value);
              if (value === "organization") {
                setNextOwnerDepartment("기관 공용");
              } else {
                // 부서 소유로 변경 시 첫 번째 부서를 기본값으로 설정
                if (departments.length > 0 && !nextOwnerDepartment) {
                  setNextOwnerDepartment(departments[0].name);
                }
              }
            }}
          >
            <option value="department">부서 소유</option>
            <option value="organization">기관 공용</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 md:col-span-2">
          <span className="form-label">소유 부서</span>
          {nextOwnerScope === "organization" ? (
            <div className="form-input bg-neutral-50 text-neutral-600">
              기관 공용
            </div>
          ) : (
            <select
              className="form-select"
              value={nextOwnerDepartment || ""}
              onChange={(event) => setNextOwnerDepartment(event.target.value)}
            >
              <option value="">부서 선택</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.name}>
                  {dept.name}
                </option>
              ))}
            </select>
          )}
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          type="button"
          onClick={handleTransfer}
          disabled={updating}
          className="h-[38px] px-4 rounded-lg text-sm font-medium transition-all bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50 whitespace-nowrap flex items-center justify-center"
        >
          부서 이동 저장
        </button>
        <button
          type="button"
          onClick={handleRetire}
          disabled={updating || localStatus === "retired"}
          className="h-[38px] px-4 rounded-lg text-sm font-medium transition-all bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 hover:border-rose-300 whitespace-nowrap flex items-center justify-center"
        >
          불용품 전환
        </button>
        {localStatus === "retired" && (
          <span className="text-xs text-neutral-500">
            현재 불용품 상태입니다.
          </span>
        )}
      </div>

      {message && (
        <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          {message}
        </div>
      )}
    </div>
  );
}
