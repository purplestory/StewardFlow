"use client";

import { useState } from "react";
import OrganizationGate from "@/components/settings/OrganizationGate";
import UserRoleManager from "@/components/settings/UserRoleManager";
import ApprovalPolicyManager from "@/components/settings/ApprovalPolicyManager";

export default function UsersSettingsPage() {
  const [activeTab, setActiveTab] = useState<"users" | "approvals">("users");

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <h1 className="text-2xl font-semibold">사용자 권한 관리</h1>
        <p className="mt-2 text-sm text-neutral-600">
          기관 내 사용자 초대, 역할 및 승인 정책을 관리합니다.
        </p>
      </div>
      <OrganizationGate>
        <div className="rounded-xl border border-neutral-200 bg-white">
          {/* 탭 메뉴 */}
          <div className="flex border-b border-neutral-200">
            <button
              type="button"
              onClick={() => setActiveTab("users")}
              className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === "users"
                  ? "border-b-2 border-neutral-900 text-neutral-900"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              사용자 관리
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("approvals")}
              className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === "approvals"
                  ? "border-b-2 border-neutral-900 text-neutral-900"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              승인 정책
            </button>
          </div>
          
          {/* 탭 컨텐츠 */}
          <div className="p-6">
            {activeTab === "users" ? (
              <UserRoleManager />
            ) : (
              <ApprovalPolicyManager />
            )}
          </div>
        </div>
      </OrganizationGate>
    </section>
  );
}
