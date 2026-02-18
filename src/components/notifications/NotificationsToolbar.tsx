"use client";

type NotificationsToolbarProps = {
  unreadCount: number;
  updating: boolean;
  showUnreadOnly: boolean;
  setShowUnreadOnly: (value: boolean) => void;
  markAllAsRead: () => void;
  load: () => void;
  sortOrder: "latest" | "unread" | "status";
  setSortOrder: (value: "latest" | "unread" | "status") => void;
  showAdvancedFilters: boolean;
  setShowAdvancedFilters: (value: boolean) => void;
  compactView: boolean;
  setCompactView: (value: boolean) => void;
  query: string;
  setQuery: (value: string) => void;
  typeFilter: string;
  setTypeFilter: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  pageSize: number;
  setPageSize: (value: number) => void;
  setPage: (value: number) => void;
};

export default function NotificationsToolbar({
  unreadCount,
  updating,
  showUnreadOnly,
  setShowUnreadOnly,
  markAllAsRead,
  load,
  sortOrder,
  setSortOrder,
  showAdvancedFilters,
  setShowAdvancedFilters,
  compactView,
  setCompactView,
  query,
  setQuery,
  typeFilter,
  setTypeFilter,
  statusFilter,
  setStatusFilter,
  pageSize,
  setPageSize,
  setPage,
}: NotificationsToolbarProps) {
  return (
    <div className="surface-card space-y-4 p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="chip-muted">미읽음 {unreadCount}건</span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="btn-ghost"
          >
            새로고침
          </button>
          <button
            type="button"
            onClick={markAllAsRead}
            disabled={updating || unreadCount === 0}
            className="btn-ghost disabled:opacity-60"
          >
            모두 읽음 처리
          </button>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-[10rem_minmax(0,1fr)_auto]">
        <select
          className="form-select h-10 text-sm"
          value={sortOrder}
          onChange={(event) => {
            setSortOrder(event.target.value as "latest" | "unread" | "status");
            setPage(1);
          }}
        >
          <option value="latest">최신순</option>
          <option value="unread">미읽음 우선</option>
          <option value="status">상태 우선</option>
        </select>
        <input
          className="form-input h-10 text-sm"
          placeholder="검색어 입력"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
        />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="flex items-center gap-2 text-sm text-neutral-600">
            <input
              type="checkbox"
              checked={showUnreadOnly}
              onChange={(event) => {
                setShowUnreadOnly(event.target.checked);
                setPage(1);
              }}
            />
            미읽음만 보기
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-600">
            <input
              type="checkbox"
              checked={compactView}
              onChange={(event) => setCompactView(event.target.checked)}
            />
            컴팩트 보기
          </label>
          <button
            type="button"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="btn-ghost text-sm"
          >
            {showAdvancedFilters ? "필터 접기" : "필터 열기"}
          </button>
        </div>
      </div>

      <div
        className={`rounded-xl border border-neutral-200 bg-neutral-50 p-3 ${showAdvancedFilters ? "block" : "hidden"} md:block`}
      >
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <select
            className="form-select h-10 text-sm"
            value={typeFilter}
            onChange={(event) => {
              setTypeFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">전체 유형</option>
            <option value="reservation_created">물품 예약 신청</option>
            <option value="reservation_status_changed">물품 예약 상태 변경</option>
            <option value="space_reservation_created">공간 예약 신청</option>
            <option value="space_reservation_status_changed">공간 예약 상태 변경</option>
            <option value="asset_transfer_request_created">불용품 양도 요청</option>
            <option value="asset_transfer_request_approved">불용품 양도 요청 승인</option>
            <option value="asset_transfer_request_rejected">불용품 양도 요청 거절</option>
            <option value="asset_transfer_request_cancelled">불용품 양도 요청 취소</option>
          </select>
          <select
            className="form-select h-10 text-sm"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">전체 상태</option>
            <option value="pending">대기</option>
            <option value="sent">발송 완료</option>
            <option value="failed">실패</option>
          </select>
          <select
            className="form-select h-10 text-sm"
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
          >
            <option value={5}>5개씩</option>
            <option value={10}>10개씩</option>
            <option value={20}>20개씩</option>
          </select>
        </div>
      </div>
    </div>
  );
}
