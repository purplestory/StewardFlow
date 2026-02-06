import ReservationManager from "@/components/manage/VehicleReservationManager";
import OrganizationGate from "@/components/settings/OrganizationGate";
import VehicleAdminPanel from "@/components/manage/VehicleAdminPanel";
import CategoryTabs from "@/components/manage/CategoryTabs";
import ManageLayout from "@/components/manage/ManageLayout";

export default function VehicleManagePage() {
  return (
    <ManageLayout>
      <div className="rounded-xl border border-neutral-200 bg-white p-6 mb-6">
        <h2 className="text-lg font-semibold">자원 관리</h2>
        <p className="text-sm text-neutral-600 mt-1">
          차량 상태 관리와 예약 승인 처리를 함께 수행합니다.
        </p>
      </div>
      <CategoryTabs />
      <OrganizationGate>
        <div className="space-y-6">
          <div className="rounded-xl border border-neutral-200 bg-white p-6">
            <VehicleAdminPanel />
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-6">
            <ReservationManager />
          </div>
        </div>
      </OrganizationGate>
    </ManageLayout>
  );
}
