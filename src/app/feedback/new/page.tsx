"use client";

import FeedbackForm from "@/components/feedback/FeedbackForm";
import OrganizationGate from "@/components/settings/OrganizationGate";

export default function FeedbackNewPage() {
  return (
    <OrganizationGate>
      <section className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">피드백 작성</h1>
          <p className="text-sm text-neutral-600 mt-1">
            버그 리포트, 기능 제안, 개선 아이디어를 제출해주세요.
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-6">
          <FeedbackForm />
        </div>
      </section>
    </OrganizationGate>
  );
}
