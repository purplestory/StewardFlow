"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import Notice from "@/components/common/Notice";

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

export default function AssetTransferRequestsBoard() {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<TransferRequestRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<"admin" | "manager" | "user" | null>(null);
  const [department, setDepartment] = useState<string | null>(null);
  const [filter, setFilter] = useState<"mine" | "incoming" | "all">("mine");
  const [statusFilter, setStatusFilter] = useState<TransferRequestRow["status"] | "all">("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [requesterQuery, setRequesterQuery] = useState("");
  const [requesterMap, setRequesterMap] = useState<Record<string, string>>({});
  const [sortOrder, setSortOrder] = useState<"latest" | "status">("latest");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("assetTransferBoardFilters");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as {
        filter?: "mine" | "incoming" | "all";
        statusFilter?: TransferRequestRow["status"] | "all";
        departmentFilter?: string;
        search?: string;
        requesterQuery?: string;
        sortOrder?: "latest" | "status";
      };
      if (parsed.filter) setFilter(parsed.filter);
      if (parsed.statusFilter) setStatusFilter(parsed.statusFilter);
      if (parsed.departmentFilter) setDepartmentFilter(parsed.departmentFilter);
      if (parsed.search) setSearch(parsed.search);
      if (parsed.requesterQuery) setRequesterQuery(parsed.requesterQuery);
      if (parsed.sortOrder) setSortOrder(parsed.sortOrder);
    } catch {
      localStorage.removeItem("assetTransferBoardFilters");
    }
  }, []);

  useEffect(() => {
    const payload = JSON.stringify({
      filter,
      statusFilter,
      departmentFilter,
      search,
      requesterQuery,
      sortOrder,
    });
    localStorage.setItem("assetTransferBoardFilters", payload);
  }, [filter, statusFilter, departmentFilter, search, requesterQuery, sortOrder]);

  useEffect(() => {
    if (departmentFilter === "all") return;
    if (!availableDepartments.includes(departmentFilter)) {
      setDepartmentFilter("all");
    }
  }, [availableDepartments, departmentFilter]);

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

      const { data: requestData, error } = await supabase
        .from("asset_transfer_requests")
        .select(
          "id,asset_id,requester_id,from_department,to_department,status,note,created_at,resolved_at"
        )
        .order("created_at", { ascending: false });

      if (!isMounted) return;

      if (error) {
        console.error("Error loading transfer requests:", error);
        setMessage(error.message);
        setRequests([]);
        setAvailableDepartments([]);
        setRequesterMap({});
      } else {
        const nextRequests = (requestData ?? []) as Omit<TransferRequestRow, 'assets'>[];
        
        // assets 정보를 별도로 조회
        const assetIds = nextRequests
          .map((r) => r.asset_id)
          .filter((id): id is string => Boolean(id));
        
        let assetsMap: Record<string, { name: string; owner_department: string; owner_scope: string }> = {};
        
        if (assetIds.length > 0) {
          const { data: assetsData } = await supabase
            .from("assets")
            .select("id,name,owner_department,owner_scope")
            .in("id", assetIds);
          
          if (assetsData) {
            assetsData.forEach((asset) => {
              assetsMap[asset.id] = {
                name: asset.name,
                owner_department: asset.owner_department,
                owner_scope: asset.owner_scope,
              };
            });
          }
        }
        
        // requests에 assets 정보 추가
        const requestsWithAssets: TransferRequestRow[] = nextRequests.map((request) => ({
          ...request,
          assets: request.asset_id ? assetsMap[request.asset_id] || null : null,
        }));
        
        setRequests(requestsWithAssets);
        const departmentSet = new Set<string>();
        nextRequests.forEach((request) => {
          if (request.from_department) departmentSet.add(request.from_department);
          if (request.to_department) departmentSet.add(request.to_department);
        });
        setAvailableDepartments(Array.from(departmentSet).sort());

        const requesterIds = Array.from(
          new Set(
            nextRequests
              .map((request) => request.requester_id)
              .filter((id): id is string => Boolean(id))
          )
        );

        if (requesterIds.length > 0) {
          const { data: requesterData } = await supabase
            .from("profiles")
            .select("id,name,email")
            .in("id", requesterIds);

          const map: Record<string, string> = {};
          (requesterData ?? []).forEach((row) => {
            map[row.id] = row.name ?? row.email ?? row.id;
          });
          setRequesterMap(map);
        } else {
          setRequesterMap({});
        }
      }

      setOrganizationId(profileData?.organization_id ?? null);
      setRole((profileData?.role as "admin" | "manager" | "user") ?? "user");
      setDepartment(profileData?.department ?? null);
      setUserId(user.id);
      setLoading(false);
      setLastLoadedAt(new Date().toISOString());
    };

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

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
        departmentFilter !== "all" &&
        request.from_department !== departmentFilter &&
        request.to_department !== departmentFilter
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
  }, [requests, filter, userId, department, statusFilter, departmentFilter, search, requesterQuery, sortOrder, requesterMap]);

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

  const canManage =
    role === "admin" ||
    role === "manager" ||
    (department &&
      filteredRequests.some(
        (request) => request.from_department === department
      ));

  const reload = async () => {
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
      .select(
        "id,asset_id,requester_id,from_department,to_department,status,note,created_at,resolved_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading transfer requests:", error);
      setMessage(error.message);
      setRequests([]);
      setAvailableDepartments([]);
      setRequesterMap({});
    } else {
      const nextRequests = (requestData ?? []) as Omit<TransferRequestRow, 'assets'>[];
      
      // assets 정보를 별도로 조회
      const assetIds = nextRequests
        .map((r) => r.asset_id)
        .filter((id): id is string => Boolean(id));
      
      let assetsMap: Record<string, { name: string; owner_department: string; owner_scope: string }> = {};
      
      if (assetIds.length > 0) {
        const { data: assetsData } = await supabase
          .from("assets")
          .select("id,name,owner_department,owner_scope")
          .in("id", assetIds);
        
        if (assetsData) {
          assetsData.forEach((asset) => {
            assetsMap[asset.id] = {
              name: asset.name,
              owner_department: asset.owner_department,
              owner_scope: asset.owner_scope,
            };
          });
        }
      }
      
      // requests에 assets 정보 추가
      const requestsWithAssets: TransferRequestRow[] = nextRequests.map((request) => ({
        ...request,
        assets: request.asset_id ? assetsMap[request.asset_id] || null : null,
      }));
      
      setRequests(requestsWithAssets);
      const departmentSet = new Set<string>();
      nextRequests.forEach((request) => {
        if (request.from_department) departmentSet.add(request.from_department);
        if (request.to_department) departmentSet.add(request.to_department);
      });
      setAvailableDepartments(Array.from(departmentSet).sort());

      const requesterIds = Array.from(
        new Set(
          nextRequests
            .map((request) => request.requester_id)
            .filter((id): id is string => Boolean(id))
        )
      );

      if (requesterIds.length > 0) {
        const { data: requesterData } = await supabase
          .from("profiles")
          .select("id,name,email")
          .in("id", requesterIds);

        const map: Record<string, string> = {};
        (requesterData ?? []).forEach((row) => {
          map[row.id] = row.name ?? row.email ?? row.id;
        });
        setRequesterMap(map);
      } else {
        setRequesterMap({});
      }

      setOrganizationId(profileData?.organization_id ?? null);
      setRole((profileData?.role as "admin" | "manager" | "user") ?? "user");
      setDepartment(profileData?.department ?? null);
      setUserId(user.id);
    }
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

    if (role === "user" && request.from_department !== department) {
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

    await supabase.from("notifications").insert({
      organization_id: organizationId,
      user_id: request.requester_id,
      type:
        nextStatus === "approved"
          ? "asset_transfer_request_approved"
          : "asset_transfer_request_rejected",
      channel: "kakao",
      status: "pending",
      payload: {
        resource_id: request.asset_id,
        resource_name: request.assets?.name ?? null,
        asset_id: request.asset_id,
        from_department: request.from_department,
        to_department: request.to_department,
      },
    });

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

    await supabase.from("notifications").insert({
      organization_id: organizationId,
      user_id: userId,
      type: "asset_transfer_request_cancelled",
      channel: "kakao",
      status: "pending",
      payload: {
        resource_id: request.asset_id,
        resource_name: request.assets?.name ?? null,
        asset_id: request.asset_id,
        from_department: request.from_department,
        to_department: request.to_department,
      },
    });

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
    <div className="space-y-4">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">불용품 양도 요청</h1>
            <p className="mt-2 text-sm text-neutral-600">
              내 요청과 내 부서로 들어온 요청을 확인할 수 있습니다.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastLoadedAt && (
              <span className="text-xs text-neutral-500 whitespace-nowrap">
                최근 갱신: {formatDateTime(lastLoadedAt)}
              </span>
            )}
            <button
              type="button"
              onClick={reload}
              className="p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors"
              title="새로고침"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
        {/* 탭 메뉴 */}
        <div className="mt-4 border-b border-neutral-200">
          <nav className="-mb-px flex space-x-1" aria-label="요청 탭">
            <button
              type="button"
              onClick={() => setFilter("mine")}
              className={`
                whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors
                ${
                  filter === "mine"
                    ? "border-black text-black"
                    : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700"
                }
              `}
            >
              내 요청
            </button>
            <button
              type="button"
              onClick={() => setFilter("incoming")}
              className={`
                whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors
                ${
                  filter === "incoming"
                    ? "border-black text-black"
                    : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700"
                }
              `}
            >
              내 부서 요청
            </button>
            {(role === "admin" || role === "manager") && (
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`
                  whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors
                  ${
                    filter === "all"
                      ? "border-black text-black"
                      : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700"
                  }
                `}
              >
                전체
              </button>
            )}
          </nav>
        </div>
        
        {/* 상태 필터 버튼 */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`h-[38px] px-4 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center justify-center ${
              statusFilter === "all"
                ? "bg-neutral-900 text-white"
                : "bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50"
            }`}
          >
            전체 {statusCounts.total}건
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("pending")}
            className={`h-[38px] px-4 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center justify-center ${
              statusFilter === "pending"
                ? "bg-amber-600 text-white"
                : "bg-white text-amber-700 border border-amber-200 hover:bg-amber-50"
            }`}
          >
            대기 {statusCounts.pending}
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("approved")}
            className={`h-[38px] px-4 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center justify-center ${
              statusFilter === "approved"
                ? "bg-emerald-600 text-white"
                : "bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50"
            }`}
          >
            승인 {statusCounts.approved}
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("rejected")}
            className={`h-[38px] px-4 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center justify-center ${
              statusFilter === "rejected"
                ? "bg-rose-600 text-white"
                : "bg-white text-rose-700 border border-rose-200 hover:bg-rose-50"
            }`}
          >
            거절 {statusCounts.rejected}
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("cancelled")}
            className={`h-[38px] px-4 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center justify-center ${
              statusFilter === "cancelled"
                ? "bg-neutral-700 text-white"
                : "bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50"
            }`}
          >
            취소 {statusCounts.cancelled}
          </button>
        </div>
      </div>

      {message && <Notice variant="error">{message}</Notice>}
      {toast && <Notice variant="success">{toast}</Notice>}

      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="form-select"
            value={sortOrder}
            onChange={(event) =>
              setSortOrder(event.target.value as "latest" | "status")
            }
          >
            <option value="latest">최신순</option>
            <option value="status">상태순</option>
          </select>
          <select
            className="form-select"
            value={departmentFilter}
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
            className="form-input"
            placeholder="자산/부서 검색"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <input
            className="form-input"
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
              className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm"
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
                        className="h-[38px] px-4 rounded-lg text-sm font-medium transition-all bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50 whitespace-nowrap flex items-center justify-center"
                      >
                        취소
                      </button>
                    )}
                    {canManage && request.from_department === department && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleResolve(request, "approved")}
                          disabled={updatingId === request.id}
                          className="h-[38px] px-4 rounded-lg text-sm font-medium transition-all bg-neutral-900 text-white hover:bg-neutral-800 whitespace-nowrap flex items-center justify-center"
                        >
                          승인
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResolve(request, "rejected")}
                          disabled={updatingId === request.id}
                          className="h-[38px] px-4 rounded-lg text-sm font-medium transition-all bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 hover:border-rose-300 whitespace-nowrap flex items-center justify-center"
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
