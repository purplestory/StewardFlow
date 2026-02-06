"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { generateShortId } from "@/lib/short-id";
import type { DepartmentChangeRequest } from "@/types/database";

type ProfileRow = {
  id: string;
  email: string;
  name: string | null;
  department: string | null;
  role: "admin" | "manager" | "user";
  organization_id: string | null;
  created_at?: string;
};

type InviteRow = {
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

const roleLabel: Record<ProfileRow["role"], string> = {
  admin: "관리자",
  manager: "부서 관리자",
  user: "일반 사용자",
};

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
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [needsOrganization, setNeedsOrganization] = useState(false);
  const [departmentChangeRequests, setDepartmentChangeRequests] = useState<
    (DepartmentChangeRequest & { requester_name: string | null; requester_email: string })[]
  >([]);
  const [pendingUsers, setPendingUsers] = useState<ProfileRow[]>([]);
  const [allOrganizations, setAllOrganizations] = useState<Array<{ id: string; name: string }>>([]);
  const [approvingUserId, setApprovingUserId] = useState<string | null>(null);
  const [approvalOrganizationId, setApprovalOrganizationId] = useState<string>("");
  const [approvalDepartment, setApprovalDepartment] = useState<string>("");
  const [approvalRole, setApprovalRole] = useState<ProfileRow["role"]>("user");
  const [approvalDepartments, setApprovalDepartments] = useState<string[]>([]);
  const [showInviteLinkModal, setShowInviteLinkModal] = useState(false);
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deletionRequests, setDeletionRequests] = useState<Array<{
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
  }>>([]);
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
      setLoading(false);
      return;
    }

    // 프로필 조회 시 더 자세한 디버깅 정보 수집
    console.log("Loading profile for user:", user.id);
    
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id,role")
      .eq("id", user.id)
      .maybeSingle();

    console.log("Profile query result:", {
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

    console.log("Profile loaded successfully:", {
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

    // 일반 사용자는 사용자 목록을 볼 수 없음 (페이지 접근 불가)
    if (profileData.role === "user") {
      setProfiles([]);
      setInvites([]);
      setPendingUsers([]);
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
        setMessage(`사용자 조회 실패: ${allUsersError.message}`);
      } else if (allUsersData) {
        // 클라이언트에서 organization_id가 null인 사용자만 필터링
        const pendingUsersData = allUsersData.filter(user => user.organization_id === null);
        console.log("전체 사용자 조회 성공:", allUsersData.length, "명");
        console.log("미승인 사용자:", pendingUsersData.length, "명");
        setPendingUsers(pendingUsersData as ProfileRow[]);
      }

      // 모든 기관 목록 조회 (최고관리자만)
      const { data: orgsData, error: orgsError } = await supabase
        .from("organizations")
        .select("id,name")
        .order("name", { ascending: true });

      if (!orgsError && orgsData) {
        setAllOrganizations(orgsData);
      }
    } else {
      setPendingUsers([]);
      setAllOrganizations([]);
    }

    // Load departments for invitation
    const { data: deptData } = await supabase
      .from("departments")
      .select("id,name")
      .eq("organization_id", profileData.organization_id);
    
    if (deptData) {
      // 순서 정보 로드
      let departmentOrder: string[] = [];
      try {
        const { data: orgData } = await supabase
          .from("organizations")
          .select("department_order")
          .eq("id", profileData.organization_id)
          .maybeSingle();

        if (orgData?.department_order) {
          departmentOrder = orgData.department_order as string[];
        }
      } catch (error) {
        // department_order 컬럼이 없을 수 있음 - 무시하고 계속 진행
        console.warn("department_order 컬럼을 읽을 수 없습니다:", error);
      }

      // 순서 정보가 있으면 그에 따라 정렬, 없으면 이름순 정렬
      let sortedDepartments = deptData;
      if (departmentOrder.length > 0) {
        const deptMap = new Map(sortedDepartments.map((d) => [d.id, d]));
        sortedDepartments = departmentOrder
          .map((id) => deptMap.get(id))
          .filter((d): d is { id: string; name: string } => d !== undefined)
          .concat(sortedDepartments.filter((d) => !departmentOrder.includes(d.id)));
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
        const requestsWithRequester = requestsData.map((req: any) => ({
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
      console.log("Profiles loaded:", data?.length || 0, "profiles");
      console.log("Profile IDs:", data?.map((p: ProfileRow) => p.id));
    }

    // Try to select token, but handle case where column doesn't exist yet
    let inviteData: InviteRow[] | null = null;
    let inviteError: any = null;
    
    try {
      const { data, error } = await supabase
        .from("organization_invites")
        .select("id,email,role,department,name,created_at,accepted_at,revoked_at,token")
        .eq("organization_id", profileData.organization_id)
        .is("accepted_at", null)
        .is("revoked_at", null)
        .order("created_at", { ascending: false });
      
      inviteData = data as InviteRow[] | null;
      inviteError = error;
    } catch (err: any) {
      // If token column doesn't exist, try without it
      if (err?.message?.includes("token") || err?.code === "42703") {
        const { data, error } = await supabase
          .from("organization_invites")
          .select("id,email,role,department,name,created_at,accepted_at,revoked_at")
          .eq("organization_id", profileData.organization_id)
          .is("accepted_at", null)
          .is("revoked_at", null)
          .order("created_at", { ascending: false });
        
        inviteData = (data ?? []).map((inv: any) => ({ ...inv, token: null })) as InviteRow[];
        inviteError = error;
      } else {
        inviteError = err;
      }
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
      console.log(`Loaded ${profilesList.length} profiles for organization ${profileData.organization_id}`);
      console.log("Profiles:", profilesList.map(p => ({ id: p.id, name: p.name, email: p.email, role: p.role })));
      setProfiles(profilesList);
      if (profilesList.length === 0) {
        console.warn("No profiles found for organization:", profileData.organization_id);
        setMessage("등록된 사용자가 없습니다. 초대를 보내 새 사용자를 추가해 주세요.");
      }
    }

    if (inviteError) {
      setMessage(inviteError.message);
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
          const { data: updatedInvites } = await supabase
            .from("organization_invites")
            .select("id,email,role,department,name,created_at,accepted_at,revoked_at,token")
            .eq("organization_id", profileData.organization_id)
            .is("accepted_at", null)
            .is("revoked_at", null)
            .order("created_at", { ascending: false });
          
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
              updatedPendingInvites.filter((invite) => !isInviteExpired(invite.created_at))
            );
            setLastLoadedAt(new Date().toISOString());
            setLoading(false);
            return;
          }
        }
      }
      
      const expiredIds = filteredInvites
        .filter((invite) => isInviteExpired(invite.created_at))
        .map((invite) => invite.id);

      if (expiredIds.length > 0) {
        const nowIso = new Date().toISOString();
        await supabase
          .from("organization_invites")
          .update({ revoked_at: nowIso })
          .in("id", expiredIds);
      }

      setInvites(
        filteredInvites.filter((invite) => !isInviteExpired(invite.created_at))
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

    setDeletingUserId(profileId);
    setLoading(true);
    setShowDeleteConfirm(false);
    setLoading(true);

    // 프로필 삭제 (실제로는 soft delete를 권장하지만, 여기서는 hard delete)
    const { error: deleteError } = await supabase
      .from("profiles")
      .delete()
      .eq("id", profileId)
      .eq("organization_id", organizationId);

    if (deleteError) {
      setMessage(`사용자 삭제 실패: ${deleteError.message}`);
      setLoading(false);
      setDeletingUserId(null);
      return;
    }

    // audit log
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
    setDeletingUserId(null);
    setUserToDelete(null);
    await load(); // 목록 새로고침
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

    // 초대 생성
    const { data: invite, error: inviteError } = await supabase
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

    let emailSent = false;
    let emailError: string | null = null;

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

        if (emailResult.ok) {
          emailSent = true;
        } else {
          emailError = emailResult.message;
        }
      } catch (error) {
        emailError = "이메일 발송 오류";
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
    } catch (error) {
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
    if (orgId) {
      const { data: depts, error } = await supabase
        .from("departments")
        .select("name")
        .eq("organization_id", orgId)
        .order("name", { ascending: true });
      if (error) {
        console.error("Error loading departments for approval:", error);
        setApprovalDepartments([]);
      } else {
        setApprovalDepartments(depts.map((d) => d.name));
      }
    } else {
      setApprovalDepartments([]);
    }
  };

  const handleApproveUser = async () => {
    if (!approvingUserId || !approvalOrganizationId) {
      setMessage("기관을 선택해주세요.");
      return;
    }

    setMessage(null);
    setLoading(true);

    const { error: updateProfileError } = await supabase
      .from("profiles")
      .update({
        organization_id: approvalOrganizationId,
        department: approvalDepartment || null,
        role: approvalRole,
      })
      .eq("id", approvingUserId);

    if (updateProfileError) {
      setMessage(`사용자 승인 실패: ${updateProfileError.message}`);
      setLoading(false);
      return;
    }

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
    await load(); // Reload all data
  };

  const approveDepartmentChange = async (request: DepartmentChangeRequest) => {
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

  const rejectDepartmentChange = async (request: DepartmentChangeRequest) => {
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
    } catch (error: any) {
      console.error("Account deletion error:", error);
      const errorMessage = error?.message || "알 수 없는 오류";
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
      <div className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
        사용자 목록을 불러오는 중입니다.
      </div>
    );
  }

  if (message) {
    return (
      <div className="rounded-lg border border-dashed border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-600">
        {message}
      </div>
    );
  }

  if (needsOrganization) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
        기관 설정이 필요합니다.{" "}
        <a href="/settings/org" className="underline">
          기관 설정
        </a>
        으로 이동해 생성/참여를 완료해주세요.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-600">내 역할:</span>
            <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-neutral-100 text-neutral-900">
              {roleLabel[currentUserRole]}
            </span>
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
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50"
        >
          새로고침
        </button>
      </div>

      <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            className="form-input flex-1 min-w-[120px]"
            placeholder="이름 (필수)"
            value={invitationName}
            onChange={(event) => setInvitationName(event.target.value)}
            disabled={currentUserRole === "user"}
            required
          />
          <input
            className="form-input flex-1 min-w-[120px]"
            placeholder="이메일 (선택사항, 가입 시 변경 가능)"
            value={invitationEmail}
            onChange={(event) => setInvitationEmail(event.target.value)}
            disabled={currentUserRole === "user"}
            type="email"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="form-select min-w-[140px]"
            value={invitationRole}
            onChange={(event) =>
              setInvitationRole(event.target.value as ProfileRow["role"])
            }
            disabled={currentUserRole === "user"}
          >
            <option value="user">일반 사용자</option>
            <option value="manager">부서 관리자</option>
            {/* 부서 관리자는 관리자 역할로 초대할 수 없음 */}
            {currentUserRole === "admin" && (
              <option value="admin">관리자</option>
            )}
          </select>
          <select
            className="form-select flex-1 min-w-[140px]"
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
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-neutral-900 text-white hover:bg-neutral-800 whitespace-nowrap"
          >
            초대 링크 생성
          </button>
        </div>
        <p className="text-xs text-neutral-500">
          이름, 역할, 부서는 초대 시 지정되며 가입 시 확인됩니다. 이메일은 가입 시 변경 가능합니다.
        </p>
        {currentUserRole === "user" && (
          <span className="text-xs text-neutral-500">
            초대는 관리자 또는 부서 관리자만 가능합니다.
          </span>
        )}
        {currentUserRole === "manager" && (
          <span className="text-xs text-amber-600">
            부서 관리자는 일반 사용자 또는 부서 관리자만 초대할 수 있습니다.
          </span>
        )}
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4 text-xs">
        <h3 className="text-sm font-semibold">대기 중인 초대</h3>
        {invites.length === 0 ? (
          <div className="mt-2 text-neutral-500">
            <p>대기 중인 초대가 없습니다.</p>
            <p className="mt-1 text-[11px] text-neutral-400">
              위에서 이메일을 입력해 초대를 발송할 수 있습니다.
            </p>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">
                    {invite.name || invite.email}
                    {invite.name && <span className="text-neutral-500"> ({invite.email || "이메일 없음"})</span>}
                  </p>
                  <p className="text-xs text-neutral-500">
                    역할: {roleLabel[invite.role]}
                    {invite.department && ` · 부서: ${invite.department}`}
                  </p>
                  <p className="text-xs text-neutral-500">
                    생성: {formatDateTime(invite.created_at)}
                  </p>
                  <p className="text-xs text-neutral-400">
                    만료: {formatDateTime(getExpiresAt(invite.created_at))}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {invite.token && (
                    <button
                      type="button"
                      onClick={() => copyInviteLink(invite)}
                      className="btn-ghost text-xs"
                    >
                      링크 복사
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => resendInvite(invite)}
                    className="btn-ghost text-xs"
                  >
                    재전송
                  </button>
                  <button
                    type="button"
                    onClick={() => revokeInvite(invite)}
                    className="h-[38px] rounded-lg border border-rose-200 bg-white px-3 text-xs font-medium text-rose-600 transition-all duration-200 hover:bg-rose-50 hover:border-rose-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    취소
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {departmentChangeRequests.length > 0 && (
        <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h3 className="text-sm font-semibold text-blue-900">부서 변경 요청</h3>
          {departmentChangeRequests.map((request) => (
            <div
              key={request.id}
              className="rounded-lg border border-blue-200 bg-white p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-neutral-900">
                    {request.requester_name || request.requester_email}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    {request.from_department || "(없음)"} → {request.to_department}
                  </p>
                  {request.note && (
                    <p className="text-xs text-neutral-600 mt-1">사유: {request.note}</p>
                  )}
                  <p className="text-xs text-neutral-400 mt-1">
                    {formatDateTime(request.created_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => approveDepartmentChange(request)}
                    className="h-[38px] rounded-lg border border-green-200 bg-white px-3 text-xs font-medium text-green-600 transition-all duration-200 hover:bg-green-50 hover:border-green-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    승인
                  </button>
                  <button
                    type="button"
                    onClick={() => rejectDepartmentChange(request)}
                    className="h-[38px] rounded-lg border border-rose-200 bg-white px-3 text-xs font-medium text-rose-600 transition-all duration-200 hover:bg-rose-50 hover:border-rose-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    거부
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 계정 탈퇴 요청 (최고 관리자만) */}
      {currentUserRole === "admin" && deletionRequests.length > 0 && (
        <div className="space-y-3 rounded-lg border border-rose-200 bg-rose-50 p-4">
          <h3 className="text-sm font-semibold text-rose-900">계정 탈퇴 요청</h3>
          <p className="text-xs text-rose-700">
            부서 관리자의 계정 탈퇴 요청입니다. 승인 시 계정이 영구적으로 삭제됩니다.
          </p>
          {deletionRequests.map((request) => (
            <div
              key={request.id}
              className="rounded-lg border border-rose-200 bg-white p-3"
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-neutral-900">
                      {request.requester_name || request.requester_email}
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">
                      역할: {roleLabel[request.requester_role as ProfileRow["role"]] || request.requester_role}
                      {request.requester_department && ` · 부서: ${request.requester_department}`}
                    </p>
                    {request.transfer_to_user_name && (
                      <p className="text-xs text-amber-700 mt-1">
                        권한 위임 대상: {request.transfer_to_user_name}
                      </p>
                    )}
                    {request.note && (
                      <p className="text-xs text-neutral-600 mt-1">탈퇴 사유: {request.note}</p>
                    )}
                    <p className="text-xs text-neutral-400 mt-1">
                      요청일: {formatDateTime(request.created_at)}
                    </p>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    관리자 메모 (선택)
                  </label>
                  <textarea
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    className="w-full form-input min-h-[60px] text-sm"
                    placeholder="승인/거부 사유를 입력하세요"
                    disabled={processingRequestId === request.id}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAdminNote("");
                      approveDeletionRequest(request.id);
                    }}
                    disabled={processingRequestId !== null}
                    className="flex-1 h-[38px] rounded-lg border border-green-200 bg-white px-3 text-xs font-medium text-green-600 transition-all duration-200 hover:bg-green-50 hover:border-green-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className="flex-1 h-[38px] rounded-lg border border-rose-200 bg-white px-3 text-xs font-medium text-rose-600 transition-all duration-200 hover:bg-rose-50 hover:border-rose-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processingRequestId === request.id ? "처리 중..." : "거부"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 미승인 사용자 목록 (최고관리자만) */}
      {currentUserRole === "admin" && pendingUsers.length > 0 && (
        <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-amber-900">미승인 사용자</h3>
          <p className="text-xs text-amber-700">
            초대코드 없이 가입한 사용자입니다. 기관, 부서, 권한을 지정하여 승인해주세요.
          </p>
          {pendingUsers.map((user) => (
            <div
              key={user.id}
              className="rounded-lg border border-amber-200 bg-white p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-neutral-900">
                    {user.name || "이름 없음"}
                  </p>
                  <p className="text-xs text-neutral-500">{user.email}</p>
                  <p className="text-xs text-neutral-400 mt-1">
                    가입일: {formatDateTime(user.created_at || new Date().toISOString())}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleStartApproval(user.id)}
                  className="h-[38px] px-4 rounded-lg text-sm font-medium transition-all bg-amber-600 text-white hover:bg-amber-700 whitespace-nowrap"
                >
                  승인하기
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 승인 모달 */}
      {approvingUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="rounded-t-lg bg-amber-600 px-6 py-4">
              <h3 className="text-lg font-semibold text-white">사용자 승인</h3>
            </div>
            <div className="px-6 py-4 space-y-4">
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
                      <option value="user">일반 사용자</option>
                      <option value="manager">부서 관리자</option>
                      <option value="admin">관리자</option>
                    </select>
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-3 rounded-b-lg border-t border-neutral-200 bg-neutral-50 px-6 py-4">
              <button
                type="button"
                onClick={handleApproveUser}
                disabled={!approvalOrganizationId}
                className="flex-1 btn-primary bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                승인
              </button>
              <button
                type="button"
                onClick={handleCancelApproval}
                className="flex-1 btn-ghost"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">등록된 사용자</h3>
        {profiles.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
            <p>등록된 사용자가 없습니다.</p>
            <p className="mt-2 text-xs text-neutral-400">
              초대를 보내 새 사용자를 추가해 주세요.
            </p>
          </div>
        ) : (
          profiles.map((profile) => (
            <div
              key={profile.id}
              className="flex items-center gap-3 rounded-lg border border-neutral-200 px-3 py-2 text-xs"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {profile.name ?? "이름 없음"}
                </p>
                <p className="text-xs text-neutral-500">{profile.email}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* 최고 관리자는 부서를 변경할 수 있음 */}
                {currentUserRole === "admin" ? (
                  <select
                    className="form-select h-[38px] min-w-[120px]"
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
                  <span className="text-xs text-neutral-400 min-w-[120px]">
                    {profile.department ?? "부서 미등록"}
                  </span>
                )}
                <select
                  className="form-select h-10 min-w-[120px]"
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
                    // 부서 관리자는 관리자 역할을 변경할 수 없음
                    (currentUserRole === "manager" && profile.role === "admin")
                  }
                >
                  <option value="admin">관리자</option>
                  <option value="manager">부서 관리자</option>
                  <option value="user">일반 사용자</option>
                </select>
                {/* 삭제 버튼 (관리자만, 자기 자신 제외) */}
                {currentUserRole === "admin" && profile.id !== currentUserId && (
                  <button
                    type="button"
                    onClick={() => deleteUser(profile.id, profile.name || "이름 없음")}
                    disabled={deletingUserId === profile.id || loading}
                    className="h-[38px] w-[38px] flex items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-600 transition-all hover:bg-rose-50 hover:border-rose-300 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    title="사용자 삭제"
                  >
                    {deletingUserId === profile.id ? (
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 성공 토스트 모달 */}
      {successToast && (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4">
          <div className="rounded-lg bg-emerald-500 text-white px-4 py-3 shadow-lg flex items-center gap-2 min-w-[200px]">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium">{successToast}</span>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="rounded-t-lg bg-rose-600 px-6 py-4">
              <h3 className="text-lg font-semibold text-white">사용자 삭제 확인</h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
                <p className="text-sm text-rose-900 font-medium mb-2">
                  정말로 "{userToDelete.name}" 사용자를 삭제하시겠습니까?
                </p>
                <p className="text-xs text-rose-700">
                  이 작업은 되돌릴 수 없습니다. 사용자의 모든 데이터가 삭제됩니다.
                </p>
              </div>
            </div>
            <div className="flex gap-3 rounded-b-lg border-t border-neutral-200 bg-neutral-50 px-6 py-4">
              <button
                type="button"
                onClick={confirmDeleteUser}
                className="flex-1 btn-primary bg-rose-600 hover:bg-rose-700"
              >
                삭제
              </button>
              <button
                type="button"
                onClick={cancelDeleteUser}
                className="flex-1 btn-ghost"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 초대 링크 모달 */}
      {showInviteLinkModal && generatedInviteLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="rounded-t-lg bg-emerald-600 px-6 py-4">
              <h3 className="text-lg font-semibold text-white">초대 링크 생성 완료</h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-sm text-emerald-700 mb-2">
                  초대 링크가 생성되었습니다. 아래 링크를 복사하여 공유하세요.
                </p>
                <div className="flex items-center gap-2 mt-3">
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
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-emerald-600 text-white hover:bg-emerald-700 whitespace-nowrap"
                  >
                    {inviteLinkCopied ? "복사됨!" : "복사"}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-3 rounded-b-lg border-t border-neutral-200 bg-neutral-50 px-6 py-4">
              <button
                type="button"
                onClick={async () => {
                  setShowInviteLinkModal(false);
                  setGeneratedInviteLink(null);
                  await load();
                }}
                className="flex-1 btn-primary"
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

const INVITE_EXPIRES_DAYS = 7;

const getExpiresAt = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  date.setDate(date.getDate() + INVITE_EXPIRES_DAYS);
  return date.toISOString();
};

const isInviteExpired = (value: string) => {
  const expiresAt = new Date(getExpiresAt(value));
  if (Number.isNaN(expiresAt.getTime())) {
    return false;
  }
  return expiresAt.getTime() < Date.now();
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
