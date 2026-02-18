"use client";

import FeedbackForm from "@/components/feedback/FeedbackForm";
import OrganizationGate from "@/components/settings/OrganizationGate";
import PageHero from "@/components/ui/PageHero";
import SectionCard from "@/components/ui/SectionCard";

export default function FeedbackNewPage() {
  return (
    <OrganizationGate>
      <section className="space-y-6">
        <PageHero
          title="피드백 작성"
          description="버그 리포트, 기능 제안, 개선 아이디어를 제출해주세요."
        />
        <SectionCard>
          <FeedbackForm />
        </SectionCard>
      </section>
    </OrganizationGate>
  );
}
