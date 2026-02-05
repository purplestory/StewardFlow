"use client";

import { useParams, notFound } from "next/navigation";
import AssetEditForm from "./AssetEditForm";
import OrganizationGate from "@/components/settings/OrganizationGate";
import { useAsset } from "@/hooks/useAssets";

export default function AssetEditClient() {
  const params = useParams();
  const id = params.id as string;

  // React Query를 사용한 데이터 페칭
  const { data: asset, isLoading: loading, error } = useAsset(id);

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <p className="text-center text-neutral-500">로딩 중...</p>
        </div>
      </section>
    );
  }

  if (error || !asset) {
    notFound();
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">물품 수정</h1>
      <p className="text-sm text-neutral-600">
        등록된 물품의 정보를 수정할 수 있습니다.
      </p>
      <OrganizationGate>
        <AssetEditForm asset={asset} />
      </OrganizationGate>
    </section>
  );
}
