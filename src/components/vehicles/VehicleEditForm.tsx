"use client";

import VehicleForm from "./VehicleForm";
import type { Vehicle } from "@/types/database";

type VehicleEditFormProps = {
  vehicle: Vehicle;
};

export default function VehicleEditForm({ vehicle }: VehicleEditFormProps) {
  return <VehicleForm vehicle={vehicle} />;
}
