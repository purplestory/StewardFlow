"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { generateShortId } from "@/lib/short-id";

const vehicleTypes = [
  { value: "sedan", label: "승용차" },
  { value: "suv", label: "SUV" },
  { value: "van", label: "승합차" },
  { value: "truck", label: "트럭" },
  { value: "bus", label: "버스" },
  { value: "etc", label: "기타" },
];

const fuelTypes = [
  { value: "gasoline", label: "가솔린" },
  { value: "diesel", label: "디젤" },
  { value: "electric", label: "전기" },
  { value: "hybrid", label: "하이브리드" },
  { value: "lpg", label: "LPG" },
  { value: "etc", label: "기타" },
];

const ownerScopes = [
  { value: "department", label: "부서 소유" },
  { value: "organization", label: "기관 공용" },
];

type VehicleFormProps = {
  vehicle?: {
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
    license_plate: string | null;
    vehicle_type: string | null;
    fuel_type: string | null;
    current_odometer: number | null;
  };
};

export default function VehicleForm({ vehicle }: VehicleFormProps = {}) {
  const router = useRouter();
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]); // 기존에 업로드된 이미지 URL들
  const existingImageUrlsRef = useRef<string[]>([]); // 클로저 문제 해결을 위한 ref
  const fileInputRef = useRef<HTMLInputElement>(null); // 파일 입력 ref
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [ownerDepartment, setOwnerDepartment] = useState("");
  const [ownerScope, setOwnerScope] = useState<"department" | "organization">(
    "organization" // 차량은 기본적으로 기관 소유
  );
  const [managedByDepartment, setManagedByDepartment] = useState("");
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<"admin" | "manager" | "user">("user");
  const [canRegisterOrganizationWide, setCanRegisterOrganizationWide] = useState(false);
  const [departments, setDepartments] = useState<string[]>([]);
  const [vehiclesOwnershipPolicy, setVehiclesOwnershipPolicy] = useState<"organization_only" | "department_allowed">("organization_only");

  const previews = useMemo(() => previewUrls, [previewUrls]);
  const isEditMode = Boolean(vehicle);

  // Load existing vehicle data in edit mode
  useEffect(() => {
    if (!vehicle) return;

    setOwnerScope(vehicle.owner_scope);
    setOwnerDepartment(vehicle.owner_department);
    setManagedByDepartment(vehicle.managed_by_department || "");
    
    // Load existing images
    const existingImages = vehicle.image_urls && vehicle.image_urls.length > 0
      ? vehicle.image_urls
      : vehicle.image_url
      ? [vehicle.image_url]
      : [];
    
    setExistingImageUrls(existingImages);
    existingImageUrlsRef.current = existingImages;
    setPreviewUrls(existingImages);
  }, [vehicle]);

  // imageFiles가 변경될 때 previewUrls 업데이트 (cleanup용)
  useEffect(() => {
    return () => {
      // 컴포넌트 언마운트 시 모든 blob URL 해제
      previewUrls.forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [previewUrls]);

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
      
      // 관리자 또는 매니저는 차량 등록 가능
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
        const { data: orgData } = await supabase
          .from("organizations")
          .select("ownership_policies")
          .eq("id", data.organization_id)
          .maybeSingle();
        
        const policy = orgData?.ownership_policies?.vehicles ?? "organization_only";
        setVehiclesOwnershipPolicy(policy);
        
        // 정책에 따라 기본 소유 범위 설정
        if (policy === "organization_only") {
          setOwnerScope("organization");
        } else {
          // department_allowed인 경우, 일반 사용자는 자신의 부서로
          if (!isAdmin && !isManager) {
            setOwnerScope("department");
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

    console.log("handleFileChange called with", files.length, "files");

    if (files.length > 0) {
      addImageFiles(files);
    } else {
      console.log("No files selected");
    }
    
    // Reset input value to allow selecting the same file again
    const input = event.target;
    setTimeout(() => {
      if (input) {
        input.value = '';
      }
    }, 100);
  };

  const addImageFiles = (files: File[]) => {
    setMessage(null);

    if (files.length > 0) {
      // 이미지 파일만 필터링
      const newImageFiles = files.filter(file => file.type.startsWith('image/'));
      
      if (newImageFiles.length === 0) {
        setMessage("이미지 파일만 업로드할 수 있습니다.");
        return;
      }

      console.log(`Adding ${newImageFiles.length} image files`);

      // 현재 existingImageUrls 값을 ref에서 가져오기
      const currentExisting = existingImageUrlsRef.current;
      
      // imageFiles 업데이트
      setImageFiles(prev => {
        const combined = [...prev, ...newImageFiles];
        const maxNewFiles = Math.max(0, 10 - currentExisting.length);
        const limited = combined.slice(0, maxNewFiles);
        
        if (combined.length + currentExisting.length > 10) {
          setMessage("최대 10개까지 이미지를 업로드할 수 있습니다.");
        }
        
        // 미리보기 URL도 즉시 업데이트
        const newPreviewUrls = limited.map(file => {
          const url = URL.createObjectURL(file);
          console.log(`Created preview URL for ${file.name}: ${url}`);
          return url;
        });
        
        // 기존 이미지 URL과 새 미리보기 URL 합치기
        setPreviewUrls([...currentExisting, ...newPreviewUrls]);
        
        console.log(`Total image files: ${limited.length}, Existing: ${currentExisting.length}, New previews: ${newPreviewUrls.length}`);
        return limited;
      });
    }
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
      addImageFiles(imageFiles);
    }
  };

  const removeImage = (index: number) => {
    const currentExisting = existingImageUrlsRef.current;
    const existingCount = currentExisting.length;
    
    if (index < existingCount) {
      // 기존 이미지 삭제
      const newExistingUrls = currentExisting.filter((_, i) => i !== index);
      setExistingImageUrls(newExistingUrls);
      existingImageUrlsRef.current = newExistingUrls;
      setPreviewUrls(prev => prev.filter((_, i) => i !== index));
    } else {
      // 새 이미지 삭제 (blob URL 해제 필요)
      setImageFiles(currentFiles => {
        const fileIndex = index - existingCount;
        const newFiles = currentFiles.filter((_, i) => i !== fileIndex);
        
        // 해당 blob URL 해제 및 새 미리보기 URL 재생성
        setPreviewUrls(prevUrls => {
          const blobUrlIndex = existingCount + fileIndex;
          if (prevUrls[blobUrlIndex]?.startsWith('blob:')) {
            URL.revokeObjectURL(prevUrls[blobUrlIndex]);
          }
          
          // 새 미리보기 URL 재생성
          const newPreviewUrls = newFiles.map(file => URL.createObjectURL(file));
          return [...currentExisting, ...newPreviewUrls];
        });
        
        return newFiles;
      });
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
    const ownerScopeInput = vehiclesOwnershipPolicy === "organization_only"
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
      setMessage("차량명을 입력해주세요.");
      return;
    }
    
    // 차량 등록 권한 확인 (관리자 또는 매니저)
    if (userRole !== "admin" && userRole !== "manager") {
      setMessage("차량 등록은 관리자 또는 부서 관리자만 가능합니다.");
      return;
    }
    
    // 부서 소유가 허용되지 않으면 기관 소유로 강제
    if (vehiclesOwnershipPolicy === "organization_only" && ownerScopeInput === "department") {
      setMessage("차량은 기관 소유만 가능합니다.");
      return;
    }

    // 이미지는 선택사항 (등록/수정 모두)

    setIsSubmitting(true);

    try {
      // 여러 이미지 업로드
      const uploadedUrls: string[] = [];
      
      for (const imageFile of imageFiles) {
        const fileExt = imageFile.name.split(".").pop() ?? "jpg";
        const filePath = `vehicles/${Date.now()}-${crypto.randomUUID()}.${fileExt}`;

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
      const finalImageUrls = [...existingImageUrls, ...uploadedUrls];
      const imageUrl = finalImageUrls[0] || null;
      const imageUrls = finalImageUrls;

      if (isEditMode && vehicle) {
        // 수정 모드: UPDATE
        const { error: updateError } = await supabase
          .from("vehicles")
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
            license_plate: formData.get("license_plate")?.toString() || null,
            vehicle_type: formData.get("vehicle_type")?.toString() || null,
            fuel_type: formData.get("fuel_type")?.toString() || null,
            current_odometer: formData.get("current_odometer")?.toString() 
              ? Number(formData.get("current_odometer")!.toString()) 
              : null,
          })
          .eq("id", vehicle.id);

        if (updateError) {
          throw updateError;
        }

        if (currentUserId && organizationId) {
          await supabase.from("audit_logs").insert({
            organization_id: organizationId,
            actor_id: currentUserId,
            action: "vehicle_update",
            target_type: "vehicle",
            target_id: vehicle.id,
            metadata: {
              name,
              owner_scope: ownerScopeInput,
              owner_department: ownerDepartmentInput,
              managed_by_department: managedByDepartmentInput,
            },
          });
        }

        setMessage("차량이 수정되었습니다.");
        // 수정 후 상세 페이지로 이동
        setTimeout(() => {
          window.location.href = `/vehicles/${vehicle.short_id || vehicle.id}`;
        }, 1000);
      } else {
        // 등록 모드: INSERT
        const shortId = generateShortId(8);
        
        const { data: createdVehicle, error: insertError } = await supabase
          .from("vehicles")
          .insert({
            organization_id: organizationId,
            short_id: shortId,
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
            license_plate: formData.get("license_plate")?.toString() || null,
            vehicle_type: formData.get("vehicle_type")?.toString() || null,
            fuel_type: formData.get("fuel_type")?.toString() || null,
            current_odometer: formData.get("current_odometer")?.toString() 
              ? Number(formData.get("current_odometer")!.toString()) 
              : null,
          })
          .select("id")
          .maybeSingle();

        if (insertError) {
          throw insertError;
        }

        if (currentUserId && organizationId && createdVehicle?.id) {
          await supabase.from("audit_logs").insert({
            organization_id: organizationId,
            actor_id: currentUserId,
            action: "vehicle_create",
            target_type: "vehicle",
            target_id: createdVehicle.id,
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
        
        // Blob URL만 해제
        previewUrls.forEach(url => {
          if (url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
          }
        });
        
        setImageFiles([]);
        setPreviewUrls([]);
        setExistingImageUrls([]);
        existingImageUrlsRef.current = [];
        setMessage("차량이 등록되었습니다.");
        
        // 등록 후 자원 관리 페이지로 이동
        setTimeout(() => {
          window.location.replace("/vehicles/manage");
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
            여러 장의 사진을 선택할 수 있습니다. 차량의 다양한 모습을 등록해주세요.
            <br />
            모바일: 카메라로 직접 촬영 가능 | PC: 이미지 복사 후 붙여넣기(Ctrl+V) 가능
          </p>
        </label>
      </div>

      <div className="form-grid">
        <label className="flex flex-col gap-2 md:col-span-2">
          <span className="form-label">차량명</span>
          <input
            name="name"
            className="form-input"
            placeholder="예: 교회 차량 1호"
            defaultValue={vehicle?.name || ""}
            required
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="form-label">차량 번호판</span>
          <input
            name="license_plate"
            className="form-input"
            placeholder="예: 12가3456"
            defaultValue={vehicle?.license_plate || ""}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="form-label">차종</span>
          <select
            name="vehicle_type"
            className="form-select"
            defaultValue={vehicle?.vehicle_type || ""}
          >
            <option value="">선택</option>
            {vehicleTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="form-label">연료 타입</span>
          <select
            name="fuel_type"
            className="form-select"
            defaultValue={vehicle?.fuel_type || ""}
          >
            <option value="">선택</option>
            {fuelTypes.map((fuel) => (
              <option key={fuel.value} value={fuel.value}>
                {fuel.label}
              </option>
            ))}
          </select>
        </label>
        {vehiclesOwnershipPolicy === "organization_only" ? (
          <div className="flex flex-col gap-2 md:col-span-2">
            <span className="form-label">소유 범위</span>
            <div className="h-12 rounded-lg border border-neutral-200 bg-neutral-50 px-4 text-sm text-neutral-600 flex items-center">
              기관 공용
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              차량은 전체 기관 소유입니다.
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
        {vehiclesOwnershipPolicy === "department_allowed" && ownerScope === "department" && canRegisterOrganizationWide && (
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
        {vehiclesOwnershipPolicy === "department_allowed" && !canRegisterOrganizationWide && (
          <div className="flex flex-col gap-2 md:col-span-2">
            <span className="form-label">소유 부서</span>
            <div className="h-12 rounded-lg border border-neutral-200 bg-neutral-50 px-4 text-sm text-neutral-600 flex items-center">
              {ownerDepartment || "부서 미설정"}
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              자신의 소속 부서 차량으로 자동 등록됩니다.
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
          <span className="form-label">탑승 인원</span>
          <input
            name="capacity"
            type="number"
            min={0}
            className="form-input"
            placeholder="예: 7"
            defaultValue={vehicle?.capacity || ""}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="form-label">현재 주행거리 (km)</span>
          <input
            name="current_odometer"
            type="number"
            min={0}
            className="form-input"
            placeholder="예: 50000"
            defaultValue={vehicle?.current_odometer || ""}
          />
          <p className="text-xs text-neutral-500 mt-1">
            차량 등록 시점의 주행거리를 입력하세요.
          </p>
        </label>
        <label className="flex flex-col gap-2 md:col-span-2">
          <span className="form-label">주차 장소</span>
          <input
            name="location"
            className="form-input"
            placeholder="예: 교회 주차장"
            defaultValue={vehicle?.location || ""}
          />
        </label>
        <label className="flex flex-col gap-2 md:col-span-2">
          <span className="form-label">비고</span>
          <textarea
            name="note"
            className="form-textarea"
            placeholder="예약 시 유의사항"
            defaultValue={vehicle?.note || ""}
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
        {isSubmitting ? (isEditMode ? "수정 중..." : "등록 중...") : (isEditMode ? "차량 수정" : "차량 등록")}
      </button>
    </form>
  );
}
