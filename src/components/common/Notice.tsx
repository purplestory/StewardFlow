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
    "rounded-xl border border-dashed border-neutral-300 bg-white p-6 text-center text-sm leading-6 text-neutral-600",
  warning:
    "rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-sm leading-6 text-amber-800",
  error:
    "rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-sm leading-6 text-rose-700",
  success:
    "rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800",
};

export default function Notice({
  variant = "neutral",
  className,
  children,
}: NoticeProps) {
  const isUrgent = variant === "error" || variant === "warning";

  return (
    <div
      className={`${baseStyles[variant]} ${className ?? ""}`}
      role={isUrgent ? "alert" : "status"}
      aria-live={isUrgent ? "assertive" : "polite"}
    >
      {children}
    </div>
  );
}
