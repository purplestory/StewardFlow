import { redirect } from "next/navigation";

type NewPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function resolveCategory(
  categoryParam: string | string[] | undefined
): "equipment" | "spaces" | "vehicles" | null {
  const raw = Array.isArray(categoryParam) ? categoryParam[0] : categoryParam;
  if (raw === "equipment" || raw === "spaces" || raw === "vehicles") {
    return raw;
  }
  return null;
}

export default async function NewPage({ searchParams }: NewPageProps) {
  const params = (await searchParams) ?? {};
  const category = resolveCategory(params.category);

  if (category === "spaces") {
    redirect("/spaces/manage?mode=register");
  }
  if (category === "vehicles") {
    redirect("/vehicles/manage?mode=register");
  }
  redirect("/assets/manage?mode=register");
}
