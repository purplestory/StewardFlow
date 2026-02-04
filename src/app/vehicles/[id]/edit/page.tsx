import VehicleEditClient from "@/components/vehicles/VehicleEditClient";

export const dynamic = "force-dynamic";

export default function VehicleEditPage() {
  // Use client component to fetch data with proper session
  return <VehicleEditClient />;
}
