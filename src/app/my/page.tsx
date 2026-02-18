import ReservationsClient from "@/components/my/ReservationsClient";
import ProfileEditor from "@/components/my/ProfileEditor";

export default function MyPage() {
  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-neutral-200 bg-white/95 p-6 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">마이페이지</h1>
        <p className="mt-2 text-sm text-neutral-600">
          내 정보를 관리하고 대여 신청 현황을 확인합니다.
        </p>
      </div>
      
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">회원 정보</h2>
        <ProfileEditor />
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">내 대여 신청</h2>
        <ReservationsClient />
      </div>
    </section>
  );
}
