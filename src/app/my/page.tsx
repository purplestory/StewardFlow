import ReservationsClient from "@/components/my/ReservationsClient";
import ProfileEditor from "@/components/my/ProfileEditor";
import PageHero from "@/components/ui/PageHero";
import SectionCard from "@/components/ui/SectionCard";

export default function MyPage() {
  return (
    <section className="space-y-6">
      <PageHero
        title="마이페이지"
        description="내 정보를 관리하고 대여 신청 현황을 확인합니다."
      />
      
      <SectionCard title="회원 정보">
        <ProfileEditor />
      </SectionCard>

      <SectionCard title="내 대여 신청">
        <ReservationsClient />
      </SectionCard>
    </section>
  );
}
