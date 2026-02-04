import SpaceEditClient from "@/components/spaces/SpaceEditClient";

export const dynamic = "force-dynamic";

export default function SpaceEditPage() {
  // Use client component to fetch data with proper session
  return <SpaceEditClient />;
}
