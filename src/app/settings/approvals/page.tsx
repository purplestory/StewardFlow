import { redirect } from "next/navigation";

export default function ApprovalSettingsPage() {
  // 승인 정책 설정은 사용자 권한 관리 페이지로 통합되었습니다.
  redirect("/settings/users");
}
