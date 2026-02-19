"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import Notice from "@/components/common/Notice";
import { dispatchNotificationChannelsClient } from "@/lib/notification-dispatch-client";

type TransferRequestRow = {
  id: string;
  asset_id: string | null;
  requester_id: string | null;
  from_department: string | null;
  to_department: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  note: string | null;
  created_at: string;
  resolved_at: string | null;
  assets: {
    name: string;
    owner_department: string;
    owner_scope: string;
  } | null;
};

type StoredFilters = {
  filter?: "mine" | "incoming" | "all";
  statusFilter?: TransferRequestRow["status"] | "all";
  departmentFilter?: string;
  search?: string;
  requesterQuery?: string;
  sortOrder?: "latest" | "status";
};

const getStoredFilters = (): StoredFilters => {
  if (typeof window === "undefined") {
    return {};
  }
  const stored = localStorage.getItem("assetTransferBoardFilters");
  if (!stored) {
    return {};
  }
  try {
    return JSON.parse(stored) as StoredFilters;
  } catch {
    localStorage.removeItem("assetTransferBoardFilters");
    return {};
  }
};

export default function AssetTransferRequestsBoard() {
  const initialFilters = getStoredFilters();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<TransferRequestRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<"admin" | "manager" | "user" | null>(null);
  const [department, setDepartment] = useState<string | null>(null);
  const [filter, setFilter] = useState<"mine" | "incoming" | "all">(initialFilters.filter ?? "mine");
  const [statusFilter, setStatusFilter] = useState<TransferRequestRow["status"] | "all">(
    initialFilters.statusFilter ?? "all"
  );
  const [departmentFilter, setDepartmentFilter] = useState(initialFilters.departmentFilter ?? "all");
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [search, setSearch] = useState(initialFilters.search ?? "");
  const [requesterQuery, setRequesterQuery] = useState(initialFilters.requesterQuery ?? "");
  const [requesterMap, setRequesterMap] = useState<Record<string, string>>({});
  const [sortOrder, setSortOrder] = useState<"latest" | "status">(initialFilters.sortOrder ?? "latest");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function enrichTransferRequests(
    nextRequests: Omit<TransferRequestRow, "assets">[]
  ) {
    const assetIds = nextRequests
      .map((request) => request.asset_id)
      .filter((id): id is string => Boolean(id));

    const assetsMap: Record<
      string,
      NonNullable<TransferRequestRow["assets"]>
    > = {};

    if (assetIds.length > 0) {
      const { data: assetsData } = await supabase
        .from("assets")
        .select("id,name,owner_department,owner_scope")
        .in("id", assetIds);

      (assetsData ?? []).forEach((asset) => {
        assetsMap[asset.id] = {
          name: asset.name,
          owner_department: asset.owner_department,
          owner_scope: asset.owner_scope,
        };
      });
    }

    const requestsWithAssets: TransferRequestRow[] = nextRequests.map(
      (request) => ({
        ...request,
        assets: request.asset_id ? assetsMap[request.asset_id] ?? null : null,
      })
    );

    const departmentSet = new Set<string>();
    nextRequests.forEach((request) => {
      if (request.from_department) departmentSet.add(request.from_department);
      if (request.to_department) departmentSet.add(request.to_department);
    });

    const requesterIds = Array.from(
      new Set(
        nextRequests
          .map((request) => request.requester_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    let requesterNameMap: Record<string, string> = {};
    if (requesterIds.length > 0) {
      const { data: requesterData } = await supabase
        .from("profiles")
        .select("id,name,email")
        .in("id", requesterIds);

      requesterNameMap = {};
      (requesterData ?? []).forEach((row) => {
        requesterNameMap[row.id] = row.name ?? row.email ?? row.id;
      });
    }

    return {
      requestsWithAssets,
      departments: Array.from(departmentSet).sort(),
      requesterNameMap,
    };
  }

  async function fetchTransferBoardData() {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user ?? null;

    if (!user) {
      return {
        user: null,
        profileData: null,
        requestData: [] as Omit<TransferRequestRow, "assets">[],
        requestError: null as string | null,
      };
    }

    const [{ data: profileData }, { data: requestData, error: requestError }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("organization_id,role,department")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("asset_transfer_requests")
          .select(
            "id,asset_id,requester_id,from_department,to_department,status,note,created_at,resolved_at"
          )
          .order("created_at", { ascending: false }),
      ]);

    return {
      user,
      profileData,
      requestData: (requestData ?? []) as Omit<TransferRequestRow, "assets">[],
      requestError: requestError?.message ?? null,
    };
  }

  function applyLoadedBoardState(
    user: { id: string } | null,
    profileData: {
      organization_id: string | null;
      role: "admin" | "manager" | "user" | null;
      department: string | null;
    } | null
  ) {
    setOrganizationId(profileData?.organization_id ?? null);
    setRole((profileData?.role as "admin" | "manager" | "user") ?? null);
    setDepartment(profileData?.department ?? null);
    setUserId(user?.id ?? null);
  }

  useEffect(() => {
    const safeDepartmentFilter =
      departmentFilter === "all" || availableDepartments.includes(departmentFilter)
        ? departmentFilter
        : "all";
    const payload = JSON.stringify({
      filter,
      statusFilter,
      departmentFilter: safeDepartmentFilter,
      search,
      requesterQuery,
      sortOrder,
    });
    localStorage.setItem("assetTransferBoardFilters", payload);
  }, [filter, statusFilter, departmentFilter, search, requesterQuery, sortOrder, availableDepartments]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      const { user, profileData, requestData, requestError } =
        await fetchTransferBoardData();

      if (!user) {
        if (isMounted) {
          setMessage(null);
          setRequests([]);
          setAvailableDepartments([]);
          setRequesterMap({});
          applyLoadedBoardState(null, null);
          setLoading(false);
        }
        return;
      }

      if (!isMounted) return;

      if (requestError) {
        console.error("Error loading transfer requests:", requestError);
        setMessage(requestError);
        setRequests([]);
        setAvailableDepartments([]);
        setRequesterMap({});
      } else {
        const { requestsWithAssets, departments, requesterNameMap } =
          await enrichTransferRequests(requestData);

        if (!isMounted) return;
        setMessage(null);
        setRequests(requestsWithAssets);
        setAvailableDepartments(departments);
        setRequesterMap(requesterNameMap);
      }

      applyLoadedBoardState(user, profileData);
      setLoading(false);
      setLastLoadedAt(new Date().toISOString());
    };

    const timer = setTimeout(() => {
      void load();
    }, 0);

    return () => {
      clearTimeout(timer);
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const effectiveDepartmentFilter =
    departmentFilter === "all" || availableDepartments.includes(departmentFilter)
      ? departmentFilter
      : "all";

  const filteredRequests = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const requesterNormalized = requesterQuery.trim().toLowerCase();
    const filtered = requests.filter((request) => {
      if (filter === "mine") {
        return request.requester_id === userId;
      }
      if (filter === "incoming") {
        return Boolean(
          department && request.to_department && request.to_department === department
        );
      }
      return true;
    }).filter((request) => {
      if (statusFilter !== "all" && request.status !== statusFilter) {
        return false;
      }
      if (
        effectiveDepartmentFilter !== "all" &&
        request.from_department !== effectiveDepartmentFilter &&
        request.to_department !== effectiveDepartmentFilter
      ) {
        return false;
      }
      if (requesterNormalized) {
        const requesterId = request.requester_id ?? "";
        const requesterName = requesterMap[requesterId] ?? requesterId;
        if (!requesterName.toLowerCase().includes(requesterNormalized)) {
          return false;
        }
      }
      if (!normalized) {
        return true;
      }
      const assetName = request.assets?.name ?? "";
      const fromDept = request.from_department ?? "";
      const toDept = request.to_department ?? "";
      return (
        assetName.toLowerCase().includes(normalized) ||
        fromDept.toLowerCase().includes(normalized) ||
        toDept.toLowerCase().includes(normalized)
      );
    });
    if (sortOrder === "status") {
      return [...filtered].sort(
        (a, b) => statusOrder[a.status] - statusOrder[b.status]
      );
    }
    return filtered;
  }, [
    requests,
    filter,
    userId,
    department,
    statusFilter,
    effectiveDepartmentFilter,
    search,
    requesterQuery,
    sortOrder,
    requesterMap,
  ]);

  const statusCounts = useMemo(() => {
    return filteredRequests.reduce(
      (acc, request) => {
        acc[request.status] += 1;
        acc.total += 1;
        return acc;
      },
      {
        pending: 0,
        approved: 0,
        rejected: 0,
        cancelled: 0,
        total: 0,
      }
    );
  }, [filteredRequests]);

  const canResolveRequest = (request: TransferRequestRow) => {
    if (role === "admin") {
      return true;
    }
    if (!department) {
      return false;
    }
    return request.from_department === department;
  };

  const statusFilterButtons: Array<{
    value: TransferRequestRow["status"] | "all";
    label: string;
    count: number;
    activeClassName: string;
    inactiveClassName: string;
  }> = [
    {
      value: "all",
      label: "전체",
      count: statusCounts.total,
      activeClassName: "bg-neutral-900 text-white",
      inactiveClassName:
        "bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50",
    },
    {
      value: "pending",
      label: "대기",
      count: statusCounts.pending,
      activeClassName: "bg-amber-600 text-white",
      inactiveClassName:
        "bg-white text-amber-700 border border-amber-200 hover:bg-amber-50",
    },
    {
      value: "approved",
      label: "승인",
      count: statusCounts.approved,
      activeClassName: "bg-emerald-600 text-white",
      inactiveClassName:
        "bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50",
    },
    {
      value: "rejected",
      label: "거절",
      count: statusCounts.rejected,
      activeClassName: "bg-rose-600 text-white",
      inactiveClassName:
        "bg-white text-rose-700 border border-rose-200 hover:bg-rose-50",
    },
    {
      value: "cancelled",
      label: "취소",
      count: statusCounts.cancelled,
      activeClassName: "bg-neutral-700 text-white",
      inactiveClassName:
        "bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50",
    },
  ];

  const reload = async () => {
    setLoading(true);
    const { user, profileData, requestData, requestError } =
      await fetchTransferBoardData();

    if (!user) {
      setMessage(null);
      setRequests([]);
      setAvailableDepartments([]);
      setRequesterMap({});
      applyLoadedBoardState(null, null);
      setLoading(false);
      return;
    }

    if (requestError) {
      console.error("Error loading transfer requests:", requestError);
      setMessage(requestError);
      setRequests([]);
      setAvailableDepartments([]);
      setRequesterMap({});
    } else {
      const { requestsWithAssets, departments, requesterNameMap } =
        await enrichTransferRequests(requestData);
      setMessage(null);
      setRequests(requestsWithAssets);
      setAvailableDepartments(departments);
      setRequesterMap(requesterNameMap);

    }
    applyLoadedBoardState(user, profileData);
    setLastLoadedAt(new Date().toISOString());
    setLoading(false);
  };

  const handleResolve = async (
    request: TransferRequestRow,
    nextStatus: "approved" | "rejected"
  ) => {
    if (!organizationId || !userId) {
      setMessage("기관 정보를 확인할 수 없습니다.");
      return;
    }

    if (!canResolveRequest(request)) {
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

    if (nextStatus === "approved" && request.asset_id) {
      await supabase
        .from("assets")
        .update({
          owner_scope: "department",
          owner_department: request.to_department ?? "",
        })
        .eq("id", request.asset_id);
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

    const resolveNotificationPayload = {
      resource_id: request.asset_id,
      resource_name: request.assets?.name ?? null,
      asset_id: request.asset_id,
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
      payload: resolveNotificationPayload,
    });
    if (request.requester_id) {
      await dispatchNotificationChannelsClient([
        {
          userId: request.requester_id,
          type:
            nextStatus === "approved"
              ? "asset_transfer_request_approved"
              : "asset_transfer_request_rejected",
          payload: resolveNotificationPayload,
        },
      ]);
    }

    setRequests((prev) =>
      prev.map((item) =>
        item.id === request.id ? { ...item, status: nextStatus } : item
      )
    );
    setUpdatingId(null);
    setToast(nextStatus === "approved" ? "요청을 승인했습니다." : "요청을 거절했습니다.");
    await reload();
  };

  const handleCancel = async (request: TransferRequestRow) => {
    if (!organizationId || !userId) {
      setMessage("기관 정보를 확인할 수 없습니다.");
      return;
    }

    if (request.requester_id !== userId) {
      setMessage("요청자만 취소할 수 있습니다.");
      return;
    }

    setUpdatingId(request.id);
    setMessage(null);

    const { error } = await supabase
      .from("asset_transfer_requests")
      .update({ status: "cancelled", resolved_at: new Date().toISOString() })
      .eq("id", request.id);

    if (error) {
      setMessage(error.message);
      setUpdatingId(null);
      return;
    }

    await supabase.from("audit_logs").insert({
      organization_id: organizationId,
      actor_id: userId,
      action: "asset_transfer_request_cancelled",
      target_type: "asset_transfer_request",
      target_id: request.id,
      metadata: {
        from_department: request.from_department,
        to_department: request.to_department,
      },
    });

    const cancelNotificationPayload = {
      resource_id: request.asset_id,
      resource_name: request.assets?.name ?? null,
      asset_id: request.asset_id,
      from_department: request.from_department,
      to_department: request.to_department,
    };

    await supabase.from("notifications").insert({
      organization_id: organizationId,
      user_id: userId,
      type: "asset_transfer_request_cancelled",
      channel: "kakao",
      status: "pending",
      payload: cancelNotificationPayload,
    });
    await dispatchNotificationChannelsClient([
      {
        userId,
        type: "asset_transfer_request_cancelled",
        payload: cancelNotificationPayload,
      },
    ]);

    setRequests((prev) =>
      prev.map((item) =>
        item.id === request.id ? { ...item, status: "cancelled" } : item
      )
    );
    setUpdatingId(null);
    setToast("요청을 취소했습니다.");
    await reload();
  };

  if (loading) {
    return (
      <Notice>이동 요청을 불러오는 중입니다.</Notice>
    );
  }

  if (!userId) {
    return (
      <Notice>
        로그인 후 이동 요청을 확인할 수 있습니다.{" "}
        <a href="/login" className="underline">
          로그인
        </a>
        으로 이동해 주세요.
      </Notice>
    );
  }

  return (
    <div className="manage-stack">
      <div className="surface-card p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">불용품 양도 요청</h2>
            <p className="mt-1 text-sm text-neutral-600">
              내 요청과 내 부서로 들어온 요청을 확인할 수 있습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={reload}
            className="icon-button"
            title="새로고침"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
        {lastLoadedAt && (
          <p className="mt-2 text-[11px] text-neutral-500 sm:text-xs">
            최근 갱신: {formatDateTime(lastLoadedAt)}
          </p>
        )}
        {/* 탭 메뉴 */}
        <div className="mt-4 -mx-1 overflow-x-auto px-1 pb-1">
          <nav className="flex w-max min-w-full items-center gap-2" aria-label="요청 탭">
            <button
              type="button"
              onClick={() => setFilter("mine")}
              className={`filter-pill ${filter === "mine" ? "filter-pill-active" : ""}`}
            >
              내 요청
            </button>
            <button
              type="button"
              onClick={() => setFilter("incoming")}
              className={`filter-pill ${filter === "incoming" ? "filter-pill-active" : ""}`}
            >
              내 부서 요청
            </button>
            {(role === "admin" || role === "manager") && (
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`filter-pill ${filter === "all" ? "filter-pill-active" : ""}`}
              >
                전체
              </button>
            )}
          </nav>
        </div>
        
        {/* 상태 필터 버튼 */}
        <div className="mt-4 -mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
          <div className="flex w-max min-w-full items-center gap-2">
            {statusFilterButtons.map((button) => (
              <button
                key={button.value}
                type="button"
                onClick={() => setStatusFilter(button.value)}
                className={`h-[38px] px-4 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center justify-center ${
                  statusFilter === button.value
                    ? button.activeClassName
                    : button.inactiveClassName
                }`}
              >
                {button.label} {button.count}
                {button.value === "all" ? "건" : ""}
              </button>
            ))}
          </div>
        </div>
      </div>

      {message && <Notice variant="error">{message}</Notice>}
      {toast && <Notice variant="success">{toast}</Notice>}

      <div className="module-toolbar">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <select
            className="form-select w-full"
            value={sortOrder}
            onChange={(event) =>
              setSortOrder(event.target.value as "latest" | "status")
            }
          >
            <option value="latest">최신순</option>
            <option value="status">상태순</option>
          </select>
          <select
            className="form-select w-full"
            value={effectiveDepartmentFilter}
            onChange={(event) => setDepartmentFilter(event.target.value)}
          >
            <option value="all">전체 부서</option>
            {availableDepartments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
          <input
            className="form-input w-full"
            placeholder="자산/부서 검색"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <input
            className="form-input w-full"
            placeholder="요청자 이름/이메일 검색"
            value={requesterQuery}
            onChange={(event) => setRequesterQuery(event.target.value)}
          />
        </div>
      </div>
      <p className="text-xs text-neutral-400">
        요청자 검색은 이름/이메일 기준으로 동작하며, 정보는 기관 내 사용자만 표시됩니다.
      </p>

      {filteredRequests.length === 0 ? (
        <Notice>
          <p>요청이 없습니다.</p>
        </Notice>
      ) : (
        <div className="space-y-2">
          {filteredRequests.map((request) => (
            <div
              key={request.id}
              className="list-row text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {request.assets?.name ?? "자산"} ·{" "}
                    {request.from_department ?? "미등록"} →{" "}
                    {request.to_department ?? "미등록"}
                  </p>
                  <p className="text-xs text-neutral-500">
                    요청자: {request.requester_id ? (requesterMap[request.requester_id] ?? shortId(request.requester_id)) : "미등록"}
                  </p>
                  <span
                    className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] ${statusBadge[request.status]}`}
                  >
                    {statusLabel[request.status]}
                  </span>
                </div>
                {request.status === "pending" && (
                  <div className="flex items-center gap-2">
                    {request.requester_id === userId && (
                      <button
                        type="button"
                        onClick={() => handleCancel(request)}
                        disabled={updatingId === request.id}
                        className="btn-outline h-[38px]"
                      >
                        취소
                      </button>
                    )}
                    {canResolveRequest(request) && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleResolve(request, "approved")}
                        disabled={updatingId === request.id}
                        className="btn-primary h-[38px]"
                      >
                        승인
                      </button>
                        <button
                          type="button"
                          onClick={() => handleResolve(request, "rejected")}
                        disabled={updatingId === request.id}
                        className="btn-outline h-[38px] border-rose-200 text-rose-600 hover:bg-rose-50"
                      >
                        거절
                      </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              {request.note && (
                <p className="mt-2 text-xs text-neutral-500">
                  사유:{" "}
                  <span className="rounded bg-neutral-100 px-2 py-0.5 text-neutral-700">
                    {request.note}
                  </span>
                </p>
              )}
              <p className="mt-1 text-xs text-neutral-400">
                요청일: {formatDateTime(request.created_at)}
                {request.resolved_at && (
                  <span> · 처리일: {formatDateTime(request.resolved_at)}</span>
                )}
              </p>
            </div>
          ))}
        </div>
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

const statusBadge: Record<
  "pending" | "approved" | "rejected" | "cancelled",
  string
> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
  cancelled: "bg-neutral-100 text-neutral-600",
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

const shortId = (value: string) => {
  if (value.length <= 8) {
    return value;
  }
  return `${value.slice(0, 8)}…`;
};

const statusOrder: Record<
  "pending" | "approved" | "rejected" | "cancelled",
  number
> = {
  pending: 1,
  approved: 2,
  rejected: 3,
  cancelled: 4,
};
