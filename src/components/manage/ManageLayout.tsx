"use client";

import ManageTabs from "./ManageTabs";

type ManageLayoutProps = {
  children: React.ReactNode;
};

export default function ManageLayout({ children }: ManageLayoutProps) {
  return (
    <div className="space-y-6">
      <ManageTabs />
      {children}
    </div>
  );
}
