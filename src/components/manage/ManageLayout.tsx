"use client";

import ManageTabs from "./ManageTabs";

type ManageLayoutProps = {
  children: React.ReactNode;
};

export default function ManageLayout({ children }: ManageLayoutProps) {
  // 권한 체크는 각 관리 페이지에서 개별적으로 처리
  // 여기서는 레이아웃만 제공
  return (
    <div className="space-y-6">
      <ManageTabs />
      {children}
    </div>
  );
}
