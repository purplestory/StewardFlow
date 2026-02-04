"use client";

import { useRouter } from "next/navigation";
import AssetForm from "./AssetForm";
import type { Asset } from "@/types/database";

type AssetEditFormProps = {
  asset: Asset;
};

export default function AssetEditForm({ asset }: AssetEditFormProps) {
  return <AssetForm asset={asset} />;
}
