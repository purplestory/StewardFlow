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
    "rounded-2xl border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500",
  warning:
    "rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-700",
  error:
    "rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-600",
  success:
    "rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700",
};

export default function Notice({
  variant = "neutral",
  className,
  children,
}: NoticeProps) {
  return <div className={`${baseStyles[variant]} ${className ?? ""}`}>{children}</div>;
}
