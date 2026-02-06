"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import Notice from "@/components/common/Notice";

type AuditLogRow = {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
};

const actionLabel: Record<string, string> = {
  role_update: "권한 변경",
  invite_sent: "초대 발송",
  invite_accepted: "초대 수락",
  invite_resent: "초대 재전송",
  invite_revoked: "초대 취소",
  asset_reservation_status_update: "자산 예약 상태 변경",
  space_reservation_status_update: "공간 예약 상태 변경",
  approval_policy_create: "승인 정책 생성",
  approval_policy_update: "승인 정책 변경",
  approval_policy_delete: "승인 정책 삭제",
  approval_policy_template_create: "승인 정책 템플릿 생성",
  asset_status_bulk_update: "자산 상태 일괄 변경",
  space_status_bulk_update: "공간 상태 일괄 변경",
  asset_create: "자산 등록",
  space_create: "공간 등록",
  asset_status_update: "자산 상태 변경",
  asset_department_transfer: "자산 부서 이동",
  asset_transfer_request_create: "불용품 양도 요청",
  asset_transfer_request_approved: "불용품 양도 요청 승인",
  asset_transfer_request_rejected: "불용품 양도 요청 거절",
  asset_transfer_request_cancelled: "불용품 양도 요청 취소",
};

const actionOptions = [
  { value: "all", label: "전체 행동" },
  { value: "role_update", label: "권한 변경" },
  { value: "invite_sent", label: "초대 발송" },
  { value: "invite_accepted", label: "초대 수락" },
  { value: "invite_resent", label: "초대 재전송" },
  { value: "invite_revoked", label: "초대 취소" },
  { value: "asset_reservation_status_update", label: "자산 예약 상태 변경" },
  { value: "space_reservation_status_update", label: "공간 예약 상태 변경" },
  { value: "approval_policy_create", label: "승인 정책 생성" },
  { value: "approval_policy_update", label: "승인 정책 변경" },
  { value: "approval_policy_delete", label: "승인 정책 삭제" },
  {
    value: "approval_policy_template_create",
    label: "승인 정책 템플릿 생성",
  },
  { value: "asset_status_bulk_update", label: "자산 상태 일괄 변경" },
  { value: "space_status_bulk_update", label: "공간 상태 일괄 변경" },
  { value: "asset_create", label: "자산 등록" },
  { value: "space_create", label: "공간 등록" },
  { value: "asset_status_update", label: "자산 상태 변경" },
  { value: "asset_department_transfer", label: "자산 부서 이동" },
  { value: "asset_transfer_request_create", label: "불용품 양도 요청" },
  { value: "asset_transfer_request_approved", label: "불용품 양도 요청 승인" },
  { value: "asset_transfer_request_rejected", label: "불용품 양도 요청 거절" },
  { value: "asset_transfer_request_cancelled", label: "불용품 양도 요청 취소" },
];

