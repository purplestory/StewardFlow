"use client";

type ResourceStatus = "available" | "rented" | "repair" | "lost" | "retired";

type ResourceStatusBadgeProps = {
  status: ResourceStatus;
  label: string;
  className?: string;
};

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

const statusToneClass: Record<ResourceStatus, string> = {
  available: "border-emerald-200 bg-emerald-100 text-emerald-700",
  rented: "border-blue-200 bg-blue-100 text-blue-700",
  repair: "border-amber-200 bg-amber-100 text-amber-700",
  lost: "border-rose-200 bg-rose-100 text-rose-700",
  retired: "border-neutral-200 bg-neutral-100 text-neutral-700",
};

export default function ResourceStatusBadge({
  status,
  label,
  className,
}: ResourceStatusBadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        statusToneClass[status],
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      <span>{label}</span>
    </span>
  );
}

