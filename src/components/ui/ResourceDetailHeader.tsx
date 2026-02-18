"use client";

import type { ReactNode } from "react";
import Link from "next/link";

type ResourceDetailHeaderProps = {
  status: ReactNode;
  title: string;
  subtitle?: ReactNode;
  editHref?: string | null;
  editLabel?: string;
};

function EditIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="h-5 w-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
      />
    </svg>
  );
}

export default function ResourceDetailHeader({
  status,
  title,
  subtitle,
  editHref,
  editLabel = "수정",
}: ResourceDetailHeaderProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">{status}</div>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-2xl font-bold text-neutral-900">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-neutral-500">{subtitle}</p> : null}
        </div>
        {editHref ? (
          <Link href={editHref} className="icon-button" title={editLabel} aria-label={editLabel}>
            <EditIcon />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
