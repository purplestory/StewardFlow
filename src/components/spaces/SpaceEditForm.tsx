"use client";

import SpaceForm from "./SpaceForm";
import type { Space } from "@/types/database";

type SpaceEditFormProps = {
  space: Space;
};

export default function SpaceEditForm({ space }: SpaceEditFormProps) {
  return <SpaceForm space={space} />;
}
