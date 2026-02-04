import SpaceForm from "@/components/spaces/SpaceForm";

export default function SpaceNewPage() {
  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">공간 등록</h1>
      <p className="text-sm text-neutral-600">
        회의실/교육실/체육관 등의 공간을 등록합니다.
      </p>
      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <SpaceForm />
      </div>
    </section>
  );
}
