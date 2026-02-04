import AssetDetailClient from "@/components/assets/AssetDetailClient";

type AssetDetailPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function AssetDetailPage({
  params,
}: AssetDetailPageProps) {
  const { id } = await params;
  
  if (!id || typeof id !== "string") {
    return null;
  }

  // Use client component to fetch data with proper session
  return <AssetDetailClient />;

  const approvalPolicies = await listApprovalPoliciesByOrg(
    "asset",
    asset.organization_id
  );
  const requiredRole = resolveRequiredRole(
    approvalPolicies,
    asset.owner_scope,
    asset.owner_department
  );

  const statusLabel: Record<AssetReservationSummary["status"], string> = {
    pending: "승인 대기",
    approved: "승인됨",
    returned: "반납 완료",
    rejected: "반려",
  };
  const assetStatusLabel: Record<
    "available" | "rented" | "repair" | "lost" | "retired",
    string
  > = {
    available: "대여 가능",
    rented: "대여 중",
    repair: "수리 중",
    lost: "분실",
    retired: "불용품",
  };
  const mobilityLabel: Record<"fixed" | "movable", string> = {
    fixed: "고정",
    movable: "이동",
  };
  const usableUntilLabel = asset.usable_until
    ? formatDate(asset.usable_until)
    : "미등록";
  const loanableLabel = asset.loanable === false ? "대여 불가" : "대여 가능";
  const purchaseDateLabel = asset.purchase_date
    ? formatDate(asset.purchase_date)
    : "미등록";
  const purchasePriceLabel = asset.purchase_price
    ? `${asset.purchase_price.toLocaleString("ko-KR")}원`
    : "미등록";
  const usefulLifeLabel = asset.useful_life_years
    ? `${asset.useful_life_years}년`
    : "미등록";
  const lastUsedLabel = asset.last_used_at
    ? formatDateTime(asset.last_used_at)
    : "미등록";
  const tags = asset.tags ?? [];

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-6 md:flex-row">
        <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-neutral-100 md:w-1/2">
          {asset.image_url ? (
            <img
              src={asset.image_url}
              alt={asset.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-neutral-400">
              이미지 없음
            </div>
          )}
        </div>
        <div className="flex-1 space-y-3">
          <h1 className="text-2xl font-semibold">{asset.name}</h1>
          <p className="text-sm text-neutral-600">
            소유 부서: {asset.owner_department}
          </p>
          <p className="text-sm text-neutral-600">
            설치(보관) 장소: {asset.location || "미등록"}
          </p>
          <p className="text-sm text-neutral-600">
            상태: {assetStatusLabel[asset.status]}
          </p>
          <p className="text-sm text-neutral-600">수량: {asset.quantity}</p>
          <p className="text-sm text-neutral-600">
            이동:{" "}
            {asset.mobility
              ? mobilityLabel[asset.mobility]
              : mobilityLabel.movable}
          </p>
          <p className="text-sm text-neutral-600">대여: {loanableLabel}</p>
          <p className="text-sm text-neutral-600">
            사용 기한: {usableUntilLabel}
          </p>
          <p className="text-sm text-neutral-600">구입일: {purchaseDateLabel}</p>
          <p className="text-sm text-neutral-600">
            구입 금액: {purchasePriceLabel}
          </p>
          <p className="text-sm text-neutral-600">
            사용 수명: {usefulLifeLabel}
          </p>
          <p className="text-sm text-neutral-600">
            마지막 사용: {lastUsedLabel}
          </p>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 text-xs text-neutral-600">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-neutral-100 px-2 py-0.5"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <AssetReservationSection
        assetId={asset.id}
        reservations={reservations}
        assetStatus={asset.status}
        requiredRole={requiredRole}
        isLoanable={asset.loanable}
        usableUntil={asset.usable_until}
      />

      <AssetTransferRequest
        assetId={asset.id}
        organizationId={asset.organization_id}
        assetStatus={asset.status}
        ownerDepartment={asset.owner_department}
        assetName={asset.name}
      />

      <AssetTransferRequestsPanel
        assetId={asset.id}
        assetName={asset.name}
        ownerDepartment={asset.owner_department}
        ownerScope={asset.owner_scope}
      />

      <AssetAdminActions
        assetId={asset.id}
        assetStatus={asset.status}
        ownerScope={asset.owner_scope}
        ownerDepartment={asset.owner_department}
      />

      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold">예약 현황</h2>
        <p className="mt-2 text-sm text-neutral-600">
          승인 대기 및 승인된 예약이 표시됩니다.
        </p>
        <div className="mt-4 space-y-3">
          {reservations.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
              예약 내역이 없습니다.
            </div>
          ) : (
            reservations.map((reservation) => (
              <div
                key={reservation.id}
                className="rounded-lg border border-neutral-200 px-4 py-3"
              >
                <p className="text-sm font-medium">
                  {reservation.start_date} ~ {reservation.end_date}
                </p>
                <p className="text-xs text-neutral-500">
                  상태: {statusLabel[reservation.status]}
                </p>
                <p className="text-xs text-neutral-500">
                  신청자: {reservation.borrower_id}
                </p>
                {reservation.note && (
                  <p className="mt-1 text-xs text-neutral-400">
                    메모: {reservation.note}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

const resolveRequiredRole = (
  policies: Array<{ department: string | null; required_role: string }>,
  ownerScope: "organization" | "department",
  department: string
) => {
  const targetDepartment = ownerScope === "organization" ? null : department;
  const exactPolicy = policies.find(
    (policy) => policy.department === targetDepartment
  );
  const fallbackPolicy = policies.find((policy) => policy.department === null);
  return (exactPolicy?.required_role ??
    fallbackPolicy?.required_role ??
    "manager") as "admin" | "manager" | "user";
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
  }).format(date);
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
