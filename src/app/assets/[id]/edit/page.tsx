import AssetEditClient from "@/components/assets/AssetEditClient";

export const dynamic = "force-dynamic";

export default function AssetEditPage() {
  // Use client component to fetch data with proper session
  return <AssetEditClient />;
}
