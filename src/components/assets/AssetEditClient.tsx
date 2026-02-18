"use client";

import { useParams, notFound } from "next/navigation";
import AssetEditForm from "./AssetEditForm";
import OrganizationGate from "@/components/settings/OrganizationGate";
import { useAsset } from "@/hooks/useAssets";
import PageHero from "@/components/ui/PageHero";
import SectionCard from "@/components/ui/SectionCard";

export default function AssetEditClient() {
  const params = useParams();
  const id = params.id as string;

  // React Query를 사용한 데이터 페칭
  const { data: asset, isLoading: loading, error } = useAsset(id);

  if (loading) {
    return (
      <section className="space-y-6">
        <SectionCard>
          <p className="text-center text-neutral-500">로딩 중...</p>
        </SectionCard>
      </section>
    );
  }

  if (error || !asset) {
    notFound();
  }

  return (
    <section className="space-y-6">
      <PageHero
        title="물품 수정"
        description="등록된 물품의 정보를 수정할 수 있습니다."
      />
      <OrganizationGate>
        <SectionCard>
          <AssetEditForm asset={asset} />
        </SectionCard>
      </OrganizationGate>
    </section>
  );
}
