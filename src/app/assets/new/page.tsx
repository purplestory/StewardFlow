import AssetForm from "@/components/assets/AssetForm";

export default function AssetNewPage() {
  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">자산 등록</h1>
      <p className="text-sm text-neutral-600">
        모바일에서 사진을 촬영해 바로 등록할 수 있도록 설계합니다.
      </p>
      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <AssetForm />
      </div>
    </section>
  );
}
