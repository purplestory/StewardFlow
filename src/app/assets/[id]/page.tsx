import AssetDetailClient from "@/components/assets/AssetDetailClient";

type AssetDetailPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function AssetDetailPage({
  params,
}: AssetDetailPageProps) {
  const { id } = await params;
  
  if (!id || typeof id !== "string") {
    return null;
  }

  // Use client component to fetch data with proper session
  return <AssetDetailClient />;
}
