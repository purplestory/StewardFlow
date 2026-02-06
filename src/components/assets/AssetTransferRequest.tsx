"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Notice from "@/components/common/Notice";

type AssetTransferRequestProps = {
  assetId: string;
  organizationId: string | null;
  assetStatus: "available" | "rented" | "repair" | "lost" | "retired";
  ownerDepartment: string;
  assetName: string;
};

export default function AssetTransferRequest({
  assetId,
  organizationId,
  assetStatus,
  ownerDepartment,
  assetName,
}: AssetTransferRequestProps) {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [currentDepartment, setCurrentDepartment] = useState<string | null>(
    null
  );
  const [userId, setUserId] = useState<string | null>(null);
  const [hasPending, setHasPending] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user ?? null;

      if (!user) {
        if (isMounted) {
          setLoading(false);
        }
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("department")
        .eq("id", user.id)
        .maybeSingle();

      const { data: existing } = await supabase
        .from("asset_transfer_requests")
        .select("id,status")
        .eq("asset_id", assetId)
        .eq("requester_id", user.id)
        .in("status", ["pending"])
        .maybeSingle();

      if (!isMounted) return;

      setUserId(user.id);
      setCurrentDepartment(profileData?.department ?? null);
      setHasPending(Boolean(existing?.id));
      setLoading(false);
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [assetId]);

  const handleRequest = async () => {
    setMessage(null);

    if (!userId) {
      setMessage("로그인 후 이동 요청을 이용할 수 있습니다.");
      return;
    }

    if (!organizationId) {
      setMessage("기관 정보를 확인할 수 없습니다.");
      return;
    }

    if (!currentDepartment) {
      setMessage("부서 정보를 확인할 수 없습니다.");
      return;
    }

    if (currentDepartment === ownerDepartment) {
      setMessage("이미 동일한 부서에 있는 자산입니다.");
      return;
    }

    const { data: createdRequest, error } = await supabase
      .from("asset_transfer_requests")
      .insert({
        organization_id: organizationId,
        asset_id: assetId,
        requester_id: userId,
        from_department: ownerDepartment,
        to_department: currentDepartment,
        note: note.trim() || null,
      })
      .select("id")
      .maybeSingle();

    if (error) {
      setMessage(error.message);
      return;
    }

    if (createdRequest?.id) {
      await supabase.from("audit_logs").insert({
        organization_id: organizationId,
        actor_id: userId,
        action: "asset_transfer_request_create",
        target_type: "asset_transfer_request",
        target_id: createdRequest.id,
        metadata: {
          from_department: ownerDepartment,
          to_department: currentDepartment,
          note: note.trim() || null,
        },
      });
    }

    await supabase.from("notifications").insert({
      organization_id: organizationId,
      user_id: userId,
      type: "asset_transfer_request_created",
      channel: "kakao",
      status: "pending",
      payload: {
        resource_id: assetId,
        resource_name: assetName,
        asset_id: assetId,
        from_department: ownerDepartment,
        to_department: currentDepartment,
        note: note.trim() || null,
      },
    });

    setHasPending(true);
    setMessage("이동 요청이 등록되었습니다.");
    setNote("");
  };

  const handleCancel = async () => {
    if (!userId) {
      setMessage("로그인 후 이동 요청을 이용할 수 있습니다.");
      return;
    }

    if (!organizationId) {
      setMessage("기관 정보를 확인할 수 없습니다.");
      return;
    }

    const { data: cancelledRequests, error } = await supabase
      .from("asset_transfer_requests")
      .update({ status: "cancelled", resolved_at: new Date().toISOString() })
      .eq("asset_id", assetId)
      .eq("requester_id", userId)
      .eq("status", "pending")
      .select("id");

    if (error) {
      setMessage(error.message);
      return;
    }

    const cancelledId = cancelledRequests?.[0]?.id;
    if (cancelledId) {
      await supabase.from("audit_logs").insert({
        organization_id: organizationId,
        actor_id: userId,
        action: "asset_transfer_request_cancelled",
        target_type: "asset_transfer_request",
        target_id: cancelledId,
        metadata: {
          from_department: ownerDepartment,
          to_department: currentDepartment,
        },
      });
    }

    await supabase.from("notifications").insert({
      organization_id: organizationId,
      user_id: userId,
      type: "asset_transfer_request_cancelled",
      channel: "kakao",
      status: "pending",
      payload: {
        resource_id: assetId,
        resource_name: assetName,
        asset_id: assetId,
        from_department: ownerDepartment,
        to_department: currentDepartment,
      },
    });

    setHasPending(false);
    setMessage("이동 요청을 취소했습니다.");
  };

  if (loading) {
    return (
      <Notice>이동 요청 정보를 불러오는 중입니다.</Notice>
    );
  }

  // 불용품이 아니면 표시하지 않음
  if (assetStatus !== "retired") {
    return null;
  }

  if (!userId) {
    return null;
  }

  // organizationId가 없으면 표시하지 않음 (에러 방지)
  if (!organizationId) {
    return null;
  }

  // 내 부서의 불용품이면 양도 요청할 필요 없음
  if (currentDepartment && currentDepartment === ownerDepartment) {
    return null;
  }

  // 기관 공용이 아닌 경우에만 표시 (타 부서의 불용품만)
  // ownerDepartment가 "기관 공용"이면 표시하지 않음 (이미 기관 전체가 사용 가능)
  if (ownerDepartment === "기관 공용") {
    return null;
  }

  return (
    <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-6">
      <div>
        <h2 className="text-lg font-semibold">불용품 양도 요청</h2>
        <p className="mt-1 text-sm text-neutral-600">
          타 부서의 불용품을 우리 부서로 양도 요청할 수 있습니다.
        </p>
      </div>
      <div className="text-sm text-neutral-600">
        요청 부서: {currentDepartment ?? "미등록"}
      </div>
      <textarea
        className="form-textarea"
        placeholder="요청 사유를 입력하세요."
        value={note}
        onChange={(event) => setNote(event.target.value)}
        disabled={hasPending}
      />
      <button
        type="button"
        onClick={handleRequest}
        disabled={hasPending}
        className="rounded-lg border border-neutral-200 px-4 py-2 text-sm"
      >
        {hasPending ? "요청 진행 중" : "이동 요청"}
      </button>
      {hasPending && (
        <button
          type="button"
          onClick={handleCancel}
          className="rounded-lg border border-neutral-200 px-4 py-2 text-sm text-neutral-600"
        >
          요청 취소
        </button>
      )}
      {message && (
        <Notice className="p-3">{message}</Notice>
      )}
    </div>
  );
}
