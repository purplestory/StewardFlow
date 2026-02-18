import type { DepartmentChangeRequest } from "@/types/database";

export type ProfileRow = {
  id: string;
  email: string;
  name: string | null;
  department: string | null;
  role: "admin" | "manager" | "user";
  organization_id: string | null;
  created_at?: string;
};

export type InviteRow = {
  id: string;
  email: string;
  role: "admin" | "manager" | "user";
  department: string | null;
  name: string | null;
  created_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  token: string | null;
};

export type DepartmentRequestWithProfile = DepartmentChangeRequest & {
  requester_name: string | null;
  requester_email: string;
};

export type DeletionRequestRow = {
  id: string;
  requester_id: string;
  requester_name: string | null;
  requester_email: string | null;
  requester_role: string | null;
  requester_department: string | null;
  transfer_to_user_id: string | null;
  transfer_to_user_name: string | null;
  status: string;
  note: string | null;
  admin_note: string | null;
  created_at: string;
};

export const roleLabel: Record<ProfileRow["role"], string> = {
  admin: "관리자",
  manager: "부서 관리자",
  user: "일반 사용자",
};

export const roleOptions: Array<{
  value: ProfileRow["role"];
  label: string;
}> = [
  { value: "admin", label: roleLabel.admin },
  { value: "manager", label: roleLabel.manager },
  { value: "user", label: roleLabel.user },
];
