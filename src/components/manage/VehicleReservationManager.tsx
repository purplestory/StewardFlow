"use client";

import { useEffect, useMemo, useState } from "react";
import Notice from "@/components/common/Notice";
import { supabase } from "@/lib/supabase";
import ReservationCalendarView from "./ReservationCalendarView";
import ReservationDetailModal from "./ReservationDetailModal";
import StatusFilterPills from "@/components/ui/StatusFilterPills";
import {
  Select,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  formatBorrowerName,
  formatDateTimeRange,
  reservationStatusLabel,
  reservationStatusOptions,
  roleLabel,
  type ProfileRole,
} from "./reservation-manager-shared";

type ReservationRow = {
  id: string;
  status: (typeof reservationStatusOptions)[number];
  start_date: string;
  end_date: string;
  borrower_id: string;
  vehicle_id: string;
  borrower: {
    name: string | null;
    department: string | null;
  } | null;
  vehicles: {
    name: string;
    license_plate: string | null;
    owner_department: string;
    owner_scope: string;
    image_url: string | null;
  } | null;
};

type ReservationQueryRow = Omit<ReservationRow, "borrower" | "vehicles"> & {
  profiles:
    | { name: string | null; department: string | null }
    | Array<{ name: string | null; department: string | null }>
    | null;
  vehicles:
    | {
        name: string;
        license_plate: string | null;
        owner_department: string;
        owner_scope: "organization" | "department";
        image_url: string | null;
      }
    | Array<{
        name: string;
        license_plate: string | null;
        owner_department: string;
        owner_scope: "organization" | "department";
        image_url: string | null;
      }>
    | null;
};

type ApprovalPolicy = {
  scope: "asset" | "space" | "vehicle";
  department: string | null;
  required_role: ProfileRole;
};

type PermissionContext = {
  role: ProfileRole;
  department: string | null;
  organization_id: string | null;
};

const statusOptions = reservationStatusOptions;
const statusLabel = reservationStatusLabel;
const viewModeOptions = [
  { value: "list", label: "목록" },
  { value: "calendar", label: "달력" },
] as const;

