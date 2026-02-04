"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const ownerScopes = [
  { value: "department", label: "부서 소유" },
  { value: "organization", label: "기관 공용" },
];

type SpaceFormProps = {
  space?: {
    id: string;
    short_id: string | null;
    name: string;
    image_url: string | null;
    image_urls: string[] | null;
    category: string | null;
    owner_scope: "organization" | "department";
    owner_department: string;
    managed_by_department: string | null;
    location: string | null;
    capacity: number | null;
    note: string | null;
  };
};

export default function SpaceForm({ space }: SpaceFormProps = {}) {
  const router = useRouter();
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null); // 파일 입력 ref
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [ownerDepartment, setOwnerDepartment] = useState("");
  const [ownerScope, setOwnerScope] = useState<"department" | "organization">(
    "organization" // 공간은 기본적으로 기관 소유
  );
  const [managedByDepartment, setManagedByDepartment] = useState("");
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<"admin" | "manager" | "user">("user");
  const [canRegisterOrganizationWide, setCanRegisterOrganizationWide] = useState(false);
  const [departments, setDepartments] = useState<string[]>([]);
  const [spacesOwnershipPolicy, setSpacesOwnershipPolicy] = useState<"organization_only" | "department_allowed">("organization_only");

  const previews = useMemo(() => previewUrls, [previewUrls]);
  const isEditMode = Boolean(space);

  // Load existing space data in edit mode
  useEffect(() => {
    if (!space) return;

    setOwnerScope(space.owner_scope);
    setOwnerDepartment(space.owner_department);
    setManagedByDepartment(space.managed_by_department || "");
    
    // Load existing images
    const existingImages = space.image_urls && space.image_urls.length > 0
      ? space.image_urls
      : space.image_url
      ? [space.image_url]
      : [];
    
    setPreviewUrls(existingImages);
  }, [space]);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user ?? null;

      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("department,organization_id,role")
        .eq("id", user.id)
        .maybeSingle();

      if (!isMounted) return;

      setCurrentUserId(user.id);
      const role = (data?.role as "admin" | "manager" | "user") ?? "user";
      setUserRole(role);
      
      // 관리자 또는 매니저는 공간 등록 가능
      const isAdmin = role === "admin";
      const isManager = role === "manager";
      setCanRegisterOrganizationWide(isAdmin || isManager);
      
      // 부서 정보 설정
      if (data?.department) {
        setOwnerDepartment(data.department);
        setManagedByDepartment(data.department);
      }

      setOrganizationId(data?.organization_id ?? null);
      
      // 기관의 소유 정책 로드
      if (data?.organization_id) {
        const { data: orgData, error: orgError } = await supabase
          .from("organizations")
          .select("ownership_policies")
          .eq("id", data.organization_id)
          .maybeSingle();
        
        if (orgError) {
          console.error("Failed to load organization policies:", orgError);
          // 기본값 사용
          setSpacesOwnershipPolicy("organization_only");
          setOwnerScope("organization");
        } else {
          const policy = orgData?.ownership_policies?.spaces ?? "organization_only";
          setSpacesOwnershipPolicy(policy);
          
          // 정책에 따라 기본 소유 범위 설정
          if (policy === "organization_only") {
            setOwnerScope("organization");
          } else {
            // department_allowed인 경우, 일반 사용자는 자신의 부서로
            if (!isAdmin) {
              setOwnerScope("department");
            }
          }
        }
      }
      
      // 부서 목록 로드 (관리 부서 선택용)
      const { data: profileData } = await supabase
        .from("profiles")
        .select("department")
        .eq("organization_id", data?.organization_id ?? null)
        .not("department", "is", null);
      
      const deptList = Array.from(
        new Set(
          (profileData ?? [])
            .map((p) => p.department)
            .filter((d): d is string => Boolean(d))
        )
      ).sort();
      
      setDepartments(deptList);
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation(); // 이벤트 버블링 방지
    
    const files = Array.from(event.target.files || []);
    setMessage(null);

    if (files.length > 0) {
      // 최대 10개까지 제한
      const limitedFiles = files.slice(0, 10);
      setImageFiles(limitedFiles);
      
      // 미리보기 URL 생성
      const urls = limitedFiles.map(file => URL.createObjectURL(file));
      setPreviewUrls(urls);
      
      if (files.length > 10) {
        setMessage("최대 10개까지 이미지를 업로드할 수 있습니다.");
      }
    } else {
      setImageFiles([]);
      setPreviewUrls([]);
    }
    
    // Reset input value to allow selecting the same file again
    const input = event.target;
    setTimeout(() => {
      if (input) {
        input.value = '';
      }
    }, 100);
  };

  const removeImage = (index: number) => {
    const newFiles = imageFiles.filter((_, i) => i !== index);
    const newUrls = previewUrls.filter((_, i) => i !== index);
    
    // 이전 URL 해제
    URL.revokeObjectURL(previewUrls[index]);
    
    setImageFiles(newFiles);
    setPreviewUrls(newUrls);
  };

  // 클립보드 붙여넣기 핸들러
  const handlePaste = async (event: React.ClipboardEvent) => {
    const items = event.clipboardData.items;
    const imageFiles: File[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          imageFiles.push(file);
        }
      }
    }

    if (imageFiles.length > 0) {
      event.preventDefault();
      const limitedFiles = imageFiles.slice(0, 10);
      setImageFiles(prev => {
        const combined = [...prev, ...limitedFiles];
        return combined.slice(0, 10);
      });
      
      // 미리보기 URL 생성
      const urls = limitedFiles.map(file => URL.createObjectURL(file));
      setPreviewUrls(prev => [...prev, ...urls]);
      
      if (imageFiles.length > 10) {
        setMessage("최대 10개까지 이미지를 업로드할 수 있습니다.");
      }
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    const form = event.currentTarget;
    if (!form) return;

    const formData = new FormData(form);
    const name = formData.get("name")?.toString().trim();
    
    // 기관 정책에 따라 소유 범위 결정
    const ownerScopeInput = spacesOwnershipPolicy === "organization_only"
      ? "organization"
      : (canRegisterOrganizationWide
          ? (formData.get("owner_scope")?.toString() ?? "department")
          : "department");
    
    const ownerDepartmentInput = ownerScopeInput === "organization"
      ? "기관 공용"
      : ownerDepartment;
    
    const managedByDepartmentInput = formData.get("managed_by_department")?.toString().trim() || null;

    if (!organizationId) {
      setMessage("기관 설정이 필요합니다. 기관 설정에서 생성해주세요.");
      return;
    }

    if (!name) {
      setMessage("공간명을 입력해주세요.");
      return;
    }
    
    // 공간 등록 권한 확인 (관리자 또는 매니저)
    if (userRole !== "admin" && userRole !== "manager") {
      setMessage("공간 등록은 관리자 또는 부서 관리자만 가능합니다.");
      return;
    }
    
    // 부서 소유가 허용되지 않으면 기관 소유로 강제
    if (spacesOwnershipPolicy === "organization_only" && ownerScopeInput === "department") {
      setMessage("공간은 기관 소유만 가능합니다.");
      return;
    }

    // 이미지는 선택사항 (등록/수정 모두)

    setIsSubmitting(true);

    try {
      // 여러 이미지 업로드
      const uploadedUrls: string[] = [];
      
      for (const imageFile of imageFiles) {
        const fileExt = imageFile.name.split(".").pop() ?? "jpg";
        const filePath = `spaces/${Date.now()}-${crypto.randomUUID()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("asset-images")
          .upload(filePath, imageFile);

        if (uploadError) {
          throw uploadError;
        }

        const { data: urlData } = supabase.storage
          .from("asset-images")
          .getPublicUrl(filePath);
        
        if (urlData?.publicUrl) {
          uploadedUrls.push(urlData.publicUrl);
        }
      }

      // 기존 이미지와 새로 업로드한 이미지 합치기
      const existingImageUrls = space?.image_urls && space.image_urls.length > 0
        ? space.image_urls
        : space?.image_url
        ? [space.image_url]
        : [];
      
      // 새로 업로드한 이미지가 있으면 추가, 없으면 기존 이미지 사용
      const finalImageUrls = uploadedUrls.length > 0 ? uploadedUrls : existingImageUrls;
      const imageUrl = finalImageUrls[0] || null;
      const imageUrls = finalImageUrls;

      if (isEditMode && space) {
        // 수정 모드: UPDATE
        const { error: updateError } = await supabase
          .from("spaces")
          .update({
            name,
            image_url: imageUrl,
            image_urls: imageUrls,
            category: formData.get("category")?.toString() || null,
            owner_scope: ownerScopeInput,
            owner_department: ownerDepartmentInput,
            managed_by_department: managedByDepartmentInput,
            location: formData.get("location")?.toString() || null,
            capacity: Number(formData.get("capacity")?.toString() || 0) || null,
            note: formData.get("note")?.toString() || null,
          })
          .eq("id", space.id);

        if (updateError) {
          throw updateError;
        }

        if (currentUserId && organizationId) {
          await supabase.from("audit_logs").insert({
            organization_id: organizationId,
            actor_id: currentUserId,
            action: "space_update",
            target_type: "space",
            target_id: space.id,
            metadata: {
              name,
              owner_scope: ownerScopeInput,
              owner_department: ownerDepartmentInput,
              managed_by_department: managedByDepartmentInput,
            },
          });
        }

        setMessage("공간이 수정되었습니다.");
        // 수정 후 상세 페이지로 이동
        setTimeout(() => {
          window.location.href = `/spaces/${space.short_id || space.id}`;
        }, 1000);
      } else {
        // 등록 모드: INSERT
        const { data: createdSpace, error: insertError } = await supabase
          .from("spaces")
          .insert({
            organization_id: organizationId,
            name,
            image_url: imageUrl,
            image_urls: imageUrls,
            category: formData.get("category")?.toString() || null,
            owner_scope: ownerScopeInput,
            owner_department: ownerDepartmentInput,
            managed_by_department: managedByDepartmentInput,
            location: formData.get("location")?.toString() || null,
            capacity: Number(formData.get("capacity")?.toString() || 0) || null,
            note: formData.get("note")?.toString() || null,
          })
          .select("id")
          .maybeSingle();

        if (insertError) {
          throw insertError;
        }

        if (currentUserId && organizationId && createdSpace?.id) {
          await supabase.from("audit_logs").insert({
            organization_id: organizationId,
            actor_id: currentUserId,
            action: "space_create",
            target_type: "space",
            target_id: createdSpace.id,
            metadata: {
              name,
              owner_scope: ownerScopeInput,
              owner_department: ownerDepartmentInput,
              managed_by_department: managedByDepartmentInput,
            },
          });
        }

        if (form) {
          form.reset();
        }
        
        // 모든 미리보기 URL 해제
        previewUrls.forEach(url => URL.revokeObjectURL(url));
        
        setImageFiles([]);
        setPreviewUrls([]);
        setMessage("공간이 등록되었습니다.");
        
        // 등록 후 자원 관리 페이지로 이동
        setTimeout(() => {
          window.location.replace("/spaces/manage");
        }, 1000);
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "등록 중 오류가 발생했습니다."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form-section">
      {!organizationId && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          기관 설정이 필요합니다.{" "}
          <Link href="/settings/org" className="underline font-medium">
            기관 설정
          </Link>
          으로 이동해 생성해주세요.
        </div>
      )}

      <div className="space-y-4">
        <label className="flex flex-col gap-2">
          <span className="form-label">
            사진 <span className="form-label-optional">(최대 10개)</span>
          </span>
          <div
            className="image-upload-area"
            onClick={(e) => {
              // 파일 입력 자체를 클릭한 경우는 무시
              if ((e.target as HTMLElement).tagName === 'INPUT') {
                return;
              }
              fileInputRef.current?.click();
            }}
            onPaste={handlePaste}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
          >
            {previews.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {previews.map((preview, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={preview}
                      alt={`미리보기 ${index + 1}`}
                      className="w-full aspect-[4/3] object-cover rounded-lg border border-neutral-200"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-rose-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="이미지 삭제"
                    >
                      ×
                    </button>
                    <div className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-2 py-0.5 rounded">
                      {index + 1}/{previews.length}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="image-upload-placeholder">
                사진을 등록해주세요. (선택사항, 여러 장 선택 가능)
              </div>
            )}
            <input
              ref={fileInputRef}
              name="image"
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              onChange={handleFileChange}
              onClick={(e) => e.stopPropagation()} // 클릭 이벤트 전파 방지
              className="image-upload-input"
            />
          </div>
          <p className="text-xs text-neutral-500">
            여러 장의 사진을 선택할 수 있습니다. 공간의 다양한 모습을 등록해주세요.
            <br />
            모바일: 카메라로 직접 촬영 가능 | PC: 이미지 복사 후 붙여넣기(Ctrl+V) 가능
          </p>
        </label>
      </div>

      <div className="form-grid">
        <label className="flex flex-col gap-2 md:col-span-2">
          <span className="form-label">공간명</span>
          <input
            name="name"
            className="form-input"
            placeholder="예: 본당, 비전홀"
            required
          />
        </label>
        {spacesOwnershipPolicy === "organization_only" ? (
          <div className="flex flex-col gap-2 md:col-span-2">
            <span className="form-label">소유 범위</span>
            <div className="h-12 rounded-lg border border-neutral-200 bg-neutral-50 px-4 text-sm text-neutral-600 flex items-center">
              기관 공용
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              공간은 전체 기관 소유입니다.
            </p>
          </div>
        ) : (
          canRegisterOrganizationWide && (
            <label className="flex flex-col gap-2">
              <span className="form-label">소유 범위</span>
              <select
                name="owner_scope"
                className="form-select"
                value={ownerScope}
                onChange={(event) =>
                  setOwnerScope(event.target.value as "department" | "organization")
                }
              >
                {ownerScopes.map((scope) => (
                  <option key={scope.value} value={scope.value}>
                    {scope.label}
                  </option>
                ))}
              </select>
            </label>
          )
        )}
        {spacesOwnershipPolicy === "department_allowed" && ownerScope === "department" && canRegisterOrganizationWide && (
          <label className="flex flex-col gap-2">
            <span className="form-label">소유 부서</span>
            <input
              name="owner_department"
              className="form-input"
              placeholder="예: 유년부"
              value={ownerDepartment}
              onChange={(event) => setOwnerDepartment(event.target.value)}
            />
          </label>
        )}
        {spacesOwnershipPolicy === "department_allowed" && !canRegisterOrganizationWide && (
          <div className="flex flex-col gap-2 md:col-span-2">
            <span className="form-label">소유 부서</span>
            <div className="h-12 rounded-lg border border-neutral-200 bg-neutral-50 px-4 text-sm text-neutral-600 flex items-center">
              {ownerDepartment || "부서 미설정"}
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              자신의 소속 부서 공간으로 자동 등록됩니다.
            </p>
          </div>
        )}
        <label className="flex flex-col gap-2">
          <span className="form-label">
            관리 부서
            <span className="form-label-optional">(선택)</span>
          </span>
          <input
            name="managed_by_department"
            className="form-input"
            placeholder="예: 유년부"
            list="department-options"
            value={managedByDepartment}
            onChange={(event) => setManagedByDepartment(event.target.value)}
          />
          <datalist id="department-options">
            {departments.map((dept) => (
              <option key={dept} value={dept} />
            ))}
          </datalist>
          <p className="text-xs text-neutral-500 mt-1">
            정기적으로 사용하고 관리하는 부서를 선택하세요.
          </p>
        </label>
        <label className="flex flex-col gap-2">
          <span className="form-label">수용 인원</span>
          <input
            name="capacity"
            defaultValue={space?.capacity || ""}
            type="number"
            min={0}
            className="form-input"
            placeholder="예: 30"
          />
        </label>
        <label className="flex flex-col gap-2 md:col-span-2">
          <span className="form-label">위치</span>
          <input
            name="location"
            defaultValue={space?.location || ""}
            className="form-input"
            placeholder="예: 교육관 2층"
          />
        </label>
        <label className="flex flex-col gap-2 md:col-span-2">
          <span className="form-label">비고</span>
          <textarea
            name="note"
            defaultValue={space?.note || ""}
            className="form-textarea"
            placeholder="예약 시 유의사항"
          />
        </label>
      </div>

      {message && (
        <div className={`rounded-lg px-4 py-3 text-sm ${
          message.includes("오류") || message.includes("실패")
            ? "bg-rose-50 text-rose-700 border border-rose-200"
            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
        }`} role="status">
          {message}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting || !organizationId}
        className="btn-primary w-full"
      >
        {isSubmitting ? (isEditMode ? "수정 중..." : "등록 중...") : (isEditMode ? "공간 수정" : "공간 등록")}
      </button>
    </form>
  );
}
