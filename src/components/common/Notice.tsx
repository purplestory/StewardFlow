"use client";

import type { ReactNode } from "react";

type NoticeVariant = "neutral" | "warning" | "error" | "success";

type NoticeProps = {
  variant?: NoticeVariant;
  className?: string;
  children: ReactNode;
};

const baseStyles: Record<NoticeVariant, string> = {
  neutral:
    "rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500",
  warning:
    "rounded-lg border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-700",
  error:
    "rounded-lg border border-dashed border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-600",
  success:
    "rounded-lg border border-dashed border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700",
};

export default function Notice({
  variant = "neutral",
  className,
  children,
}: NoticeProps) {
  return <div className={`${baseStyles[variant]} ${className ?? ""}`}>{children}</div>;
}