export default function VehicleReservationManager() {
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
  const [selectedReservation, setSelectedReservation] = useState<ReservationRow | null>(null);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [calendarViewMode, setCalendarViewMode] = useState<"month" | "week" | "day">("month");
  const [currentDate, setCurrentDate] = useState(new Date());

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
      .eq("scope", "vehicle");

    if (policyError) {
      setMessage(policyError.message);
      setPolicies([]);
    } else {
      setPolicies((policyData ?? []) as ApprovalPolicy[]);
    }

    const { data, error } = await supabase
      .from("vehicle_reservations")
      .select(
        "id,status,start_date,end_date,borrower_id,vehicle_id,profiles!borrower_id(name,department),vehicles(name,license_plate,owner_department,owner_scope,image_url)"
      )
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      setReservations([]);
    } else {
      const normalizedData = ((data ?? []) as ReservationQueryRow[]).map((row) => {
        const { profiles, ...rest } = row;
        const borrower = Array.isArray(profiles) ? profiles[0] : profiles;
        const vehicle = Array.isArray(row.vehicles) ? row.vehicles[0] : row.vehicles;
        return {
          ...rest,
          borrower: borrower || null,
          vehicles: vehicle || null,
        };
      });
      setReservations(normalizedData as ReservationRow[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const handleStatusChange = async (
    reservationId: string,
    nextStatus: ReservationRow["status"]
  ) => {
    setMessage(null);

    if (nextStatus === "returned") {
      setMessage("반납 확인 상태는 반납 처리 절차에서 자동으로 반영됩니다.");
      return;
    }

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
    const response = await fetch("/api/reservations/vehicle", {
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
    setSelectedReservation((prev) =>
      prev && prev.id === reservationId ? { ...prev, status: nextStatus } : prev
    );
    setUpdatingId(null);
  };

  const filteredReservations = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return reservations.filter((reservation) => {
      if (statusFilter !== "all" && reservation.status !== statusFilter) {
        return false;
      }
      if (!normalized) {
        return true;
      }
      const name = reservation.vehicles?.name?.toLowerCase() ?? "";
      const borrowerId = reservation.borrower_id.toLowerCase();
      const borrowerName = reservation.borrower?.name?.toLowerCase() ?? "";
      const borrowerDepartment = reservation.borrower?.department?.toLowerCase() ?? "";
      return (
        name.includes(normalized) ||
        borrowerId.includes(normalized) ||
        borrowerName.includes(normalized) ||
        borrowerDepartment.includes(normalized)
      );
    });
  }, [reservations, query, statusFilter]);

  // 달력 뷰용 예약 데이터 변환
  const calendarReservations = useMemo(() => {
    return filteredReservations.map((reservation) => ({
      id: reservation.id,
      start_date: reservation.start_date,
      end_date: reservation.end_date,
      status: reservation.status,
      resource_name:
        reservation.vehicles?.license_plate?.trim() ||
        reservation.vehicles?.name ||
        "차량",
      borrower_id: formatBorrowerName(reservation.borrower, reservation.borrower_id),
    }));
  }, [filteredReservations]);

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

  return (
    <div className="space-y-4 p-4 md:p-5">
      <div className="surface-card space-y-3 p-3 md:p-4">
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
          <StatusFilterPills
            options={viewModeOptions}
            value={viewMode}
            onChange={(next) => setViewMode(next as "list" | "calendar")}
          />
        </div>
        {viewMode === "list" && (
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_10rem]">
            <input
              className="form-input text-sm"
              placeholder="차량명/신청자 검색"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <Select
              value={statusFilter}
              onValueChange={(next) =>
                setStatusFilter(next as ReservationRow["status"] | "all")
              }
            >
              <SelectTrigger className="form-select text-sm">
                <SelectItem value="all">전체 상태</SelectItem>
                <SelectItem value="pending">대기</SelectItem>
                <SelectItem value="approved">승인</SelectItem>
                <SelectItem value="returned">반납 확인</SelectItem>
                <SelectItem value="rejected">반려</SelectItem>
              </SelectTrigger>
            </Select>
          </div>
        )}
      </div>

      {viewMode === "calendar" ? (
        <ReservationCalendarView
          reservations={calendarReservations}
          viewMode={calendarViewMode}
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          onViewModeChange={setCalendarViewMode}
          onReservationClick={(reservation) => {
            const found = filteredReservations.find((r) => r.id === reservation.id);
            if (found) {
              setSelectedReservation(found);
            }
          }}
        />
      ) : (
        <>
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
          className="cursor-pointer rounded-xl border border-neutral-200 bg-white px-4 py-3 transition-colors hover:bg-neutral-50"
          onClick={() => setSelectedReservation(reservation)}
        >
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium">
                {reservation.vehicles?.name ?? "차량"} 예약
              </p>
              <p className="text-xs text-neutral-500">
                {formatDateTimeRange(reservation.start_date, reservation.end_date)}
              </p>
              <p className="text-xs text-neutral-500">
                신청자:{" "}
                {formatBorrowerName(reservation.borrower, reservation.borrower_id)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-ghost h-8 px-3 text-xs"
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedReservation(reservation);
                }}
              >
                상세
              </button>
              <span className="text-xs text-neutral-500">상태</span>
              <Select
                value={reservation.status}
                onValueChange={(nextStatus) =>
                  handleStatusChange(
                    reservation.id,
                    nextStatus as ReservationRow["status"]
                  )
                }
                disabled={
                  reservation.status === "returned" ||
                  !context ||
                  !reservation.vehicles ||
                  updatingId === reservation.id ||
                  roleRank[context.role] <
                    roleRank[
                      resolveRequiredRole(policies, reservation.vehicles)
                    ]
                }
              >
                <SelectTrigger
                  className="form-select h-8 w-28 px-2 text-xs"
                  onClick={(event) => event.stopPropagation()}
                >
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status} disabled={status === "returned"}>
                      {statusLabel[status]}
                    </SelectItem>
                  ))}
                </SelectTrigger>
              </Select>
            </div>
          </div>
          {context && reservation.vehicles && (
            <p className="mt-2 text-xs text-neutral-400">
              승인 필요 권한:{" "}
              {roleLabel[resolveRequiredRole(policies, reservation.vehicles)]}
            </p>
          )}
        </div>
            ))
          )}
        </>
      )}

      <ReservationDetailModal
        isOpen={Boolean(selectedReservation)}
        title="차량 예약 상세"
        resourceLabel="차량"
        resourceName={selectedReservation?.vehicles?.name ?? "차량"}
        periodText={
          selectedReservation
            ? formatDateTimeRange(
                selectedReservation.start_date,
                selectedReservation.end_date
              )
            : "-"
        }
        borrowerText={
          selectedReservation
            ? formatBorrowerName(
                selectedReservation.borrower,
                selectedReservation.borrower_id
              )
            : "-"
        }
        requiredRoleLabel={
          selectedReservation?.vehicles
            ? roleLabel[resolveRequiredRole(policies, selectedReservation.vehicles)]
            : null
        }
        status={selectedReservation?.status ?? "pending"}
        statusOptions={statusOptions}
        statusLabel={statusLabel}
        disableStatusChange={
          !selectedReservation ||
          selectedReservation.status === "returned" ||
          !context ||
          !selectedReservation.vehicles ||
          updatingId === selectedReservation.id ||
          roleRank[context.role] <
            roleRank[
              resolveRequiredRole(policies, selectedReservation.vehicles)
            ]
        }
        onStatusChange={(nextStatus) => {
          if (!selectedReservation) return;
          void handleStatusChange(selectedReservation.id, nextStatus);
        }}
        onClose={() => setSelectedReservation(null)}
      />
    </div>
  );
}

const resolveRequiredRole = (
  policies: ApprovalPolicy[],
  vehicle: { owner_department?: string; owner_scope?: string }
): ProfileRole => {
  const department =
    vehicle.owner_scope === "organization" ? null : vehicle.owner_department;
  const exactPolicy = policies.find(
    (policy) => policy.department === department
  );
  const fallbackPolicy = policies.find((policy) => policy.department === null);
  return (exactPolicy?.required_role ??
    fallbackPolicy?.required_role ??
    "manager") as ProfileRole;
};
