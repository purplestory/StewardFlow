"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { generateShortId } from "@/lib/short-id";
import { deleteUserAccount } from "@/actions/auth-actions";
import {
  createOrganizationForAdmin,
  listDepartmentsForAdminOrganization,
  listOrganizationsForAdmin,
  reassignUserOrganizationForAdmin,
} from "@/actions/admin-organization-actions";
import Notice from "@/components/common/Notice";
import { ModuleList, ModuleListHeader } from "@/components/ui/ModuleList";
import type {
  DeletionRequestRow,
  DepartmentRequestWithProfile,
  InviteRow,
  ProfileRow,
} from "@/components/settings/user-role-manager/types";
import {
  roleLabel,
  roleOptions,
} from "@/components/settings/user-role-manager/types";

const debugLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== "production") {
    console.log(...args);
  }
};

const DEFAULT_INVITE_EXPIRES_DAYS = 7;
const INVITE_EXPIRES_DAY_OPTIONS = [1, 3, 7, 14, 30] as const;

export default function UserRoleManager() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<ProfileRow["role"]>(
    "user"
  );
  const [invitationEmail, setInvitationEmail] = useState("");
  const [invitationName, setInvitationName] = useState("");
  const [invitationRole, setInvitationRole] =
    useState<ProfileRow["role"]>("user");
  const [invitationDepartment, setInvitationDepartment] = useState("");
  const [inviteExpiresDays, setInviteExpiresDays] = useState<number>(DEFAULT_INVITE_EXPIRES_DAYS);
  const [savingInvitePolicy, setSavingInvitePolicy] = useState(false);
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [needsOrganization, setNeedsOrganization] = useState(false);
  const [departmentChangeRequests, setDepartmentChangeRequests] = useState<
    DepartmentRequestWithProfile[]
  >([]);
  const [pendingUsers, setPendingUsers] = useState<ProfileRow[]>([]);
  const [allUsers, setAllUsers] = useState<ProfileRow[]>([]);
  const [allOrganizations, setAllOrganizations] = useState<Array<{ id: string; name: string }>>([]);
  const [approvingUserId, setApprovingUserId] = useState<string | null>(null);
  const [approvalOrganizationId, setApprovalOrganizationId] = useState<string>("");
  const [approvalDepartment, setApprovalDepartment] = useState<string>("");
  const [approvalRole, setApprovalRole] = useState<ProfileRow["role"]>("user");
  const [approvalDepartments, setApprovalDepartments] = useState<string[]>([]);
  const [transferUserId, setTransferUserId] = useState<string>("");
  const [transferOrganizationId, setTransferOrganizationId] = useState<string>("");
  const [transferDepartment, setTransferDepartment] = useState<string>("");
  const [transferRole, setTransferRole] = useState<ProfileRow["role"]>("user");
  const [transferDepartments, setTransferDepartments] = useState<string[]>([]);
  const [isTransferringUser, setIsTransferringUser] = useState(false);
  const [newOrganizationName, setNewOrganizationName] = useState("");
  const [isCreatingOrganization, setIsCreatingOrganization] = useState(false);
  const [showInviteLinkModal, setShowInviteLinkModal] = useState(false);
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deletionRequests, setDeletionRequests] = useState<DeletionRequestRow[]>([]);
  const [adminNote, setAdminNote] = useState("");
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setMessage(null);
    setNeedsOrganization(false);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user ?? null;

    if (!user) {
      setProfiles([]);
      setAllUsers([]);
      setLoading(false);
      return;
    }

    // 프로필 조회 시 더 자세한 디버깅 정보 수집
    debugLog("Loading profile for user:", user.id);
    
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id,role")
      .eq("id", user.id)
      .maybeSingle();

    debugLog("Profile query result:", {
      data: profileData,
      error: profileError,
      hasData: !!profileData,
      hasError: !!profileError,
    });

    if (profileError) {
      console.error("Profile load error:", profileError);
      console.error("Error details:", {
        message: profileError.message,
        code: profileError.code,
        details: profileError.details,
        hint: profileError.hint,
        user_id: user.id,
      });
      
      // RLS 정책 오류인 경우 특별 처리
      if (profileError.code === "42501" || profileError.message?.includes("row-level security")) {
        setMessage(
          `RLS 정책 오류: 프로필을 조회할 수 없습니다. Supabase SQL Editor에서 RLS 정책을 확인하고 수정해주세요. 오류: ${profileError.message}`
        );
      } else {
        setMessage(`프로필 조회 오류: ${profileError.message}`);
      }
      setLoading(false);
      return;
    }

    if (!profileData) {
      console.warn("No profile found for user:", user.id);
      console.warn("This might be an RLS policy issue. Check browser console for errors.");
      
      // RLS 정책 문제일 가능성이 높으므로 사용자에게 안내
      setMessage(
        "프로필을 찾을 수 없습니다. RLS 정책 문제일 수 있습니다. Supabase SQL Editor에서 다음 SQL을 실행해주세요: DROP POLICY IF EXISTS \"profiles_select_own\" ON public.profiles; DROP POLICY IF EXISTS \"profiles_select_same_org\" ON public.profiles; CREATE POLICY \"profiles_select_same_org\" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));"
      );
      setNeedsOrganization(true);
      setLoading(false);
      return;
    }

    debugLog("Profile loaded successfully:", {
      user_id: user.id,
      organization_id: profileData.organization_id,
      role: profileData.role,
      hasOrganizationId: !!profileData.organization_id,
    });

    if (!profileData.organization_id) {
      console.warn("User profile has no organization_id:", user.id, profileData);
      console.warn("Profile data:", JSON.stringify(profileData, null, 2));
      setNeedsOrganization(true);
      setLoading(false);
      return;
    }

    setOrganizationId(profileData.organization_id);
    setCurrentUserId(user.id);
    setCurrentUserRole(profileData.role ?? "user");
    let departmentOrderFromOrg: string[] = [];
    let inviteExpiresDaysForOrg = DEFAULT_INVITE_EXPIRES_DAYS;

    try {
      const { data: orgData } = await supabase
        .from("organizations")
        .select("department_order,invite_expires_days")
        .eq("id", profileData.organization_id)
        .maybeSingle();

      if (orgData?.department_order) {
        departmentOrderFromOrg = orgData.department_order as string[];
      }

      const nextInviteExpiresDays = Number(
        orgData?.invite_expires_days ?? DEFAULT_INVITE_EXPIRES_DAYS
      );
      if (
        Number.isFinite(nextInviteExpiresDays) &&
        nextInviteExpiresDays >= 1 &&
        nextInviteExpiresDays <= 30
      ) {
        inviteExpiresDaysForOrg = nextInviteExpiresDays;
        setInviteExpiresDays(nextInviteExpiresDays);
      } else {
        inviteExpiresDaysForOrg = DEFAULT_INVITE_EXPIRES_DAYS;
        setInviteExpiresDays(DEFAULT_INVITE_EXPIRES_DAYS);
      }
    } catch (error) {
      console.warn("organizations 설정 컬럼을 읽을 수 없습니다:", error);
      inviteExpiresDaysForOrg = DEFAULT_INVITE_EXPIRES_DAYS;
      setInviteExpiresDays(DEFAULT_INVITE_EXPIRES_DAYS);
    }

    // 일반 사용자는 사용자 목록을 볼 수 없음 (페이지 접근 불가)
    if (profileData.role === "user") {
      setProfiles([]);
      setInvites([]);
      setPendingUsers([]);
      setAllUsers([]);
      setLoading(false);
      setMessage("일반 사용자는 이 페이지에 접근할 수 없습니다.");
      return;
    }

    // 최고관리자(admin)만 미승인 사용자 목록 조회 가능
    if (profileData.role === "admin") {
      // organization_id가 null인 모든 사용자 조회 (미승인 사용자)
      // profiles_select_all_by_admin 정책으로 모든 프로필 조회 가능하므로 필터링은 클라이언트에서
      const { data: allUsersData, error: allUsersError } = await supabase
        .from("profiles")
        .select("id,email,name,department,role,organization_id,created_at")
        .order("created_at", { ascending: false });

      if (allUsersError) {
        console.error("전체 사용자 조회 오류:", allUsersError);
        console.error("에러 상세:", {
          code: allUsersError.code,
          message: allUsersError.message,
          details: allUsersError.details,
          hint: allUsersError.hint,
        });
        setMessage(`사용자 조회 실패: ${allUsersError.message}`);
        setPendingUsers([]);
        setAllUsers([]);
      } else if (allUsersData) {
        setAllUsers(allUsersData as ProfileRow[]);
        // 클라이언트에서 organization_id가 null인 사용자만 필터링
        const pendingUsersData = allUsersData.filter(user => 
          user.organization_id === null || user.organization_id === undefined
        );
        debugLog("전체 사용자 조회 성공:", allUsersData.length, "명");
        debugLog("전체 사용자 데이터:", allUsersData.map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          organization_id: u.organization_id
        })));
        debugLog("미승인 사용자:", pendingUsersData.length, "명");
        debugLog("미승인 사용자 데이터:", pendingUsersData.map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          organization_id: u.organization_id
        })));
        setPendingUsers(pendingUsersData as ProfileRow[]);
      } else {
        debugLog("전체 사용자 데이터가 null입니다");
        setPendingUsers([]);
        setAllUsers([]);
      }

      // 모든 기관 목록 조회 (최고관리자 only, 서버 액션으로 RLS 영향 제거)
      const organizationsResult = await listOrganizationsForAdmin();
      if (organizationsResult.success) {
        setAllOrganizations(organizationsResult.organizations);
      } else {
        console.error("전체 기관 조회 오류:", organizationsResult.error);
        setAllOrganizations([]);
      }
    } else {
      setPendingUsers([]);
      setAllUsers([]);
      setAllOrganizations([]);
    }

    // Load departments for invitation
    const { data: deptData } = await supabase
      .from("departments")
      .select("id,name")
      .eq("organization_id", profileData.organization_id);
    
    if (deptData) {
      // 순서 정보가 있으면 그에 따라 정렬, 없으면 이름순 정렬
      let sortedDepartments = deptData;
      if (departmentOrderFromOrg.length > 0) {
        const deptMap = new Map(sortedDepartments.map((d) => [d.id, d]));
        sortedDepartments = departmentOrderFromOrg
          .map((id) => deptMap.get(id))
          .filter((d): d is { id: string; name: string } => d !== undefined)
          .concat(sortedDepartments.filter((d) => !departmentOrderFromOrg.includes(d.id)));
      } else {
        sortedDepartments.sort((a, b) => a.name.localeCompare(b.name));
      }

      setAvailableDepartments(sortedDepartments.map((d) => d.name));
    }

    // 부서 변경 요청 로드 (관리자 또는 부서 관리자만)
    if (profileData.role === "admin" || profileData.role === "manager") {
      const { data: requestsData, error: requestsError } = await supabase
        .from("department_change_requests")
        .select(`
          *,
          profiles!department_change_requests_requester_id_fkey(name, email)
        `)
        .eq("organization_id", profileData.organization_id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (!requestsError && requestsData) {
        type DepartmentRequestQueryRow = DepartmentRequestWithProfile & {
          profiles?: { name?: string | null; email?: string | null } | null;
        };
        const requestsWithRequester = (requestsData as DepartmentRequestQueryRow[]).map((req) => ({
          ...req,
          requester_name: req.profiles?.name || null,
          requester_email: req.profiles?.email || "",
        }));
        setDepartmentChangeRequests(requestsWithRequester);
      }
    }

    // 계정 탈퇴 요청 로드 (최고 관리자만)
    if (profileData.role === "admin") {
      const { data: deletionRequestsData, error: deletionRequestsError } = await supabase
        .from("account_deletion_requests")
        .select("*")
        .eq("organization_id", profileData.organization_id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (!deletionRequestsError && deletionRequestsData) {
        setDeletionRequests(deletionRequestsData);
      }
    }

    // 사용자 목록 조회
    let profilesQuery = supabase
      .from("profiles")
      .select("id,email,name,department,role,organization_id")
      .eq("organization_id", profileData.organization_id);

    // 부서 관리자는 같은 부서 사용자만 조회
    if (profileData.role === "manager") {
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("department")
        .eq("id", user.id)
        .maybeSingle();

      if (currentProfile?.department) {
        profilesQuery = profilesQuery.eq("department", currentProfile.department);
      } else {
        // 부서가 없는 부서 관리자는 아무도 볼 수 없음
        setProfiles([]);
        setInvites([]);
        setPendingUsers([]);
        setAllUsers([]);
        setLoading(false);
        setMessage("부서가 지정되지 않은 부서 관리자는 사용자 목록을 볼 수 없습니다.");
        return;
      }
    }

    const { data, error } = await profilesQuery.order("created_at", { ascending: true });
    
    // 디버깅: 프로필 조회 결과 확인
    if (error) {
      console.error("Error loading profiles:", error);
      console.error("Organization ID:", profileData.organization_id);
    } else {
      debugLog("Profiles loaded:", data?.length || 0, "profiles");
      debugLog("Profile IDs:", data?.map((p: ProfileRow) => p.id));
    }

    // Try to select token, but handle case where column doesn't exist yet
    let inviteData: InviteRow[] | null = null;
    let inviteError: unknown = null;
    
    try {
      const { data, error } = await supabase
        .from("organization_invites")
        .select("id,email,role,department,name,created_at,expires_at,accepted_at,revoked_at,token")
        .eq("organization_id", profileData.organization_id)
        .is("accepted_at", null)
        .is("revoked_at", null)
        .order("created_at", { ascending: false });
      
      inviteData = data as InviteRow[] | null;
      inviteError = error;
    } catch (err: unknown) {
      // 컬럼 일부가 아직 없을 수 있음 (token/expires_at)
      if (
        err instanceof Error &&
        (
          (err.message && (err.message.includes("token") || err.message.includes("expires_at"))) ||
          (err as { code?: string }).code === "42703"
        )
      ) {
        const { data, error } = await supabase
          .from("organization_invites")
          .select("id,email,role,department,name,created_at,accepted_at,revoked_at")
          .eq("organization_id", profileData.organization_id)
          .is("accepted_at", null)
          .is("revoked_at", null)
          .order("created_at", { ascending: false });

        inviteData = (data ?? []).map((inv) => ({
          ...inv,
          token: null,
          expires_at: null,
        })) as InviteRow[];
        inviteError = error;
      } else {
        inviteError = err;
      }
    }

    if (
      inviteError &&
      (inviteError as { code?: string; message?: string }).code === "42703"
    ) {
      const { data, error } = await supabase
        .from("organization_invites")
        .select("id,email,role,department,name,created_at,accepted_at,revoked_at")
        .eq("organization_id", profileData.organization_id)
        .is("accepted_at", null)
        .is("revoked_at", null)
        .order("created_at", { ascending: false });
      inviteData = (data ?? []).map((inv) => ({
        ...inv,
        token: null,
        expires_at: null,
      })) as InviteRow[];
      inviteError = error;
    }

    if (error) {
      console.error("Error loading profiles:", error);
      console.error("Error details:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        organization_id: profileData.organization_id,
      });
      setMessage(`프로필 조회 오류: ${error.message}. RLS 정책을 확인해주세요.`);
      setProfiles([]);
    } else {
      const profilesList = (data ?? []) as ProfileRow[];
      debugLog(`Loaded ${profilesList.length} profiles for organization ${profileData.organization_id}`);
      debugLog("Profiles:", profilesList.map(p => ({ id: p.id, name: p.name, email: p.email, role: p.role })));
      setProfiles(profilesList);
      if (profilesList.length === 0) {
        console.warn("No profiles found for organization:", profileData.organization_id);
        setMessage("등록된 사용자가 없습니다. 초대를 보내 새 사용자를 추가해 주세요.");
      }
    }

    if (inviteError) {
      const inviteErr = inviteError as { message?: string } | null;
      setMessage(inviteErr?.message ?? "초대 목록 조회 오류가 발생했습니다.");
      setInvites([]);
    } else {
      const pendingInvites = (inviteData ?? []) as InviteRow[];
      
      // 이미 가입한 사용자(프로필이 존재하는 사용자) 필터링
      // 이메일 또는 이름으로 프로필이 존재하는 초대는 제외
      const profileEmails = new Set((data ?? []).map((p: ProfileRow) => p.email.toLowerCase().trim()));
      const profileNames = new Set((data ?? []).map((p: ProfileRow) => p.name?.toLowerCase().trim()).filter(Boolean));
      
      // 이미 가입한 사용자의 초대는 accepted_at 업데이트
      const invitesToAccept: string[] = [];
      const filteredInvites = pendingInvites.filter((invite) => {
        // 이미 가입한 사용자는 제외하고 accepted_at 업데이트
        if (invite.email && profileEmails.has(invite.email.toLowerCase().trim())) {
          invitesToAccept.push(invite.id);
          return false;
        }
        if (invite.name && profileNames.has(invite.name.toLowerCase().trim())) {
          invitesToAccept.push(invite.id);
          return false;
        }
        return true;
      });
      
      // 이미 가입한 사용자의 초대는 자동으로 accepted_at 업데이트
      if (invitesToAccept.length > 0) {
        const nowIso = new Date().toISOString();
        const { error: updateError } = await supabase
          .from("organization_invites")
          .update({ accepted_at: nowIso })
          .in("id", invitesToAccept);
        
        if (updateError) {
          console.error("Failed to update accepted_at for invites:", updateError);
        } else {
          // 업데이트 성공 후 목록 다시 불러오기
          let updatedInvites: InviteRow[] | null = null;
          const withNewColumns = await supabase
            .from("organization_invites")
            .select("id,email,role,department,name,created_at,expires_at,accepted_at,revoked_at,token")
            .eq("organization_id", profileData.organization_id)
            .is("accepted_at", null)
            .is("revoked_at", null)
            .order("created_at", { ascending: false });

          updatedInvites = withNewColumns.data as InviteRow[] | null;
          if (
            withNewColumns.error &&
            withNewColumns.error.code === "42703"
          ) {
            const fallbackInvites = await supabase
              .from("organization_invites")
              .select("id,email,role,department,name,created_at,accepted_at,revoked_at")
              .eq("organization_id", profileData.organization_id)
              .is("accepted_at", null)
              .is("revoked_at", null)
              .order("created_at", { ascending: false });
            updatedInvites = (fallbackInvites.data ?? []).map((invite) => ({
              ...invite,
              token: null,
              expires_at: null,
            })) as InviteRow[];
          }
          
          if (updatedInvites) {
            // 업데이트된 목록으로 다시 필터링
            const updatedPendingInvites = (updatedInvites as InviteRow[]).filter((invite) => {
              if (invite.email && profileEmails.has(invite.email.toLowerCase().trim())) {
                return false;
              }
              if (invite.name && profileNames.has(invite.name.toLowerCase().trim())) {
                return false;
              }
              return true;
            });
            
            setInvites(
              updatedPendingInvites.filter((invite) =>
                !isInviteExpired(
                  invite.created_at,
                  invite.expires_at,
                  inviteExpiresDaysForOrg
                )
              )
            );
            setLastLoadedAt(new Date().toISOString());
            setLoading(false);
            return;
          }
        }
      }
      
      const expiredIds = filteredInvites
        .filter((invite) =>
          isInviteExpired(
            invite.created_at,
            invite.expires_at,
            inviteExpiresDaysForOrg
          )
        )
        .map((invite) => invite.id);

      if (expiredIds.length > 0) {
        const nowIso = new Date().toISOString();
        await supabase
          .from("organization_invites")
          .update({ revoked_at: nowIso })
          .in("id", expiredIds);
      }

      setInvites(
        filteredInvites.filter((invite) =>
          !isInviteExpired(
            invite.created_at,
            invite.expires_at,
            inviteExpiresDaysForOrg
          )
        )
      );
    }

    setLastLoadedAt(new Date().toISOString());
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const deleteUser = async (profileId: string, profileName: string) => {
    setMessage(null);

    if (currentUserRole === "user") {
      setMessage("사용자 삭제는 관리자만 가능합니다.");
      return;
    }

    if (currentUserRole === "manager") {
      setMessage("사용자 삭제는 최고 관리자만 가능합니다.");
      return;
    }

    if (profileId === currentUserId) {
      setMessage("자기 자신은 삭제할 수 없습니다.");
      return;
    }

    if (!organizationId || !currentUserId) {
      setMessage("기관 정보를 확인할 수 없습니다.");
      return;
    }

    // 삭제 확인 모달 표시
    setUserToDelete({ id: profileId, name: profileName || '이름 없음' });
    setShowDeleteConfirm(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete || !organizationId || !currentUserId) {
      return;
    }

    const profileId = userToDelete.id;
    const profileName = userToDelete.name;
    const profileEmail = profiles.find(p => p.id === profileId)?.email || null;

    setMessage(null);
    setDeletingUserId(profileId);
    setLoading(true);
    setShowDeleteConfirm(false);

    try {
      // Server Action 사용: RLS 우회하여 profiles + auth.users 모두 삭제
      const result = await deleteUserAccount(profileId);

      if (!result.success) {
        setMessage(result.error ?? "사용자 삭제에 실패했습니다.");
        setDeletingUserId(null);
        setLoading(false);
        return;
      }

      // 감사 로그 기록
      await supabase.from("audit_logs").insert({
        organization_id: organizationId,
        actor_id: currentUserId,
        action: "user_deleted",
        target_type: "profile",
        target_id: profileId,
        metadata: {
          deleted_user_name: profileName,
          deleted_user_email: profileEmail,
        },
      });

      setMessage("사용자가 성공적으로 삭제되었습니다.");
      setUserToDelete(null);
      await load();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
      setMessage(`사용자 삭제 실패: ${errorMessage}`);
    } finally {
      setDeletingUserId(null);
      setLoading(false);
    }
  };

  const cancelDeleteUser = () => {
    setShowDeleteConfirm(false);
    setUserToDelete(null);
  };

  const updateRole = async (profileId: string, role: ProfileRow["role"]) => {
    setMessage(null);

    if (currentUserRole === "user") {
      setMessage("권한 변경은 관리자만 가능합니다.");
      return;
    }

    // 대상 사용자의 현재 역할 확인
    const targetProfile = profiles.find((p) => p.id === profileId);
    if (!targetProfile) {
      setMessage("사용자를 찾을 수 없습니다.");
      return;
    }

    // 이미 같은 역할이면 변경하지 않음
    if (targetProfile.role === role) {
      return;
    }

    // 부서 관리자 권한 체크
    if (currentUserRole === "manager") {
      // 부서 관리자는 관리자 역할로 변경할 수 없음
      if (role === "admin") {
        setMessage("부서 관리자는 사용자를 관리자로 변경할 수 없습니다.");
        return;
      }

      // 부서 관리자는 관리자 역할을 변경할 수 없음
      if (targetProfile.role === "admin") {
        setMessage("부서 관리자는 관리자 역할을 변경할 수 없습니다.");
        return;
      }

      // 부서 관리자는 같은 부서 사용자만 변경 가능
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("department")
        .eq("id", currentUserId)
        .maybeSingle();

      if (!currentProfile?.department) {
        setMessage("부서가 지정되지 않은 부서 관리자는 역할을 변경할 수 없습니다.");
        return;
      }

      if (targetProfile.department !== currentProfile.department) {
        setMessage("부서 관리자는 같은 부서의 사용자만 변경할 수 있습니다.");
        return;
      }
    }

    // 최고 관리자는 모든 역할 변경 가능
    // 부서 관리자는 같은 부서의 manager ↔ user 간 변경만 가능 (admin 제외)
    // 일반 사용자는 역할 변경 불가 (이미 위에서 체크됨)

    const { data: updatedData, error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", profileId)
      .eq("organization_id", organizationId)
      .select()
      .single();

    if (error) {
      console.error("Role update error:", error);
      setMessage(`역할 변경 실패: ${error.message}`);
      // 실패 시 원래 상태로 복구
      await load();
      return;
    }

    if (!updatedData) {
      console.error("Role update: No data returned");
      setMessage("역할 변경 실패: 업데이트된 데이터를 받지 못했습니다.");
      await load();
      return;
    }

    // 상태 업데이트
    setProfiles((prev) =>
      prev.map((profile) =>
        profile.id === profileId ? { ...profile, role: updatedData.role } : profile
      )
    );

    // Audit log 기록
    await supabase.from("audit_logs").insert({
      organization_id: organizationId,
      actor_id: currentUserId,
      action: "role_update",
      target_type: "profile",
      target_id: profileId,
      metadata: { 
        from_role: targetProfile.role,
        to_role: role 
      },
    });

    // 성공 토스트 표시 후 자동으로 숨김
    setSuccessToast("권한이 변경되었습니다.");
    setTimeout(() => setSuccessToast(null), 2000);
  };

  const updateDepartment = async (profileId: string, department: string | null) => {
    setMessage(null);

    // 최고 관리자만 부서 변경 가능
    if (currentUserRole !== "admin") {
      setMessage("부서 변경은 최고 관리자만 가능합니다.");
      return;
    }

    if (!organizationId || !currentUserId) {
      setMessage("기관 정보를 확인할 수 없습니다.");
      return;
    }

    const targetProfile = profiles.find((p) => p.id === profileId);
    if (!targetProfile) {
      setMessage("사용자를 찾을 수 없습니다.");
      return;
    }

    // 이미 같은 부서면 변경하지 않음
    if (targetProfile.department === department) {
      return;
    }

    const { data: updatedData, error } = await supabase
      .from("profiles")
      .update({ department: department || null })
      .eq("id", profileId)
      .eq("organization_id", organizationId)
      .select()
      .single();

    if (error) {
      console.error("Department update error:", error);
      setMessage(`부서 변경 실패: ${error.message}`);
      // 실패 시 원래 상태로 복구
      await load();
      return;
    }

    if (!updatedData) {
      console.error("Department update: No data returned");
      setMessage("부서 변경 실패: 업데이트된 데이터를 받지 못했습니다.");
      await load();
      return;
    }

    // 상태 업데이트
    setProfiles((prev) =>
      prev.map((profile) =>
        profile.id === profileId ? { ...profile, department: updatedData.department } : profile
      )
    );

    // Audit log 기록
    await supabase.from("audit_logs").insert({
      organization_id: organizationId,
      actor_id: currentUserId,
      action: "department_update",
      target_type: "profile",
      target_id: profileId,
      metadata: { 
        from_department: targetProfile.department,
        to_department: department || null,
        updated_by_admin: true,
      },
    });

    // 성공 토스트 표시 후 자동으로 숨김
    setSuccessToast("부서가 변경되었습니다.");
    setTimeout(() => setSuccessToast(null), 2000);
  };

  const sendInvite = async () => {
    setMessage(null);

    if (currentUserRole === "user") {
      setMessage("초대는 관리자 또는 부서 관리자만 가능합니다.");
      return;
    }

    // 부서 관리자는 관리자 역할로 초대할 수 없음
    if (currentUserRole === "manager" && invitationRole === "admin") {
      setMessage("부서 관리자는 관리자 역할로 초대할 수 없습니다.");
      return;
    }

    if (!organizationId) {
      setMessage("기관 정보를 확인할 수 없습니다.");
      return;
    }

    // 이메일은 선택사항이므로 빈 문자열도 허용
    const email = invitationEmail.trim() || null;

    // 클라이언트에서 직접 초대 토큰 생성
    const token = generateShortId(10);
    const expiresAt = new Date(
      Date.now() + inviteExpiresDays * 24 * 60 * 60 * 1000
    ).toISOString();

    // 초대 생성
    let invite: { id: string } | null = null;
    let inviteError: { message?: string; code?: string } | null = null;

    const withExpiresAt = await supabase
      .from("organization_invites")
      .insert({
        organization_id: organizationId,
        email: email || null,
        role: invitationRole,
        department: invitationDepartment.trim() || null,
        name: invitationName.trim() || null,
        token,
        expires_at: expiresAt,
      })
      .select("id")
      .maybeSingle();

    invite = withExpiresAt.data;
    inviteError = withExpiresAt.error;

    // 구버전 스키마 호환: expires_at 컬럼 미적용이면 expires_at 없이 재시도
    if (
      inviteError &&
      (inviteError.code === "42703" || inviteError.message?.includes("expires_at"))
    ) {
      const withoutExpiresAt = await supabase
        .from("organization_invites")
        .insert({
          organization_id: organizationId,
          email: email || null,
          role: invitationRole,
          department: invitationDepartment.trim() || null,
          name: invitationName.trim() || null,
          token,
        })
        .select("id")
        .maybeSingle();

      invite = withoutExpiresAt.data;
      inviteError = withoutExpiresAt.error;
    }

    if (inviteError || !invite) {
      setMessage(inviteError?.message ?? "초대 생성에 실패했습니다.");
      return;
    }

    // audit_logs에 초대 생성 기록 (초대한 사람 정보 추적용)
    await supabase.from("audit_logs").insert({
      organization_id: organizationId,
      actor_id: currentUserId,
      action: "invite_created",
      target_type: "invite",
      target_id: invite.id,
      metadata: { 
        email: email || null, 
        role: invitationRole,
        department: invitationDepartment.trim() || null,
        name: invitationName.trim() || null,
      },
    });

    const inviteLink = `${window.location.origin}/join?token=${token}`;

    // Get organization name for email
    const { data: orgData } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .maybeSingle();

    // Send email via API (이메일이 있는 경우에만)
    if (email) {
      try {
        const emailResponse = await fetch("/api/invite/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            inviteLink,
            organizationName: orgData?.name ?? "기관",
            role: invitationRole,
          }),
        });

        const emailResult = await emailResponse.json();

        if (!emailResult.ok) {
          console.warn("Invite email send failed:", emailResult.message);
        }
      } catch {
        console.warn("Invite email request failed");
      }
    }

    // audit log
    await supabase.from("audit_logs").insert({
      organization_id: organizationId,
      actor_id: currentUserId,
      action: "invite_sent",
      target_type: "email",
      metadata: { email, role: invitationRole, has_link: true },
    });

    // 초대 링크 모달 표시
    setGeneratedInviteLink(inviteLink);
    setInviteLinkCopied(false);
    setShowInviteLinkModal(true);

    // 폼 초기화
    setInvitationEmail("");
    setInvitationName("");
    setInvitationRole("user");
    setInvitationDepartment("");
  };

  const saveInviteExpirationPolicy = async () => {
    if (!organizationId) {
      setMessage("기관 정보를 확인할 수 없습니다.");
      return;
    }
    if (currentUserRole !== "admin") {
      setMessage("초대 만료일 설정은 관리자만 변경할 수 있습니다.");
      return;
    }

    setSavingInvitePolicy(true);
    setMessage(null);
    const { error } = await supabase
      .from("organizations")
      .update({ invite_expires_days: inviteExpiresDays })
      .eq("id", organizationId);

    if (error) {
      if (error.code === "42703" || error.message?.includes("invite_expires_days")) {
        setMessage(
          "초대 만료 정책 컬럼이 없습니다. 최신 마이그레이션(20260219_add_invite_expiration_policy.sql)을 적용해주세요."
        );
      } else {
        setMessage(`초대 만료일 저장 실패: ${error.message}`);
      }
      setSavingInvitePolicy(false);
      return;
    }

    setMessage("초대 만료일 설정을 저장했습니다.");
    setSavingInvitePolicy(false);
  };

  const resendInvite = async (invite: InviteRow) => {
    setMessage(null);

    if (currentUserRole === "user") {
      setMessage("초대 재전송은 관리자 또는 부서 관리자만 가능합니다.");
      return;
    }

    // 부서 관리자는 관리자 역할 초대를 재전송할 수 없음
    if (currentUserRole === "manager" && invite.role === "admin") {
      setMessage("부서 관리자는 관리자 역할 초대를 재전송할 수 없습니다.");
      return;
    }

    if (!invite.token) {
      setMessage("초대 링크가 없습니다. 새로 생성해주세요.");
      return;
    }

    if (!organizationId) {
      setMessage("기관 정보를 확인할 수 없습니다.");
      return;
    }

    const inviteLink = `${window.location.origin}/join?token=${invite.token}`;

    // Get organization name for email
    const { data: orgData } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .maybeSingle();

    // Send email via API
    try {
      const emailResponse = await fetch("/api/invite/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: invite.email,
          inviteLink,
          organizationName: orgData?.name ?? "기관",
          role: invite.role,
        }),
      });

      const emailResult = await emailResponse.json();

      if (emailResult.ok) {
        setMessage("초대 이메일을 재전송했습니다.");
      } else {
        // Email failed, but provide link as backup
        try {
          await navigator.clipboard.writeText(inviteLink);
          setMessage(
            `초대 링크가 클립보드에 복사되었습니다. (이메일 발송 실패: ${emailResult.message})`
          );
        } catch {
          setMessage(
            `초대 링크: ${inviteLink} (이메일 발송 실패: ${emailResult.message})`
          );
        }
      }
    } catch {
      // API call failed, provide link as backup
      try {
        await navigator.clipboard.writeText(inviteLink);
        setMessage("초대 링크가 클립보드에 복사되었습니다. (이메일 발송 오류)");
      } catch {
        setMessage(`초대 링크: ${inviteLink} (이메일 발송 오류)`);
      }
    }

    await supabase.from("audit_logs").insert({
      organization_id: organizationId,
      actor_id: currentUserId,
      action: "invite_resent",
      target_type: "email",
      metadata: { email: invite.email, role: invite.role },
    });
  };

  const copyInviteLink = async (invite: InviteRow) => {
    if (!invite.token) {
      setMessage("초대 링크가 없습니다.");
      return;
    }

    const inviteLink = `${window.location.origin}/join?token=${invite.token}`;

    try {
      await navigator.clipboard.writeText(inviteLink);
      setMessage("초대 링크가 클립보드에 복사되었습니다.");
    } catch {
      setMessage(`초대 링크: ${inviteLink}`);
    }
  };

  const shareGeneratedInviteLink = async () => {
    if (!generatedInviteLink) return;

    const shareText = "교회 자원관리 시스템 초대장입니다. 아래 링크에서 가입을 진행해주세요.";

    try {
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function"
      ) {
        await navigator.share({
          title: "StewardFlow 초대장",
          text: shareText,
          url: generatedInviteLink,
        });
        return;
      }

      await navigator.clipboard.writeText(generatedInviteLink);
      setInviteLinkCopied(true);
      setTimeout(() => setInviteLinkCopied(false), 2000);
      setMessage("공유 기능이 지원되지 않아 링크를 클립보드에 복사했습니다.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setMessage("링크 공유에 실패했습니다.");
    }
  };

  const revokeInvite = async (invite: InviteRow) => {
    setMessage(null);

    if (currentUserRole === "user") {
      setMessage("초대 취소는 관리자 또는 부서 관리자만 가능합니다.");
      return;
    }

    // 부서 관리자는 관리자 역할 초대를 취소할 수 없음
    if (currentUserRole === "manager" && invite.role === "admin") {
      setMessage("부서 관리자는 관리자 역할 초대를 취소할 수 없습니다.");
      return;
    }

    const { error } = await supabase
      .from("organization_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", invite.id)
      .eq("organization_id", organizationId);

    if (error) {
      setMessage(error.message);
      return;
    }

    setInvites((prev) => prev.filter((item) => item.id !== invite.id));

    await supabase.from("audit_logs").insert({
      organization_id: organizationId,
      actor_id: currentUserId,
      action: "invite_revoked",
      target_type: "organization_invite",
      target_id: invite.id,
      metadata: { email: invite.email, role: invite.role },
    });
  };

  const handleStartApproval = (userId: string) => {
    setApprovingUserId(userId);
    setApprovalOrganizationId("");
    setApprovalDepartment("");
    setApprovalRole("user");
    setApprovalDepartments([]);
  };

  const handleCancelApproval = () => {
    setApprovingUserId(null);
  };

  const handleOrganizationChange = async (orgId: string) => {
    setApprovalOrganizationId(orgId);
    setApprovalDepartment(""); // Reset department when organization changes
    if (!orgId) {
      setApprovalDepartments([]);
      return;
    }

    const departmentsResult = await listDepartmentsForAdminOrganization(orgId);
    if (!departmentsResult.success) {
      console.error(
        "Error loading departments for approval:",
        departmentsResult.error
      );
      setApprovalDepartments([]);
      return;
    }
    setApprovalDepartments(departmentsResult.departments);
  };

  const organizationNameById = useMemo(
    () => new Map(allOrganizations.map((organization) => [organization.id, organization.name] as const)),
    [allOrganizations]
  );

  const sortedAllUsers = useMemo(() => {
    const collator = new Intl.Collator("ko-KR", { sensitivity: "base", numeric: true });
    const nameOrEmail = (user: ProfileRow) =>
      (user.name?.trim() || user.email || "").trim();

    return [...allUsers].sort((a, b) =>
      collator.compare(nameOrEmail(a), nameOrEmail(b))
    );
  }, [allUsers]);

  const loadTransferDepartments = async (orgId: string) => {
    if (!orgId) {
      setTransferDepartments([]);
      return;
    }

    const departmentsResult = await listDepartmentsForAdminOrganization(orgId);
    if (!departmentsResult.success) {
      console.error(
        "Error loading transfer departments:",
        departmentsResult.error
      );
      setTransferDepartments([]);
      return;
    }

    setTransferDepartments(departmentsResult.departments);
  };

  const handleTransferUserChange = async (userId: string) => {
    setTransferUserId(userId);

    const selectedUser = allUsers.find((user) => user.id === userId);
    if (!selectedUser) {
      setTransferOrganizationId("");
      setTransferDepartment("");
      setTransferRole("user");
      setTransferDepartments([]);
      return;
    }

    setTransferRole(selectedUser.role ?? "user");
    const nextOrganizationId = selectedUser.organization_id ?? "";
    setTransferOrganizationId(nextOrganizationId);
    await loadTransferDepartments(nextOrganizationId);
    setTransferDepartment(selectedUser.department ?? "");
  };

  const handleTransferOrganizationSelect = async (orgId: string) => {
    setTransferOrganizationId(orgId);
    setTransferDepartment("");
    await loadTransferDepartments(orgId);
  };

  const createOrganizationForTransfer = async () => {
    if (currentUserRole !== "admin") {
      setMessage("기관 생성은 최고 관리자만 가능합니다.");
      return;
    }

    const name = newOrganizationName.trim();
    if (!name) {
      setMessage("기관 이름을 입력해주세요.");
      return;
    }

    setIsCreatingOrganization(true);
    setMessage(null);

    const result = await createOrganizationForAdmin(name);
    if (!result.success || !result.organization) {
      setMessage(result.error ?? "기관 생성에 실패했습니다.");
      setIsCreatingOrganization(false);
      return;
    }

    const nextOrganizations = [...allOrganizations, result.organization].sort((a, b) =>
      a.name.localeCompare(b.name, "ko-KR")
    );
    setAllOrganizations(nextOrganizations);
    setNewOrganizationName("");
    setTransferOrganizationId(result.organization.id);
    await loadTransferDepartments(result.organization.id);
    setMessage(
      `새 기관 "${result.organization.name}"이 생성되었습니다. 대상 기관으로 자동 선택되었습니다.`
    );
    setIsCreatingOrganization(false);
  };

  const assignUserOrganization = async () => {
    setMessage(null);

    if (currentUserRole !== "admin") {
      setMessage("기관 지정/이관은 최고 관리자만 가능합니다.");
      return;
    }

    if (!currentUserId) {
      setMessage("현재 사용자 정보를 확인할 수 없습니다.");
      return;
    }

    if (!transferUserId) {
      setMessage("대상을 선택해주세요.");
      return;
    }

    if (!transferOrganizationId) {
      setMessage("대상 기관을 선택해주세요.");
      return;
    }

    if (transferUserId === currentUserId) {
      setMessage("현재 로그인한 본인 계정은 이 화면에서 기관을 변경할 수 없습니다.");
      return;
    }

    const targetUser = allUsers.find((user) => user.id === transferUserId);
    if (!targetUser) {
      setMessage("대상 사용자를 찾을 수 없습니다.");
      return;
    }

    const nextDepartment = transferDepartment || null;
    const isNoChange =
      targetUser.organization_id === transferOrganizationId &&
      (targetUser.department ?? null) === nextDepartment &&
      targetUser.role === transferRole;

    if (isNoChange) {
      setMessage("변경할 내용이 없습니다.");
      return;
    }

    setIsTransferringUser(true);
    const result = await reassignUserOrganizationForAdmin({
      targetUserId: transferUserId,
      targetOrganizationId: transferOrganizationId,
      department: nextDepartment,
      role: transferRole,
    });

    if (!result.success) {
      setMessage(result.error ?? "기관 지정/이관에 실패했습니다.");
      setIsTransferringUser(false);
      return;
    }

    setMessage("사용자 기관/권한이 업데이트되었습니다.");
    setIsTransferringUser(false);
    await load();
  };

  const handleApproveUser = async () => {
    if (!approvingUserId || !approvalOrganizationId) {
      setMessage("기관을 선택해주세요.");
      return;
    }

    setMessage(null);
    setLoading(true);

    debugLog("사용자 승인 시도:", {
      userId: approvingUserId,
      organizationId: approvalOrganizationId,
      department: approvalDepartment,
      role: approvalRole,
    });

    const { error: updateProfileError, data: updateData } = await supabase
      .from("profiles")
      .update({
        organization_id: approvalOrganizationId,
        department: approvalDepartment || null,
        role: approvalRole,
      })
      .eq("id", approvingUserId)
      .select();

    if (updateProfileError) {
      console.error("프로필 업데이트 오류:", updateProfileError);
      console.error("에러 상세:", {
        code: updateProfileError.code,
        message: updateProfileError.message,
        details: updateProfileError.details,
        hint: updateProfileError.hint,
      });
      setMessage(`사용자 승인 실패: ${updateProfileError.message}`);
      setLoading(false);
      return;
    }

    debugLog("프로필 업데이트 결과:", updateData);

    // 업데이트 후 검증: 실제로 업데이트되었는지 확인
    const { data: verifyProfile, error: verifyError } = await supabase
      .from("profiles")
      .select("id, organization_id, department, role")
      .eq("id", approvingUserId)
      .maybeSingle();

    if (verifyError) {
      console.error("프로필 검증 오류:", verifyError);
      setMessage(`사용자 승인은 완료되었지만, 확인 중 오류가 발생했습니다: ${verifyError.message}`);
      setLoading(false);
      return;
    }

    if (!verifyProfile) {
      console.error("프로필 검증 실패: 프로필을 찾을 수 없습니다.");
      setMessage("사용자 승인 중 오류가 발생했습니다. 프로필을 찾을 수 없습니다.");
      setLoading(false);
      return;
    }

    debugLog("프로필 검증 결과:", verifyProfile);

    if (verifyProfile.organization_id !== approvalOrganizationId) {
      console.error("프로필 검증 실패: organization_id가 일치하지 않습니다.", {
        expected: approvalOrganizationId,
        actual: verifyProfile.organization_id,
      });
      setMessage("사용자 승인 중 오류가 발생했습니다. 기관 정보가 올바르게 저장되지 않았습니다.");
      setLoading(false);
      return;
    }

    debugLog("프로필 업데이트 성공 확인:", {
      organization_id: verifyProfile.organization_id,
      department: verifyProfile.department,
      role: verifyProfile.role,
    });

    await supabase.from("audit_logs").insert({
      organization_id: approvalOrganizationId,
      actor_id: currentUserId,
      action: "user_approved",
      target_type: "profile",
      target_id: approvingUserId,
      metadata: {
        approved_by_admin: true,
        organization_id: approvalOrganizationId,
        department: approvalDepartment,
        role: approvalRole,
      },
    });

    setMessage("사용자가 성공적으로 승인되었습니다.");
    setApprovingUserId(null);
    setApprovalOrganizationId("");
    setApprovalDepartment("");
    setApprovalRole("user");
    await load(); // Reload all data
  };

  const approveDepartmentChange = async (
    request: DepartmentRequestWithProfile
  ) => {
    setMessage(null);

    if (currentUserRole === "user") {
      setMessage("부서 변경 승인은 관리자만 가능합니다.");
      return;
    }

    if (!organizationId || !currentUserId) {
      setMessage("기관 정보를 확인할 수 없습니다.");
      return;
    }

    // 부서 관리자는 자신의 부서 사용자 요청만 승인 가능
    if (currentUserRole === "manager") {
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("department")
        .eq("id", currentUserId)
        .maybeSingle();

      if (
        currentProfile?.department !== request.from_department &&
        currentProfile?.department !== request.to_department
      ) {
        setMessage("자신의 부서 사용자 요청만 승인할 수 있습니다.");
        return;
      }
    }

    // 요청 승인 및 프로필 업데이트
    const now = new Date().toISOString();
    const { error: updateRequestError } = await supabase
      .from("department_change_requests")
      .update({
        status: "approved",
        resolved_at: now,
        resolved_by: currentUserId,
      })
      .eq("id", request.id);

    if (updateRequestError) {
      setMessage(`요청 승인 실패: ${updateRequestError.message}`);
      return;
    }

    // 프로필의 부서 업데이트
    const { error: updateProfileError } = await supabase
      .from("profiles")
      .update({ department: request.to_department })
      .eq("id", request.requester_id)
      .eq("organization_id", organizationId);

    if (updateProfileError) {
      setMessage(`프로필 업데이트 실패: ${updateProfileError.message}`);
      // 요청 상태는 되돌리기
      await supabase
        .from("department_change_requests")
        .update({ status: "pending", resolved_at: null, resolved_by: null })
        .eq("id", request.id);
      return;
    }

    // audit log
    await supabase.from("audit_logs").insert({
      organization_id: organizationId,
      actor_id: currentUserId,
      action: "department_change_approved",
      target_type: "department_change_request",
      target_id: request.id,
      metadata: {
        requester_id: request.requester_id,
        from_department: request.from_department,
        to_department: request.to_department,
      },
    });

    setMessage("부서 변경 요청이 승인되었습니다.");
    await load();
  };

  const rejectDepartmentChange = async (
    request: DepartmentRequestWithProfile
  ) => {
    setMessage(null);

    if (currentUserRole === "user") {
      setMessage("부서 변경 거부는 관리자만 가능합니다.");
      return;
    }

    if (!organizationId || !currentUserId) {
      setMessage("기관 정보를 확인할 수 없습니다.");
      return;
    }

    // 부서 관리자는 자신의 부서 사용자 요청만 거부 가능
    if (currentUserRole === "manager") {
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("department")
        .eq("id", currentUserId)
        .maybeSingle();

      if (
        currentProfile?.department !== request.from_department &&
        currentProfile?.department !== request.to_department
      ) {
        setMessage("자신의 부서 사용자 요청만 거부할 수 있습니다.");
        return;
      }
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("department_change_requests")
      .update({
        status: "rejected",
        resolved_at: now,
        resolved_by: currentUserId,
      })
      .eq("id", request.id);

    if (error) {
      setMessage(`요청 거부 실패: ${error.message}`);
      return;
    }

    // audit log
    await supabase.from("audit_logs").insert({
      organization_id: organizationId,
      actor_id: currentUserId,
      action: "department_change_rejected",
      target_type: "department_change_request",
      target_id: request.id,
      metadata: {
        requester_id: request.requester_id,
        from_department: request.from_department,
        to_department: request.to_department,
      },
    });

    setMessage("부서 변경 요청이 거부되었습니다.");
    await load();
  };

  const approveDeletionRequest = async (requestId: string) => {
    if (currentUserRole !== "admin") {
      setMessage("탈퇴 요청 승인은 최고 관리자만 가능합니다.");
      return;
    }

    if (!organizationId || !currentUserId) {
      setMessage("기관 정보를 확인할 수 없습니다.");
      return;
    }

    setProcessingRequestId(requestId);
    setMessage(null);

    // 요청 정보 조회
    const { data: request, error: requestError } = await supabase
      .from("account_deletion_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (requestError || !request) {
      setMessage(`요청 조회 실패: ${requestError?.message}`);
      setProcessingRequestId(null);
      return;
    }

    // 부서 관리자인 경우 권한 양도
    if (request.requester_role === "manager" && request.transfer_to_user_id) {
      const { error: transferError } = await supabase
        .from("profiles")
        .update({ role: "manager" })
        .eq("id", request.transfer_to_user_id)
        .eq("organization_id", organizationId);

      if (transferError) {
        setMessage(`권한 양도 실패: ${transferError.message}`);
        setProcessingRequestId(null);
        return;
      }

      // Audit log 기록 (권한 양도)
      await supabase.from("audit_logs").insert({
        organization_id: organizationId,
        actor_id: currentUserId,
        action: "role_transferred",
        target_type: "profile",
        target_id: request.transfer_to_user_id,
        metadata: {
          from_user_id: request.requester_id,
          from_user_name: request.requester_name,
          to_user_id: request.transfer_to_user_id,
          transferred_role: "manager",
        },
      });
    }

    // Server Action을 사용하여 auth.users와 profiles 모두 삭제
    try {
      // 동적 import를 사용하여 Server Action을 안전하게 로드
      const authActionsModule = await import("@/actions/auth-actions");
      if (!authActionsModule || !authActionsModule.deleteUserAccount) {
        throw new Error("Server Action을 로드할 수 없습니다.");
      }
      
      const deleteResult = await authActionsModule.deleteUserAccount(request.requester_id);

      if (!deleteResult || !deleteResult.success) {
        setMessage(deleteResult?.error || "계정 삭제 실패");
        setProcessingRequestId(null);
        return;
      }
    } catch (error: unknown) {
      console.error("Account deletion error:", error);
      const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류";
      setMessage(`계정 삭제 중 오류가 발생했습니다: ${errorMessage}`);
      setProcessingRequestId(null);
      return;
    }

    // 요청 상태 업데이트
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("account_deletion_requests")
      .update({
        status: "approved",
        resolved_at: now,
        resolved_by: currentUserId,
        admin_note: adminNote || null,
      })
      .eq("id", requestId);

    if (updateError) {
      setMessage(`요청 상태 업데이트 실패: ${updateError.message}`);
      setProcessingRequestId(null);
      return;
    }

    // Audit log 기록 (계정 삭제)
    await supabase.from("audit_logs").insert({
      organization_id: organizationId,
      actor_id: currentUserId,
      action: "account_deleted",
      target_type: "profile",
      target_id: request.requester_id,
      metadata: {
        deleted_user_name: request.requester_name,
        deleted_user_email: request.requester_email,
        role_transferred: request.requester_role === "manager" && request.transfer_to_user_id ? true : false,
        approved_by_admin: true,
      },
    });

    setMessage("탈퇴 요청이 승인되었습니다.");
    setAdminNote("");
    setProcessingRequestId(null);
    await load();
  };

  const rejectDeletionRequest = async (requestId: string) => {
    if (currentUserRole !== "admin") {
      setMessage("탈퇴 요청 거부는 최고 관리자만 가능합니다.");
      return;
    }

    if (!organizationId || !currentUserId) {
      setMessage("기관 정보를 확인할 수 없습니다.");
      return;
    }

    setProcessingRequestId(requestId);
    setMessage(null);

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("account_deletion_requests")
      .update({
        status: "rejected",
        resolved_at: now,
        resolved_by: currentUserId,
        admin_note: adminNote || null,
      })
      .eq("id", requestId);

    if (error) {
      setMessage(`요청 거부 실패: ${error.message}`);
      setProcessingRequestId(null);
      return;
    }

    // audit log
    await supabase.from("audit_logs").insert({
      organization_id: organizationId,
      actor_id: currentUserId,
      action: "account_deletion_rejected",
      target_type: "account_deletion_request",
      target_id: requestId,
      metadata: {
        admin_note: adminNote || null,
      },
    });

    setMessage("탈퇴 요청이 거부되었습니다.");
    setAdminNote("");
    setProcessingRequestId(null);
    await load();
  };

  if (loading) {
    return (
      <Notice>사용자 목록을 불러오는 중입니다.</Notice>
    );
  }

  if (needsOrganization) {
    return (
      <Notice variant="warning" className="text-left">
        기관 설정이 필요합니다.{" "}
        <a href="/settings/org" className="underline">
          기관 설정
        </a>
        으로 이동해 생성/참여를 완료해주세요.
      </Notice>
    );
  }

  const messageVariant =
    message?.includes("실패") || message?.includes("오류")
      ? "error"
      : message?.includes("불가") || message?.includes("권한")
      ? "warning"
      : "neutral";

  const collator = new Intl.Collator("ko-KR", {
    sensitivity: "base",
    numeric: true,
  });
  const sortedProfiles = [...profiles].sort((a, b) => {
    if (currentUserId && a.id === currentUserId) return -1;
    if (currentUserId && b.id === currentUserId) return 1;

    const labelA = (a.name?.trim() || a.email || "").trim();
    const labelB = (b.name?.trim() || b.email || "").trim();
    const byName = collator.compare(labelA, labelB);
    if (byName !== 0) return byName;
    return collator.compare(a.email, b.email);
  });

  return (
    <div className="manage-stack">
      {message && (
        <Notice variant={messageVariant} className="text-left">
          {message}
        </Notice>
      )}

      <section className="module-toolbar">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-600">내 역할:</span>
              <span className="chip-muted">{roleLabel[currentUserRole]}</span>
            </div>
            {lastLoadedAt && (
              <span className="text-xs text-neutral-400">
                최근 갱신: {formatDateTime(lastLoadedAt)}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={load}
            className="btn-outline w-full sm:w-auto"
          >
            새로고침
          </button>
        </div>
      </section>

      <section className="surface-card p-5 md:p-6">
        <div className="mb-3">
          <h3 className="text-base font-semibold text-slate-900">사용자 초대</h3>
          <p className="mt-1 text-xs text-neutral-500">
            이름, 역할, 부서는 초대 시 지정되며 가입 시 확인됩니다. 이메일은 가입 시 변경 가능합니다.
          </p>
        </div>
        <div className="module-toolbar mb-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-600">초대 링크 유효기간</span>
              <select
                className="form-select h-9 w-28 text-xs"
                value={inviteExpiresDays}
                onChange={(event) => setInviteExpiresDays(Number(event.target.value))}
                disabled={currentUserRole !== "admin" || savingInvitePolicy}
              >
                {INVITE_EXPIRES_DAY_OPTIONS.map((days) => (
                  <option key={days} value={days}>
                    {days}일
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={saveInviteExpirationPolicy}
                disabled={currentUserRole !== "admin" || savingInvitePolicy}
                className="btn-outline h-9 shrink-0 whitespace-nowrap px-3 text-xs sm:min-w-[92px]"
              >
                {savingInvitePolicy ? "저장 중..." : "만료일 저장"}
              </button>
            </div>
            <p className="text-[11px] text-neutral-500">
              현재 신규 초대는 생성 시점 기준 {inviteExpiresDays}일 후 만료됩니다.
            </p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            type="text"
            className="form-input w-full min-w-0"
            placeholder="이름 (필수)"
            value={invitationName}
            onChange={(event) => setInvitationName(event.target.value)}
            disabled={currentUserRole === "user"}
            required
          />
          <input
            className="form-input w-full min-w-0"
            placeholder="이메일 (선택사항, 가입 시 변경 가능)"
            value={invitationEmail}
            onChange={(event) => setInvitationEmail(event.target.value)}
            disabled={currentUserRole === "user"}
            type="email"
          />
        </div>
        <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,160px)_minmax(0,1fr)_auto]">
          <select
            className="form-select w-full min-w-0"
            value={invitationRole}
            onChange={(event) =>
              setInvitationRole(event.target.value as ProfileRow["role"])
            }
            disabled={currentUserRole === "user"}
          >
            {roleOptions
              .filter((option) =>
                currentUserRole === "admin" ? true : option.value !== "admin"
              )
              .map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
          </select>
          <select
            className="form-select w-full min-w-0"
            value={invitationDepartment}
            onChange={(event) => setInvitationDepartment(event.target.value)}
            disabled={currentUserRole === "user"}
          >
            <option value="">부서 선택 (선택사항)</option>
            {availableDepartments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={sendInvite}
            disabled={currentUserRole === "user" || !invitationName.trim()}
            className="btn-primary w-full md:w-auto"
          >
            초대 링크 생성
          </button>
        </div>
        {currentUserRole === "user" && (
          <span className="mt-2 block text-xs text-neutral-500">
            초대는 관리자 또는 부서 관리자만 가능합니다.
          </span>
        )}
        {currentUserRole === "manager" && (
          <span className="mt-2 block text-xs text-amber-600">
            부서 관리자는 일반 사용자 또는 부서 관리자만 초대할 수 있습니다.
          </span>
        )}
      </section>

      <section className="surface-card p-5 md:p-6 text-xs">
        <h3 className="text-sm font-semibold text-slate-900">대기 중인 초대</h3>
        {invites.length === 0 ? (
          <div className="mt-2 text-neutral-500">
            <p>대기 중인 초대가 없습니다.</p>
            <p className="mt-1 text-[11px] text-neutral-400">
              위에서 이메일을 입력해 초대를 발송할 수 있습니다.
            </p>
          </div>
        ) : (
          <div className="module-list mt-3">
            <div className="list-row-muted hidden items-center text-xs text-neutral-500 lg:grid lg:grid-cols-[minmax(0,1fr)_320px]">
              <span>초대 정보</span>
              <span className="text-right">액션</span>
            </div>
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="list-row flex-col justify-between gap-3 text-xs lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-neutral-900">
                    {invite.name || invite.email}
                    {invite.name && (
                      <span className="text-neutral-500"> ({invite.email || "이메일 없음"})</span>
                    )}
                  </p>
                  <p className="text-xs text-neutral-500">
                    역할: {roleLabel[invite.role]}
                    {invite.department && ` · 부서: ${invite.department}`}
                  </p>
                  <p className="text-xs text-neutral-500">
                    생성: {formatDateTime(invite.created_at)}
                  </p>
                  <p className="text-xs text-neutral-400">
                    만료: {formatDateTime(getExpiresAt(invite.created_at, invite.expires_at, inviteExpiresDays))}
                  </p>
                </div>
                <div className="flex w-full flex-wrap items-center justify-end gap-2 lg:w-[320px] lg:flex-nowrap">
                  {invite.token && (
                    <button
                      type="button"
                      onClick={() => copyInviteLink(invite)}
                      className="btn-outline h-9 px-3 text-xs"
                    >
                      링크 복사
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => resendInvite(invite)}
                    className="btn-outline h-9 px-3 text-xs"
                  >
                    재전송
                  </button>
                  <button
                    type="button"
                    onClick={() => revokeInvite(invite)}
                    className="btn-outline btn-outline-danger h-9 px-3 text-xs"
                  >
                    취소
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {departmentChangeRequests.length > 0 && (
        <section className="surface-card border-blue-200 p-5 md:p-6">
          <h3 className="text-sm font-semibold text-slate-900">부서 변경 요청</h3>
          <div className="module-list mt-3">
            <div className="list-row-muted hidden items-center text-xs text-neutral-500 lg:grid lg:grid-cols-[minmax(0,1fr)_200px]">
              <span>요청 정보</span>
              <span className="text-right">처리</span>
            </div>
            {departmentChangeRequests.map((request) => (
              <div
                key={request.id}
                className="list-row flex-col items-start justify-between gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_200px] lg:items-center"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-neutral-900">
                    {request.requester_name || request.requester_email}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {request.from_department || "(없음)"} → {request.to_department}
                  </p>
                  {request.note && (
                    <p className="mt-1 text-xs text-neutral-600">사유: {request.note}</p>
                  )}
                  <p className="mt-1 text-xs text-neutral-400">
                    {formatDateTime(request.created_at)}
                  </p>
                </div>
                <div className="flex w-full justify-end gap-2 lg:w-[200px]">
                  <button
                    type="button"
                    onClick={() => approveDepartmentChange(request)}
                    className="btn-outline btn-outline-success h-9 px-3 text-xs"
                  >
                    승인
                  </button>
                  <button
                    type="button"
                    onClick={() => rejectDepartmentChange(request)}
                    className="btn-outline btn-outline-danger h-9 px-3 text-xs"
                  >
                    거부
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {currentUserRole === "admin" && deletionRequests.length > 0 && (
        <section className="surface-card border-rose-200 p-5 md:p-6">
          <h3 className="text-sm font-semibold text-slate-900">계정 탈퇴 요청</h3>
          <p className="mt-1 text-xs text-neutral-500">
            부서 관리자의 탈퇴 요청입니다. 승인 시 계정이 영구적으로 삭제됩니다.
          </p>
          <div className="module-list mt-3">
            <div className="list-row-muted hidden items-center text-xs text-neutral-500 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem]">
              <span>요청 정보</span>
              <span className="text-right">승인 처리</span>
            </div>
            {deletionRequests.map((request) => (
              <div key={request.id} className="list-row flex-col items-stretch gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-900">
                    {request.requester_name || request.requester_email}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    역할: {roleLabel[request.requester_role as ProfileRow["role"]] || request.requester_role}
                    {request.requester_department && ` · 부서: ${request.requester_department}`}
                  </p>
                  {request.transfer_to_user_name && (
                    <p className="mt-1 text-xs text-amber-700">
                      권한 위임 대상: {request.transfer_to_user_name}
                    </p>
                  )}
                  {request.note && (
                    <p className="mt-1 text-xs text-neutral-600">탈퇴 사유: {request.note}</p>
                  )}
                  <p className="mt-1 text-xs text-neutral-400">
                    요청일: {formatDateTime(request.created_at)}
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-700">
                    관리자 메모 (선택)
                  </label>
                  <textarea
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    className="form-textarea min-h-[60px] text-sm"
                    placeholder="승인/거부 사유를 입력하세요"
                    disabled={processingRequestId === request.id}
                  />
                </div>
                <div className="flex justify-end gap-2 lg:col-start-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAdminNote("");
                      approveDeletionRequest(request.id);
                    }}
                    disabled={processingRequestId !== null}
                    className="btn-outline btn-outline-success h-9 flex-1 px-3 text-xs"
                  >
                    {processingRequestId === request.id ? "처리 중..." : "승인"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdminNote("");
                      rejectDeletionRequest(request.id);
                    }}
                    disabled={processingRequestId !== null}
                    className="btn-outline btn-outline-danger h-9 flex-1 px-3 text-xs"
                  >
                    {processingRequestId === request.id ? "처리 중..." : "거부"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {currentUserRole === "admin" && allUsers.length > 0 && (
        <section className="surface-card border-indigo-200 p-5 md:p-6">
          <h3 className="text-sm font-semibold text-slate-900">사용자 기관 지정/이관</h3>
          <p className="mt-1 text-xs text-neutral-500">
            이미 가입한 사용자를 다른 기관으로 지정하거나, 동시에 부서/권한을 재설정할 수 있습니다.
          </p>
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <p className="text-xs font-medium text-neutral-700">새 기관 추가</p>
            <p className="mt-1 text-[11px] text-neutral-500">
              현재 소속은 유지한 채 기관을 추가 생성합니다. 생성 즉시 아래 &quot;대상 기관&quot; 선택 목록에 반영됩니다.
            </p>
            <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
              <input
                type="text"
                className="form-input h-10"
                value={newOrganizationName}
                onChange={(event) => setNewOrganizationName(event.target.value)}
                placeholder="새 기관 이름 입력 (예: 은혜교회)"
                disabled={isCreatingOrganization}
              />
              <button
                type="button"
                onClick={createOrganizationForTransfer}
                disabled={isCreatingOrganization || !newOrganizationName.trim()}
                className="btn-outline h-10 w-full whitespace-nowrap px-4 md:w-auto"
              >
                {isCreatingOrganization ? "생성 중..." : "기관 추가"}
              </button>
            </div>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="form-label">대상 사용자</label>
              <select
                className="form-select"
                value={transferUserId}
                onChange={(event) => {
                  void handleTransferUserChange(event.target.value);
                }}
                disabled={isTransferringUser}
              >
                <option value="">사용자를 선택하세요</option>
                {sortedAllUsers
                  .filter((user) => user.id !== currentUserId)
                  .map((user) => {
                    const organizationLabel = user.organization_id
                      ? organizationNameById.get(user.organization_id) ?? "기관"
                      : "미소속";
                    const displayName = user.name || user.email;
                    return (
                      <option key={user.id} value={user.id}>
                        {displayName} ({organizationLabel})
                      </option>
                    );
                  })}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="form-label">대상 기관</label>
              <select
                className="form-select"
                value={transferOrganizationId}
                onChange={(event) => {
                  void handleTransferOrganizationSelect(event.target.value);
                }}
                disabled={isTransferringUser || !transferUserId}
              >
                <option value="">기관을 선택하세요</option>
                {allOrganizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,180px)_auto]">
            <select
              className="form-select"
              value={transferDepartment}
              onChange={(event) => setTransferDepartment(event.target.value)}
              disabled={isTransferringUser || !transferOrganizationId}
            >
              <option value="">부서 없음</option>
              {transferDepartments.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>

            <select
              className="form-select"
              value={transferRole}
              onChange={(event) =>
                setTransferRole(event.target.value as ProfileRow["role"])
              }
              disabled={isTransferringUser || !transferUserId}
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={assignUserOrganization}
              disabled={
                isTransferringUser || !transferUserId || !transferOrganizationId
              }
              className="btn-primary w-full md:w-auto"
            >
              {isTransferringUser ? "적용 중..." : "기관 지정 적용"}
            </button>
          </div>
        </section>
      )}

      {currentUserRole === "admin" && pendingUsers.length > 0 && (
        <section className="surface-card border-amber-200 p-5 md:p-6">
          <h3 className="text-sm font-semibold text-slate-900">미승인 사용자</h3>
          <p className="mt-1 text-xs text-neutral-500">
            초대코드 없이 가입한 사용자입니다. 기관, 부서, 권한을 지정해 승인해주세요.
          </p>
          <div className="module-list mt-3">
            <div className="list-row-muted hidden items-center text-xs text-neutral-500 lg:grid lg:grid-cols-[minmax(0,1fr)_120px]">
              <span>사용자</span>
              <span className="text-right">승인</span>
            </div>
            {pendingUsers.map((user) => (
              <div
                key={user.id}
                className="list-row flex-col items-start justify-between gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_120px] lg:items-center"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-neutral-900">
                    {user.name || "이름 없음"}
                  </p>
                  <p className="text-xs text-neutral-500">{user.email}</p>
                  <p className="mt-1 text-xs text-neutral-400">
                    가입일: {formatDateTime(user.created_at || new Date().toISOString())}
                  </p>
                </div>
                <div className="flex w-full justify-end lg:w-[120px]">
                  <button
                    type="button"
                    onClick={() => handleStartApproval(user.id)}
                    className="btn-primary h-9 px-3 text-xs"
                  >
                    승인하기
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 승인 모달 */}
      {approvingUserId && (
        <div className="modal-backdrop">
          <div className="modal-surface max-w-md">
            <h3 className="text-lg font-semibold text-slate-900">사용자 승인</h3>
            <div className="mt-4 space-y-4">
              <div>
                <label className="form-label">기관 선택</label>
                <select
                  className="form-select"
                  value={approvalOrganizationId}
                  onChange={(e) => handleOrganizationChange(e.target.value)}
                  required
                >
                  <option value="">기관을 선택하세요</option>
                  {allOrganizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>
              {approvalOrganizationId && (
                <>
                  <div>
                    <label className="form-label">부서 선택 (선택사항)</label>
                    <select
                      className="form-select"
                      value={approvalDepartment}
                      onChange={(e) => setApprovalDepartment(e.target.value)}
                    >
                      <option value="">부서 없음</option>
                      {approvalDepartments.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">권한</label>
                    <select
                      className="form-select"
                      value={approvalRole}
                      onChange={(e) =>
                        setApprovalRole(e.target.value as ProfileRow["role"])
                      }
                      required
                    >
                      {roleOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={handleApproveUser}
                disabled={!approvalOrganizationId}
                className="btn-primary flex-1"
              >
                승인
              </button>
              <button
                type="button"
                onClick={handleCancelApproval}
                className="btn-outline flex-1"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="surface-card p-5 md:p-6">
        <h3 className="text-sm font-semibold text-slate-900">등록된 사용자</h3>
        <div className="module-toolbar mt-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-600">
            <span className="module-kpi">총 {profiles.length}명</span>
            <span>본인 우선, 나머지는 이름순으로 정렬됩니다. 부서/권한은 우측에서 즉시 변경됩니다.</span>
          </div>
        </div>
        {profiles.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
            <p>등록된 사용자가 없습니다.</p>
            <p className="mt-2 text-xs text-neutral-400">
              초대를 보내 새 사용자를 추가해 주세요.
            </p>
          </div>
        ) : (
          <ModuleList className="mt-3">
            <ModuleListHeader
              left="사용자"
              right="부서 / 권한 / 관리"
              className="lg:grid-cols-[minmax(0,1fr)_500px]"
            />
            {sortedProfiles.map((profile) => (
              <div
                key={profile.id}
                className="list-row flex-col items-start justify-between gap-3 text-xs md:grid md:grid-cols-[minmax(0,1fr)_520px] md:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-neutral-900">
                    {profile.name ?? "이름 없음"}
                  </p>
                  <p className="text-xs text-neutral-500">{profile.email}</p>
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 md:w-[520px] md:flex-nowrap md:justify-end">
                  {currentUserRole === "admin" ? (
                    <select
                      className="form-select h-[38px] w-full md:w-[220px] md:shrink-0"
                      value={profile.department || ""}
                      onChange={(event) =>
                        updateDepartment(
                          profile.id,
                          event.target.value || null
                        )
                      }
                      disabled={currentUserId === profile.id}
                    >
                      <option value="">부서 미지정</option>
                      {availableDepartments.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="flex h-[38px] w-full items-center rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-xs text-neutral-500 md:w-[220px] md:shrink-0">
                      {profile.department ?? "부서 미등록"}
                    </span>
                  )}
                  <select
                    className="form-select h-10 w-full md:w-[220px] md:shrink-0"
                    value={profile.role}
                    onChange={(event) =>
                      updateRole(
                        profile.id,
                        event.target.value as ProfileRow["role"]
                      )
                    }
                    disabled={
                      currentUserId === profile.id ||
                      currentUserRole === "user" ||
                      (currentUserRole === "manager" && profile.role === "admin")
                    }
                  >
                    {roleOptions
                      .filter((option) =>
                        currentUserRole === "manager"
                          ? profile.role === "admin" || option.value !== "admin"
                          : true
                      )
                      .map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                  </select>
                  {currentUserRole === "admin" && profile.id !== currentUserId ? (
                    <button
                      type="button"
                      onClick={() => deleteUser(profile.id, profile.name || "이름 없음")}
                      disabled={deletingUserId === profile.id || loading}
                      className="icon-button icon-button-danger md:ml-1 md:shrink-0"
                      title="사용자 삭제"
                    >
                      {deletingUserId === profile.id ? (
                        <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  ) : (
                    <div className="hidden h-10 w-10 md:block md:shrink-0" aria-hidden="true" />
                  )}
                </div>
              </div>
            ))}
          </ModuleList>
        )}
      </section>

      {/* 성공 토스트 모달 */}
      {successToast && (
        <div className="fixed inset-x-4 bottom-4 z-50 animate-in slide-in-from-bottom-4 sm:inset-x-auto sm:right-4">
          <div className="w-full rounded-lg bg-emerald-500 text-white px-4 py-3 shadow-lg flex items-center gap-2 sm:min-w-[200px]">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium">{successToast}</span>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && userToDelete && (
        <div className="modal-backdrop">
          <div className="modal-surface max-w-md">
            <h3 className="text-lg font-semibold text-slate-900">사용자 삭제 확인</h3>
            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
                <p className="text-sm text-rose-900 font-medium mb-2">
                  정말로 &quot;{userToDelete.name}&quot; 사용자를 삭제하시겠습니까?
                </p>
                <p className="text-xs text-rose-700">
                  이 작업은 되돌릴 수 없습니다. 사용자의 모든 데이터가 삭제됩니다.
                </p>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={confirmDeleteUser}
                className="btn-danger flex-1"
              >
                삭제
              </button>
              <button
                type="button"
                onClick={cancelDeleteUser}
                className="btn-outline flex-1"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 초대 링크 모달 */}
      {showInviteLinkModal && generatedInviteLink && (
        <div className="modal-backdrop">
          <div className="modal-surface max-w-md">
            <h3 className="text-lg font-semibold text-slate-900">초대 링크 생성 완료</h3>
            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-sm text-emerald-700 mb-2">
                  초대 링크가 생성되었습니다. 복사하거나 모바일 공유로 바로 전송하세요.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    readOnly
                    value={generatedInviteLink}
                    className="flex-1 form-input text-sm bg-white"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(generatedInviteLink);
                        setInviteLinkCopied(true);
                        setTimeout(() => setInviteLinkCopied(false), 2000);
                      } catch {
                        setMessage("클립보드 복사에 실패했습니다.");
                      }
                    }}
                    className="btn-primary h-10 w-full px-4 text-sm sm:w-auto"
                  >
                    {inviteLinkCopied ? "복사됨!" : "복사"}
                  </button>
                  <button
                    type="button"
                    onClick={shareGeneratedInviteLink}
                    className="btn-outline h-10 w-full px-4 text-sm sm:w-auto"
                  >
                    공유
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  setShowInviteLinkModal(false);
                  setGeneratedInviteLink(null);
                  await load();
                }}
                className="btn-primary flex-1"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const getExpiresAt = (
  createdAt: string,
  expiresAt: string | null | undefined,
  fallbackDays: number = DEFAULT_INVITE_EXPIRES_DAYS
) => {
  if (expiresAt) {
    const expiresDate = new Date(expiresAt);
    if (!Number.isNaN(expiresDate.getTime())) {
      return expiresDate.toISOString();
    }
  }

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return createdAt;
  }
  date.setDate(date.getDate() + fallbackDays);
  return date.toISOString();
};

const isInviteExpired = (
  createdAt: string,
  expiresAt: string | null | undefined,
  fallbackDays: number = DEFAULT_INVITE_EXPIRES_DAYS
) => {
  const expiresDate = new Date(getExpiresAt(createdAt, expiresAt, fallbackDays));
  if (Number.isNaN(expiresDate.getTime())) {
    return false;
  }
  return expiresDate.getTime() < Date.now();
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};
