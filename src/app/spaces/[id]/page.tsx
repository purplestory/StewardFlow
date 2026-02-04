import SpaceDetailClient from "@/components/spaces/SpaceDetailClient";

type SpaceDetailPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function SpaceDetailPage({
  params,
}: SpaceDetailPageProps) {
  // Use client component to fetch data with proper session
  return <SpaceDetailClient />;
}
