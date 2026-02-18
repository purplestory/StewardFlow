import AssetForm from "@/components/assets/AssetForm";
import PageHero from "@/components/ui/PageHero";
import SectionCard from "@/components/ui/SectionCard";

export default function AssetNewPage() {
  return (
    <section className="space-y-6">
      <PageHero
        title="자산 등록"
        description="모바일에서 사진을 촬영해 바로 등록할 수 있도록 설계합니다."
      />
      <SectionCard>
        <AssetForm />
      </SectionCard>
    </section>
  );
}
