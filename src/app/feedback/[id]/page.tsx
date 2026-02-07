"use client";

import { Suspense, use } from "react";
import FeedbackDetail from "@/components/feedback/FeedbackDetail";
import OrganizationGate from "@/components/settings/OrganizationGate";

function FeedbackDetailPageContent({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  
  return (
    <OrganizationGate>
      <section className="space-y-6">
        <div className="rounded-xl border border-neutral-200 bg-white p-6">
          <FeedbackDetail feedbackId={params.id} />
        </div>
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
