"use client";

import { useParams, notFound } from "next/navigation";
import SpaceEditForm from "./SpaceEditForm";
import OrganizationGate from "@/components/settings/OrganizationGate";
import { useSpace } from "@/hooks/useSpaces";

export default function SpaceEditClient() {
  const params = useParams();
  const id = params.id as string;

  // React Query를 사용한 데이터 페칭
  const { data: space, isLoading: loading, error } = useSpace(id);

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <p className="text-center text-neutral-500">로딩 중...</p>
        </div>
      </section>
    );
  }

  if (error || !space) {
    notFound();
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">공간 수정</h1>
      <p className="text-sm text-neutral-600">
        등록된 공간의 정보를 수정할 수 있습니다.
      </p>
      <OrganizationGate>
        <SpaceEditForm space={space} />
      </OrganizationGate>
    </section>
  );
}
