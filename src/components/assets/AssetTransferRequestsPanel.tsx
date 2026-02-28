"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Notice from "@/components/common/Notice";
import { dispatchNotificationChannelsClient } from "@/lib/notification-dispatch-client";

type TransferRequest = {
  id: string;
  requester_id: string | null;
  from_department: string | null;
  to_department: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  note: string | null;
  created_at: string;
};

type AssetTransferRequestsPanelProps = {
  assetId: string;
  assetName: string;
  ownerDepartment: string;
  ownerScope: "organization" | "department";
};

export default function AssetTransferRequestsPanel({
  assetId,
  assetName,
  ownerDepartment,
  ownerScope,
}: AssetTransferRequestsPanelProps) {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<TransferRequest[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<"admin" | "manager" | "user" | null>(null);
  const [department, setDepartment] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const reloadRequests = async () => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user ?? null;

    if (!user) {
      setLoading(false);
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("organization_id,role,department")
      .eq("id", user.id)
      .maybeSingle();

    const { data: requestData, error } = await supabase
      .from("asset_transfer_requests")
      .select("id,requester_id,from_department,to_department,status,note,created_at")
      .eq("asset_id", assetId)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      setRequests([]);
    } else {
      setRequests((requestData ?? []) as TransferRequest[]);
      setOrganizationId(profileData?.organization_id ?? null);
      setRole((profileData?.role as "admin" | "manager" | "user") ?? "user");
      setDepartment(profileData?.department ?? null);
      setUserId(user.id);
    }
    setLoading(false);
  };

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
        .select("organization_id,role,department")
        .eq("id", user.id)
        .maybeSingle();

      const { data: requestData } = await supabase
        .from("asset_transfer_requests")
        .select("id,requester_id,from_department,to_department,status,note,created_at")
        .eq("asset_id", assetId)
        .order("created_at", { ascending: false });

      if (!isMounted) return;

      setOrganizationId(profileData?.organization_id ?? null);
      setRole((profileData?.role as "admin" | "manager" | "user") ?? "user");
      setDepartment(profileData?.department ?? null);
      setUserId(user.id);
      setRequests((requestData ?? []) as TransferRequest[]);
      setLoading(false);
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [assetId]);

  const canManage =
    role === "admin" ||
    role === "manager" ||
    (ownerScope === "department" &&
      department &&
      department === ownerDepartment);

  const handleResolve = async (
    request: TransferRequest,
    nextStatus: "approved" | "rejected"
  ) => {
    if (!organizationId || !userId) {
      setMessage("기관 정보를 확인할 수 없습니다.");
      return;
    }

    if (!canManage) {
      setMessage("요청 처리는 관리자/소유 부서만 가능합니다.");
      return;
    }

    setUpdatingId(request.id);
    setMessage(null);

    const { error } = await supabase
      .from("asset_transfer_requests")
      .update({
        status: nextStatus,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (error) {
      setMessage(error.message);
      setUpdatingId(null);
      return;
    }

    if (nextStatus === "approved") {
      await supabase
        .from("assets")
        .update({
          owner_scope: "department",
          owner_department: request.to_department ?? ownerDepartment,
        })
        .eq("id", assetId);
    }

    await supabase.from("audit_logs").insert({
      organization_id: organizationId,
      actor_id: userId,
      action:
        nextStatus === "approved"
          ? "asset_transfer_request_approved"
          : "asset_transfer_request_rejected",
      target_type: "asset_transfer_request",
      target_id: request.id,
      metadata: {
        from_department: request.from_department,
        to_department: request.to_department,
      },
    });

    const notificationPayload = {
      resource_id: assetId,
      resource_name: assetName,
      asset_id: assetId,
      from_department: request.from_department,
      to_department: request.to_department,
    };

    await supabase.from("notifications").insert({
      organization_id: organizationId,
      user_id: request.requester_id,
      type:
        nextStatus === "approved"
          ? "asset_transfer_request_approved"
          : "asset_transfer_request_rejected",
      channel: "kakao",
      status: "pending",
      payload: notificationPayload,
    });
    if (request.requester_id) {
      await dispatchNotificationChannelsClient([
        {
          userId: request.requester_id,
          type:
            nextStatus === "approved"
              ? "asset_transfer_request_approved"
              : "asset_transfer_request_rejected",
          payload: notificationPayload,
        },
      ]);
    }

    setRequests((prev) =>
      prev.map((item) =>
        item.id === request.id ? { ...item, status: nextStatus } : item
      )
    );
    setUpdatingId(null);
  };

  if (loading) {
    return (
      <Notice>이동 요청 목록을 불러오는 중입니다.</Notice>
    );
  }

  if (!userId) {
    return null;
  }

  // 내 부서의 불용품이 아니면 표시하지 않음
  // 알림 메뉴에서 요청을 처리할 수 있으므로 여기서는 내 부서의 불용품만 관리
  if (!canManage) {
    return null;
  }

  // 기관 공용이 아닌 경우에만 표시 (내 부서의 불용품만)
  if (ownerScope === "organization" || ownerDepartment === "기관 공용") {
    return null;
  }

  return (
    <div className="module-panel space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">불용품 양도 요청 관리</h2>
          <p className="mt-1 text-sm text-neutral-600">
            관리자/소유 부서만 승인/거절할 수 있습니다.
          </p>
        </div>
        <button
          type="button"
          onClick={reloadRequests}
          className="btn-ghost"
        >
          새로고침
        </button>
      </div>

      {requests.length === 0 ? (
        <Notice>이동 요청이 없습니다.</Notice>
      ) : (
        <div className="module-list text-sm">
          <div className="list-row-muted hidden items-center text-xs text-neutral-500 lg:grid lg:grid-cols-[minmax(0,1fr)_220px]">
            <span>요청 정보</span>
            <span className="text-right">처리</span>
          </div>
          {requests.map((request) => (
            <div
              key={request.id}
              className="list-row flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">
                    {request.from_department ?? "미등록"} →{" "}
                    {request.to_department ?? "미등록"}
                  </p>
                  <p className="text-xs text-neutral-500">
                    상태: {statusLabel[request.status]}
                  </p>
                </div>
                {request.note && (
                  <p className="mt-1 text-xs text-neutral-500">
                    사유: {request.note}
                  </p>
                )}
                <p className="mt-1 text-xs text-neutral-400">
                  요청일: {formatDateTime(request.created_at)}
                </p>
              </div>
              <div className="flex w-full items-center justify-end gap-2 lg:w-[220px] lg:justify-self-end">
                {request.status === "pending" && canManage ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleResolve(request, "approved")}
                      disabled={updatingId === request.id}
                      className="btn-primary h-9 px-4 text-xs"
                    >
                      승인
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResolve(request, "rejected")}
                      disabled={updatingId === request.id}
                      className="btn-danger h-9 px-3 text-xs"
                    >
                      거절
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-neutral-400">처리 완료</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {message && (
        <Notice className="p-3">{message}</Notice>
      )}
    </div>
  );
}

const statusLabel: Record<
  "pending" | "approved" | "rejected" | "cancelled",
  string
> = {
  pending: "대기",
  approved: "승인됨",
  rejected: "거절됨",
  cancelled: "취소됨",
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};