export default function AuditLogList() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [actorQuery, setActorQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setMessage(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user ?? null;

    if (!user) {
      setLogs([]);
      setLoading(false);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      setMessage(profileError.message);
      setLoading(false);
      return;
    }

    if (profileData?.role === "user") {
      setMessage("감사 로그는 관리자만 조회할 수 있습니다.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("audit_logs")
      .select("id,action,target_type,target_id,metadata,created_at,actor_id")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      setMessage(error.message);
      setLogs([]);
    } else {
      const baseLogs = (data ?? []) as AuditLogRow[];
      const actorIds = Array.from(
        new Set(baseLogs.map((log) => log.actor_id).filter(Boolean))
      ) as string[];

      if (actorIds.length === 0) {
        setLogs(
          baseLogs.map((log) => ({
            ...log,
            actor_name: null,
            actor_email: null,
          }))
        );
      } else {
        const { data: actorData } = await supabase
          .from("profiles")
          .select("id,name,email")
          .in("id", actorIds);

        const actorMap = new Map(
          (actorData ?? []).map((actor) => [
            actor.id,
            { name: actor.name ?? null, email: actor.email ?? null },
          ])
        );

        setLogs(
          baseLogs.map((log) => {
            const actor = log.actor_id ? actorMap.get(log.actor_id) : null;
            return {
              ...log,
              actor_name: actor?.name ?? null,
              actor_email: actor?.email ?? null,
            };
          })
        );
      }
    }

    setLastLoadedAt(new Date().toISOString());
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filteredLogs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const actorNormalized = actorQuery.trim().toLowerCase();
    return logs.filter((log) => {
      if (actionFilter !== "all" && log.action !== actionFilter) {
        return false;
      }
      if (
        (dateFrom || dateTo) &&
        !isWithinDateRange(log.created_at, dateFrom, dateTo)
      ) {
        return false;
      }
      if (actorNormalized) {
        const actorText = `${log.actor_name ?? ""} ${log.actor_email ?? ""}`
          .toLowerCase()
          .trim();
        if (!actorText.includes(actorNormalized)) {
          return false;
        }
      }
      if (!normalized) {
        return true;
      }
      const target = `${log.target_type} ${log.target_id ?? ""}`.toLowerCase();
      const metadata = JSON.stringify(log.metadata ?? {}).toLowerCase();
      return target.includes(normalized) || metadata.includes(normalized);
    });
  }, [logs, query, actionFilter, actorQuery, dateFrom, dateTo]);

  if (loading) {
    return (
      <Notice>감사 로그를 불러오는 중입니다.</Notice>
    );
  }

  if (message) {
    return (
      <Notice variant="error">{message}</Notice>
    );
  }

  if (logs.length === 0) {
    return (
      <Notice>로그가 없습니다.</Notice>
    );
  }

  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="form-input h-[38px] text-xs"
          placeholder="검색어 입력"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <input
          className="form-input h-[38px] text-xs"
          placeholder="담당자 이름/이메일"
          value={actorQuery}
          onChange={(event) => setActorQuery(event.target.value)}
        />
        <input
          type="date"
          className="form-input h-[38px] text-xs"
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
        />
        <input
          type="date"
          className="form-input h-[38px] text-xs"
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
        />
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setActorQuery("");
            setDateFrom("");
            setDateTo("");
            setActionFilter("all");
          }}
          className="btn-ghost"
        >
          필터 초기화
        </button>
        <button
          type="button"
          onClick={load}
          className="btn-ghost"
        >
          새로고침
        </button>
        <select
          className="form-select h-10 text-xs"
          value={actionFilter}
          onChange={(event) => setActionFilter(event.target.value)}
        >
          {actionOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
        <span>총 {filteredLogs.length}건</span>
        {lastLoadedAt && (
          <span>최근 갱신: {formatDateTime(lastLoadedAt)}</span>
        )}
      </div>
      {filteredLogs.length === 0 ? (
        <Notice>
          <p>조건에 맞는 로그가 없습니다.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setActionFilter("all");
              setActorQuery("");
              setDateFrom("");
              setDateTo("");
            }}
            className="mt-3 px-4 py-2 rounded-lg text-sm font-medium transition-all bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50"
          >
            필터 초기화
          </button>
        </Notice>
      ) : (
        filteredLogs.map((log) => (
        <div
          key={log.id}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2"
        >
          <p className="text-sm font-medium">
            {actionLabel[log.action] ?? log.action}
          </p>
          <p className="text-xs text-neutral-500">
            대상: {log.target_type} {log.target_id ?? ""}
          </p>
          <p className="text-xs text-neutral-500">
            담당자: {log.actor_name ?? log.actor_email ?? "미상"}
          </p>
          <p className="text-xs text-neutral-500">
            시간: {formatDateTime(log.created_at)}
          </p>
          {log.metadata && (
            <pre className="mt-2 whitespace-pre-wrap rounded bg-neutral-50 p-2 text-[10px] text-neutral-600">
              {JSON.stringify(log.metadata, null, 2)}
            </pre>
          )}
        </div>
        ))
      )}
    </div>
  );
}

const parseLocalDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day);
};

const isWithinDateRange = (value: string, from: string, to: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return true;
  }

  if (from) {
    const start = parseLocalDate(from);
    if (start && date < start) {
      return false;
    }
  }

  if (to) {
    const end = parseLocalDate(to);
    if (end) {
      end.setHours(23, 59, 59, 999);
      if (date > end) {
        return false;
      }
    }
  }

  return true;
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
