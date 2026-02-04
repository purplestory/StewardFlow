import ReservationsClient from "@/components/my/ReservationsClient";
import ProfileEditor from "@/components/my/ProfileEditor";

export default function MyPage() {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <h1 className="text-2xl font-semibold">마이페이지</h1>
        <p className="mt-2 text-sm text-neutral-600">
          내 정보를 관리하고 대여 신청 현황을 확인합니다.
        </p>
      </div>
      
      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">회원 정보</h2>
        <ProfileEditor />
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">내 대여 신청</h2>
        <ReservationsClient />
      </div>
    </section>
  );
}
