"use client";

import { Suspense } from "react";
import FeedbackList from "@/components/feedback/FeedbackList";
import Link from "next/link";
import OrganizationGate from "@/components/settings/OrganizationGate";
import PageHero from "@/components/ui/PageHero";
import SectionCard from "@/components/ui/SectionCard";

function FeedbackPageContent() {
  return (
    <OrganizationGate>
      <section className="space-y-6">
        <PageHero
          title="피드백"
          description="버그 리포트, 기능 제안, 개선 아이디어를 제출해주세요."
          actions={
            <Link href="/feedback/new" className="btn-primary">
              피드백 작성
            </Link>
          }
        />
        <SectionCard>
          <FeedbackList />
        </SectionCard>
      </section>
    </OrganizationGate>
  );
}

export default function FeedbackPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><p className="text-neutral-500">로딩 중...</p></div>}>
      <FeedbackPageContent />
    </Suspense>
  );
}
