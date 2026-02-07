"use client";

import { Suspense } from "react";
import FeedbackList from "@/components/feedback/FeedbackList";
import Link from "next/link";
import OrganizationGate from "@/components/settings/OrganizationGate";

function FeedbackPageContent() {
  return (
    <OrganizationGate>
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">피드백</h1>
            <p className="text-sm text-neutral-600 mt-1">
              버그 리포트, 기능 제안, 개선 아이디어를 제출해주세요.
            </p>
          </div>
          <Link
            href="/feedback/new"
            className="btn-primary"
          >
            피드백 작성
          </Link>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-6">
          <FeedbackList />
        </div>
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
