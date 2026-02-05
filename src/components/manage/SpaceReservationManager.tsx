"use client";

import { useEffect, useMemo, useState } from "react";
import Notice from "@/components/common/Notice";
import { supabase } from "@/lib/supabase";

type ReservationRow = {
  id: string;
  status: "pending" | "approved" | "returned" | "rejected";
  start_date: string;
  end_date: string;
  borrower_id: string;
  space_id: string;
  spaces: {
    name: string;
    owner_department: string;
    owner_scope: string;
    image_url: string | null;
  } | null;
};

type ProfileRole = "admin" | "manager" | "user";

type ApprovalPolicy = {
  scope: "asset" | "space";
  department: string | null;
  required_role: ProfileRole;
};

type PermissionContext = {
  role: ProfileRole;
  department: string | null;
  organization_id: string | null;
};

const statusOptions: ReservationRow["status"][] = [
  "pending",
  "approved",
  "returned",
  "rejected",
];

export default function SpaceReservationManager() {
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [role, setRole] = useState<ProfileRole | null>(null);
  const [policies, setPolicies] = useState<ApprovalPolicy[]>([]);
  const [context, setContext] = useState<PermissionContext | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    ReservationRow["status"] | "all"
  >("all");
  const [query, setQuery] = useState("");

  const roleRank: Record<ProfileRole, number> = {
    admin: 3,
    manager: 2,
    user: 1,
  };

  const load = async () => {
    setLoading(true);
    setMessage(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user ?? null;

    if (!user) {
      setRole(null);
      setReservations([]);
      setLoading(false);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("role,department,organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      setMessage(profileError.message);
      setRole(null);
      setReservations([]);
      setLoading(false);
      return;
    }

    const nextRole = (profileData?.role as ProfileRole) ?? "user";
    setRole(nextRole);
    setContext({
      role: nextRole,
      department: profileData?.department ?? null,
      organization_id: profileData?.organization_id ?? null,
    });

    const { data: policyData, error: policyError } = await supabase
      .from("approval_policies")
      .select("scope,department,required_role")
      .eq("organization_id", profileData?.organization_id ?? null)
      .eq("scope", "space");

    if (policyError) {
      setMessage(policyError.message);
      setPolicies([]);
    } else {
      setPolicies((policyData ?? []) as ApprovalPolicy[]);
    }

    const { data, error } = await supabase
      .from("space_reservations")
      .select(
        "id,status,start_date,end_date,borrower_id,space_id,spaces(name,owner_department,owner_scope,image_url)"
      )
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      setReservations([]);
    } else {
      const normalizedData = (data ?? []).map((row: any) => {
        const space = Array.isArray(row.spaces) ? row.spaces[0] : row.spaces;
        return {
          ...row,
          spaces: space || null,
        };
      });
      setReservations(normalizedData as ReservationRow[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleStatusChange = async (
    reservationId: string,
    nextStatus: ReservationRow["status"]
  ) => {
    setMessage(null);

    if (role !== "admin" && role !== "manager") {
      setMessage("예약 상태를 변경할 권한이 없습니다.");
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setMessage("로그인 후 예약 관리 기능을 이용할 수 있습니다.");
      return;
    }

    setUpdatingId(reservationId);
    const response = await fetch("/api/reservations/space", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reservationId,
        status: nextStatus,
        accessToken,
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      setMessage(result.message ?? "상태 변경에 실패했습니다.");
      setUpdatingId(null);
      return;
    }

    setReservations((prev) =>
      prev.map((reservation) =>
        reservation.id === reservationId
          ? { ...reservation, status: nextStatus }
          : reservation
      )
    );
    setUpdatingId(null);
  };

  if (loading) {
    return (
      <Notice>예약 목록을 불러오는 중입니다.</Notice>
    );
  }

  if (!role) {
    return (
      <Notice>
        로그인 후 예약 관리 기능을 이용할 수 있습니다.{" "}
        <a href="/login" className="underline">
          로그인
        </a>
        으로 이동해 주세요.
      </Notice>
    );
  }

  if (role === "user") {
    return (
      <Notice variant="warning">
        예약 상태 변경은 관리자/부서 관리자만 가능합니다.
      </Notice>
    );
  }

  if (message) {
    return (
      <Notice variant="error">{message}</Notice>
    );
  }

  if (reservations.length === 0) {
    return (
      <Notice>예약 신청 내역이 없습니다.</Notice>
    );
  }

  const filteredReservations = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return reservations.filter((reservation) => {
      if (statusFilter !== "all" && reservation.status !== statusFilter) {
        return false;
      }
      if (!normalized) {
        return true;
      }
      const name = reservation.spaces?.name?.toLowerCase() ?? "";
      const borrower = reservation.borrower_id.toLowerCase();
      return (
        name.includes(normalized) || borrower.includes(normalized)
      );
    });
  }, [reservations, query, statusFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-600">
        <div className="flex flex-wrap items-center gap-2">
          <span>총 {reservations.length}건</span>
          <button
            type="button"
            onClick={load}
            className="btn-ghost"
          >
            새로고침
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="form-input h-10 text-xs"
            placeholder="공간명/신청자 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            className="form-select h-10 text-xs"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as ReservationRow["status"] | "all"
              )
            }
          >
            <option value="all">전체 상태</option>
            <option value="pending">승인 대기</option>
            <option value="approved">승인됨</option>
            <option value="returned">반납 완료</option>
            <option value="rejected">반려</option>
          </select>
        </div>
      </div>
      {filteredReservations.length === 0 ? (
        <Notice>
          <p>조건에 맞는 예약이 없습니다.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setStatusFilter("all");
            }}
            className="btn-ghost mt-3"
          >
            필터 초기화
          </button>
        </Notice>
      ) : (
        filteredReservations.map((reservation) => (
        <div
          key={reservation.id}
          className="rounded-lg border border-neutral-200 px-4 py-3"
        >
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium">
                {reservation.spaces?.name ?? "공간"} 예약
              </p>
              <p className="text-xs text-neutral-500">
                {reservation.start_date} ~ {reservation.end_date}
              </p>
              <p className="text-xs text-neutral-500">
                신청자: {reservation.borrower_id}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500">상태</span>
              <select
                value={reservation.status}
                onChange={(event) =>
                  handleStatusChange(
                    reservation.id,
                    event.target.value as ReservationRow["status"]
                  )
                }
                className="rounded-md border border-neutral-200 px-2 py-1 text-xs"
                disabled={
                  !context ||
                  !reservation.spaces ||
                  updatingId === reservation.id ||
                  roleRank[context.role] <
                    roleRank[
                      resolveRequiredRole(policies, reservation.spaces)
                    ]
                }
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {context && reservation.spaces && (
            <p className="mt-2 text-xs text-neutral-400">
              승인 필요 권한:{" "}
              {resolveRequiredRole(policies, reservation.spaces)}
            </p>
          )}
        </div>
        ))
      )}
    </div>
  );
}

const resolveRequiredRole = (
  policies: ApprovalPolicy[],
  space: { owner_department?: string; owner_scope?: string }
): ProfileRole => {
  const department =
    space.owner_scope === "organization" ? null : space.owner_department;
  const exactPolicy = policies.find(
    (policy) => policy.department === department
  );
  const fallbackPolicy = policies.find((policy) => policy.department === null);
  return (exactPolicy?.required_role ??
    fallbackPolicy?.required_role ??
    "manager") as ProfileRole;
};
