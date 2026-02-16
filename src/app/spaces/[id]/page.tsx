import SpaceDetailClient from "@/components/spaces/SpaceDetailClient";

export const dynamic = "force-dynamic";

export default async function SpaceDetailPage() {
  // Use client component to fetch data with proper session
  return <SpaceDetailClient />;
}
