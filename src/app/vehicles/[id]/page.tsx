import VehicleDetailClient from "@/components/vehicles/VehicleDetailClient";

type VehicleDetailPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function VehicleDetailPage({
  params,
}: VehicleDetailPageProps) {
  return <VehicleDetailClient />;
}
