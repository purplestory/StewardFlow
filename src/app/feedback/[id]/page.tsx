"use client";

import { Suspense, use } from "react";
import FeedbackDetail from "@/components/feedback/FeedbackDetail";
import OrganizationGate from "@/components/settings/OrganizationGate";
import PageHero from "@/components/ui/PageHero";
import Link from "next/link";

function FeedbackDetailPageContent({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const params = use(paramsPromise);

  return (
    <OrganizationGate>
      <section className="space-y-6">
        <PageHero
          title="피드백 상세"
          description="등록된 피드백 내용과 처리 상태를 확인할 수 있습니다."
          actions={
            <Link href="/feedback" className="btn-secondary">
              목록으로
            </Link>
          }
        />
        <FeedbackDetail feedbackId={params.id} />
      </section>
    </OrganizationGate>
  );
}

export default function FeedbackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><p className="text-neutral-500">로딩 중...</p></div>}>
      <FeedbackDetailPageContent paramsPromise={params} />
    </Suspense>
  );
}
