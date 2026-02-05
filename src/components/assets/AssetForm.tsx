"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { generateShortId } from "@/lib/short-id";
import { isUUID } from "@/lib/short-id";

// Categories will be loaded dynamically from organization settings

const ownerScopes = [
  { value: "department", label: "부서 소유" },
  { value: "organization", label: "기관 공용" },
];

type AssetFormProps = {
  asset?: {
    id: string;
    short_id: string | null;
    name: string;
    model_name: string | null;
    image_url: string | null;
    image_urls: string[] | null;
    category: string | null;
    owner_scope: "organization" | "department";
    owner_department: string;
    managed_by_department: string | null;
    location: string | null;
    quantity: number;
    shopping_link: string | null;
    purchase_date: string | null;
    purchase_price: number | null;
    useful_life_years: number | null;
    mobility: "fixed" | "movable" | null;
    loanable: boolean | null;
    usable_until: string | null;
    tags: string[] | null;
  };
};

export default function AssetForm({ asset }: AssetFormProps = {}) {
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]); // 기존에 업로드된 이미지 URL들
  const existingImageUrlsRef = useRef<string[]>([]); // 클로저 문제 해결을 위한 ref
  const blobUrlsRef = useRef<string[]>([]); // 생성된 blob URL 추적용
  const fileInputRef = useRef<HTMLInputElement>(null); // 파일 입력 ref
  const isFileDialogOpenRef = useRef(false); // 파일 다이얼로그 열림 상태 추적
  const [purchasePriceDisplay, setPurchasePriceDisplay] = useState<string>(""); // 구입 금액 표시용 (콤마 포함)
  const [purchaseDate, setPurchaseDate] = useState<string>(""); // 구입일
  const [usefulLifeYears, setUsefulLifeYears] = useState<string>(""); // 사용 수명
  const [usableUntil, setUsableUntil] = useState<string>(""); // 사용 기한
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [ownerDepartment, setOwnerDepartment] = useState("");
  const [managedByDepartment, setManagedByDepartment] = useState("");
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [isLoadingOrg, setIsLoadingOrg] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<"admin" | "manager" | "user">("user");
  const [ownerScope, setOwnerScope] = useState<"department" | "organization">(
    "department"
  );
  const [canRegisterOrganizationWide, setCanRegisterOrganizationWide] = useState(false);
  const [departments, setDepartments] = useState<string[]>([]);
  const [categories, setCategories] = useState<Array<{ value: string; label: string }>>([
    { value: "sound", label: "음향" },
    { value: "video", label: "영상" },
    { value: "kitchen", label: "조리" },
    { value: "furniture", label: "가구" },
    { value: "etc", label: "기타" },
  ]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletionReason, setDeletionReason] = useState("");
  const [deletionReasonOther, setDeletionReasonOther] = useState("");
  const router = useRouter();

  const previews = useMemo(() => previewUrls, [previewUrls]);
  const isEditMode = Boolean(asset);

  // Load existing asset data in edit mode
  useEffect(() => {
    if (!asset) return;

    setOwnerScope(asset.owner_scope);
    setOwnerDepartment(asset.owner_department);
    setManagedByDepartment(asset.managed_by_department || "");
    
    // Load existing images
    const existingImages = asset.image_urls && asset.image_urls.length > 0
      ? asset.image_urls
      : asset.image_url
      ? [asset.image_url]
      : [];
    
    setExistingImageUrls(existingImages);
    existingImageUrlsRef.current = existingImages;
    setPreviewUrls(existingImages);
    
    // 구입 금액 초기값 설정 (콤마 포함)
    if (asset.purchase_price) {
      setPurchasePriceDisplay(asset.purchase_price.toLocaleString("ko-KR"));
    } else {
      setPurchasePriceDisplay("");
    }
    
    // 구입일, 사용 수명, 사용 기한 초기값 설정
    setPurchaseDate(asset.purchase_date || "");
    setUsefulLifeYears(asset.useful_life_years?.toString() || "");
    setUsableUntil(asset.usable_until || "");
  }, [asset]);

  // 사용 수명 변경 시 사용 기한 자동 계산
  useEffect(() => {
    if (purchaseDate && usefulLifeYears) {
      const purchase = new Date(purchaseDate);
      const years = parseInt(usefulLifeYears);
      if (!isNaN(years) && years > 0) {
        const expiry = new Date(purchase);
        expiry.setFullYear(expiry.getFullYear() + years);
        const year = expiry.getFullYear();
        const month = String(expiry.getMonth() + 1).padStart(2, "0");
        const day = String(expiry.getDate()).padStart(2, "0");
        setUsableUntil(`${year}-${month}-${day}`);
      }
    }
  }, [purchaseDate, usefulLifeYears]);

  // Cleanup: 컴포넌트 언마운트 시 모든 blob URL 해제
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach(url => {
        URL.revokeObjectURL(url);
      });
      blobUrlsRef.current = [];
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      setIsLoadingOrg(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user ?? null;

      if (!user) {
        setIsLoadingOrg(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("department,organization_id,role")
        .eq("id", user.id)
        .maybeSingle();

      if (!isMounted) return;

      setCurrentUserId(user.id);
      const role = (data?.role as "admin" | "manager" | "user") ?? "user";
      setUserRole(role);
      
      // 관리자만 전체 기관 물품 등록 가능
      const isAdmin = role === "admin";
      setCanRegisterOrganizationWide(isAdmin);
      
      // 부서 정보 설정 - 수정 모드가 아닐 때만 사용자 부서로 설정
      // 수정 모드에서는 asset의 기존 부서 정보를 유지
      if (!isEditMode && data?.department) {
        setOwnerDepartment(data.department);
      }

      setOrganizationId(data?.organization_id ?? null);
      
      // 일반 사용자는 항상 자신의 부서 물품으로 등록 (수정 모드가 아닐 때만)
      if (!isAdmin && !isEditMode) {
        setOwnerScope("department");
      }
      
      // 카테고리 목록 로드
      if (data?.organization_id) {
        const { data: orgData } = await supabase
          .from("organizations")
          .select("asset_categories")
          .eq("id", data.organization_id)
          .maybeSingle();
        
        if (orgData?.asset_categories) {
          const assetCategories = orgData.asset_categories as Array<{ value: string; label: string }>;
          if (assetCategories.length > 0) {
            setCategories(assetCategories);
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
      
      setIsLoadingOrg(false);
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [isEditMode]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation(); // 이벤트 버블링 방지
    isFileDialogOpenRef.current = false; // 다이얼로그 닫힘 표시
    
    const files = Array.from(event.target.files || []);
    setMessage(null);

    console.log("handleFileChange called with", files.length, "files");
    
    if (files.length > 0) {
      addImageFiles(files);
    } else {
      console.log("No files selected");
    }
    
    // Reset input value to allow selecting the same file again
    // 다음 이벤트 루프에서 리셋하여 중복 트리거 방지
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

      console.log(`[addImageFiles] Adding ${newImageFiles.length} image files:`, newImageFiles.map(f => ({ name: f.name, size: f.size, type: f.type })));

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
        
        console.log(`[addImageFiles] Total image files: ${limited.length}, Existing: ${currentExisting.length}`);
        
        // 미리보기 URL 즉시 생성
        const newPreviewUrls = limited.map(file => {
          const url = URL.createObjectURL(file);
          console.log(`[addImageFiles] Created preview URL for ${file.name}: ${url}`);
          blobUrlsRef.current.push(url);
          return url;
        });
        
        // 기존 이미지 URL과 새 미리보기 URL 합치기
        const allPreviewUrls = [...currentExisting, ...newPreviewUrls];
        console.log(`[addImageFiles] Setting preview URLs: ${allPreviewUrls.length} total`);
        setPreviewUrls(allPreviewUrls);
        
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
    const modelName = formData.get("model_name")?.toString().trim() || null;
    
    // 일반 사용자는 항상 자신의 부서로, 관리자는 선택한 값 사용
    const ownerScopeInput = canRegisterOrganizationWide
      ? (formData.get("owner_scope")?.toString() ?? "department")
      : "department";
    
    const ownerDepartmentInput = ownerScopeInput === "organization"
      ? "기관 공용"
      : ownerDepartment; // 일반 사용자는 자신의 부서 사용
    const managedByDepartmentInput = ownerScopeInput === "organization"
      ? (formData.get("managed_by_department")?.toString().trim() || null)
      : null; // 기관 공용일 때만 관리 부서 설정
    const mobilityInput =
      (formData.get("mobility")?.toString() as "fixed" | "movable") ?? "movable";
    const loanableInput = formData.get("loanable")?.toString() ?? "true";
    const loanableValue = loanableInput === "true";
    const usableUntilValue = usableUntil || formData.get("usable_until")?.toString() || null;
    const purchaseDateValue = purchaseDate || formData.get("purchase_date")?.toString() || null;
    const purchasePriceRaw = formData.get("purchase_price")?.toString().trim();
    const usefulLifeRaw = usefulLifeYears || formData.get("useful_life_years")?.toString().trim();
    const purchasePrice = purchasePriceRaw ? Number(purchasePriceRaw) : null;
    const usefulLifeYearsValue = usefulLifeRaw ? Number(usefulLifeRaw) : null;
    const tagsInput = formData.get("tags")?.toString() ?? "";
    const tags = Array.from(
      new Set(
        tagsInput
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0)
      )
    );

    if (!organizationId) {
      setMessage("기관 설정이 필요합니다. 기관 설정에서 생성해주세요.");
      return;
    }

    if (!name) {
      setMessage("물품명을 입력해주세요.");
      return;
    }
    
    // 일반 사용자는 부서가 필수
    if (ownerScopeInput === "department" && !ownerDepartment) {
      setMessage("소속 부서가 설정되지 않았습니다. 프로필에서 부서를 설정해주세요.");
      return;
    }

    // 이미지는 선택사항 (등록/수정 모두)

    setIsSubmitting(true);

    try {
      // 여러 이미지 업로드
      const uploadedUrls: string[] = [];
      
      console.log(`Starting upload for ${imageFiles.length} files`);
      
      for (const imageFile of imageFiles) {
        const fileExt = imageFile.name.split(".").pop() ?? "jpg";
        const filePath = `assets/${Date.now()}-${crypto.randomUUID()}.${fileExt}`;

        console.log(`Uploading ${imageFile.name} to ${filePath}`);

        const { error: uploadError, data: uploadData } = await supabase.storage
          .from("asset-images")
          .upload(filePath, imageFile);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          throw new Error(`이미지 업로드 실패: ${uploadError.message}`);
        }

        console.log(`Upload successful:`, uploadData);

        const { data: urlData } = supabase.storage
          .from("asset-images")
          .getPublicUrl(filePath);
        
        if (urlData?.publicUrl) {
          console.log(`Public URL: ${urlData.publicUrl}`);
          uploadedUrls.push(urlData.publicUrl);
        } else {
          console.warn(`No public URL for ${filePath}`);
        }
      }
      
      console.log(`Uploaded ${uploadedUrls.length} images`);

      // 기존 이미지와 새로 업로드한 이미지 합치기
      const finalImageUrls = [...existingImageUrls, ...uploadedUrls];
      const imageUrl = finalImageUrls[0] || null;
      const imageUrls = finalImageUrls;

      if (isEditMode && asset) {
        // 수정 모드: UPDATE
        const updateData: Record<string, any> = {
          name,
          image_url: imageUrl,
          category: formData.get("category")?.toString() || null,
          owner_scope: ownerScopeInput,
          owner_department:
            ownerScopeInput === "organization"
              ? "기관 공용"
              : ownerDepartmentInput,
          managed_by_department: managedByDepartmentInput,
          location: formData.get("location")?.toString() || null,
          quantity: Number(formData.get("quantity")?.toString() || 1),
          shopping_link: formData.get("shopping_link")?.toString() || null,
          purchase_date: purchaseDateValue || null,
          purchase_price: Number.isNaN(purchasePrice) ? null : purchasePrice,
          useful_life_years: Number.isNaN(usefulLifeYearsValue)
            ? null
            : usefulLifeYearsValue,
          mobility: mobilityInput,
          loanable: loanableValue,
          usable_until: usableUntilValue || null,
          tags: tags.length > 0 ? tags : [],
        };
        
        // image_urls 컬럼이 있는 경우에만 추가
        // 마이그레이션이 실행되지 않은 경우를 대비
        if (imageUrls.length > 0) {
          updateData.image_urls = imageUrls;
        }
        
        // Only include model_name if it's provided (and column exists)
        if (modelName) {
          updateData.model_name = modelName;
        }

        const { error: updateError } = await supabase
          .from("assets")
          .update(updateData)
          .eq("id", asset.id);

        if (updateError) {
          throw updateError;
        }

        if (currentUserId && organizationId) {
          await supabase.from("audit_logs").insert({
            organization_id: organizationId,
            actor_id: currentUserId,
            action: "asset_update",
            target_type: "asset",
            target_id: asset.id,
            metadata: {
              name,
              owner_scope: ownerScopeInput,
              owner_department:
                ownerScopeInput === "organization"
                  ? "기관 공용"
                  : ownerDepartmentInput,
              managed_by_department: managedByDepartmentInput,
              purchase_date: purchaseDateValue || null,
              purchase_price: Number.isNaN(purchasePrice) ? null : purchasePrice,
              useful_life_years: Number.isNaN(usefulLifeYears)
                ? null
                : usefulLifeYears,
              mobility: mobilityInput,
              loanable: loanableValue,
              usable_until: usableUntilValue || null,
              tags,
            },
          });
        }

        setMessage("물품이 수정되었습니다.");
        // 수정 후 상세 페이지로 이동
        setTimeout(() => {
          window.location.href = `/assets/${asset.short_id || asset.id}`;
        }, 1000);
      } else {
        // 등록 모드: INSERT
        const shortId = generateShortId(8);

        const insertData: Record<string, any> = {
          organization_id: organizationId,
          short_id: shortId,
          name,
          image_url: imageUrl,
          category: formData.get("category")?.toString() || null,
          owner_scope: ownerScopeInput,
          owner_department:
            ownerScopeInput === "organization"
              ? "기관 공용"
              : ownerDepartmentInput,
          managed_by_department: managedByDepartmentInput,
          location: formData.get("location")?.toString() || null,
          quantity: Number(formData.get("quantity")?.toString() || 1),
          shopping_link: formData.get("shopping_link")?.toString() || null,
          purchase_date: purchaseDateValue || null,
          purchase_price: Number.isNaN(purchasePrice) ? null : purchasePrice,
          useful_life_years: Number.isNaN(usefulLifeYearsValue)
            ? null
            : usefulLifeYearsValue,
          mobility: mobilityInput,
          loanable: loanableValue,
          usable_until: usableUntilValue || null,
          tags: tags.length > 0 ? tags : [],
        };
        
        // image_urls 컬럼이 있는 경우에만 추가
        // 마이그레이션이 실행되지 않은 경우를 대비
        if (imageUrls.length > 0) {
          insertData.image_urls = imageUrls;
        }
        
        // Only include model_name if it's provided (and column exists)
        if (modelName) {
          insertData.model_name = modelName;
        }

        const { data: createdAsset, error: insertError } = await supabase
          .from("assets")
          .insert(insertData)
          .select("id,short_id")
          .maybeSingle();

        if (insertError) {
          throw insertError;
        }

        if (currentUserId && organizationId && createdAsset?.id) {
          await supabase.from("audit_logs").insert({
            organization_id: organizationId,
            actor_id: currentUserId,
            action: "asset_create",
            target_type: "asset",
            target_id: createdAsset.id,
            metadata: {
              name,
              owner_scope: ownerScopeInput,
              owner_department:
                ownerScopeInput === "organization"
                  ? "기관 공용"
                  : ownerDepartmentInput,
              managed_by_department: managedByDepartmentInput,
              purchase_date: purchaseDateValue || null,
              purchase_price: Number.isNaN(purchasePrice) ? null : purchasePrice,
              useful_life_years: Number.isNaN(usefulLifeYears)
                ? null
                : usefulLifeYears,
              mobility: mobilityInput,
              loanable: loanableValue,
              usable_until: usableUntilValue || null,
              tags,
            },
          });
        }

        if (form) {
          form.reset();
        }
        
        // 모든 blob URL 해제 (기존 이미지 URL은 해제하지 않음)
        previewUrls.forEach(url => {
          if (url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
          }
        });
        
        setImageFiles([]);
        setPreviewUrls([]);
        setExistingImageUrls([]);
        setMessage("물품이 등록되었습니다.");
        
        // 등록 후 자원 관리 페이지로 이동
        setTimeout(() => {
          window.location.replace("/assets/manage");
        }, 1000);
      }
    } catch (error) {
      console.error("Asset form submit error:", error);
      const errorMessage = error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
        ? String(error.message)
        : "등록 중 오류가 발생했습니다.";
      setMessage(`오류: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form-section">
      {!isLoadingOrg && !organizationId && (
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
              // 이미 다이얼로그가 열려있으면 무시
              if (isFileDialogOpenRef.current) {
                return;
              }
              // input이 존재하고 다이얼로그가 열려있지 않을 때만 클릭
              if (fileInputRef.current && !isFileDialogOpenRef.current) {
                isFileDialogOpenRef.current = true;
                fileInputRef.current.click();
              }
            }}
            onPaste={handlePaste}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (!isFileDialogOpenRef.current && fileInputRef.current) {
                  isFileDialogOpenRef.current = true;
                  fileInputRef.current.click();
                }
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
              onClick={(e) => {
                e.stopPropagation(); // 클릭 이벤트 전파 방지
                // input을 직접 클릭한 경우에도 다이얼로그 열림 상태로 설정
                if (!isFileDialogOpenRef.current) {
                  isFileDialogOpenRef.current = true;
                }
              }}
              onFocus={() => {
                // 포커스가 input에 갈 때 다이얼로그가 열릴 수 있으므로 상태 업데이트
                if (!isFileDialogOpenRef.current) {
                  isFileDialogOpenRef.current = true;
                }
              }}
              className="image-upload-input"
            />
          </div>
          <p className="text-xs text-neutral-500">
            여러 장의 사진을 선택할 수 있습니다. 설치된 모습이나 세부 사진도 등록해주세요.
            <br />
            모바일: 카메라로 직접 촬영 가능 | PC: 이미지 복사 후 붙여넣기(Ctrl+V) 가능
          </p>
        </label>
      </div>

      <div className="form-grid">
        <label className="flex flex-col gap-2">
          <span className="form-label">물품명</span>
          <input
            name="name"
            className="form-input"
            placeholder="예: 무선 마이크 세트"
            defaultValue={asset?.name || ""}
            required
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="form-label">
            모델명
            <span className="form-label-optional">(선택)</span>
          </span>
          <input
            name="model_name"
            type="text"
            className="form-input"
            placeholder="예: SHURE BLX24R/SM58"
            defaultValue={asset?.model_name || ""}
          />
        </label>
        {canRegisterOrganizationWide && (
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
        )}
        {canRegisterOrganizationWide && ownerScope === "department" && (
          <label className="flex flex-col gap-2">
            <span className="form-label">소유 부서</span>
            <select
              name="owner_department"
              className="form-select"
              value={ownerDepartment}
              onChange={(event) => setOwnerDepartment(event.target.value)}
              required
            >
              <option value="">선택하세요</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </label>
        )}
        {canRegisterOrganizationWide && ownerScope === "organization" && (
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
        )}
        {!canRegisterOrganizationWide && (
          <div className="flex flex-col gap-2 md:col-span-2">
            <span className="form-label">소유 부서</span>
            <div className="h-12 rounded-lg border border-neutral-200 bg-neutral-50 px-4 text-sm text-neutral-600 flex items-center">
              {ownerDepartment || "부서 미설정"}
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              자신의 소속 부서 물품으로 자동 등록됩니다.
            </p>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:col-span-2">
          <label className="flex flex-col gap-2">
            <span className="form-label">구입일</span>
            <input
              name="purchase_date"
              type="date"
              className="form-input"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="form-label">구입 금액</span>
            <input
              type="text"
              className="form-input"
              placeholder="예: 350,000"
              value={purchasePriceDisplay}
              onChange={(e) => {
                // 숫자만 추출
                const numericValue = e.target.value.replace(/[^0-9]/g, "");
                // 콤마 추가하여 표시
                if (numericValue === "") {
                  setPurchasePriceDisplay("");
                } else {
                  setPurchasePriceDisplay(Number(numericValue).toLocaleString("ko-KR"));
                }
              }}
            />
            {/* 실제 제출용 hidden input (콤마 제거된 숫자만) */}
            <input
              type="hidden"
              name="purchase_price"
              value={purchasePriceDisplay.replace(/[^0-9]/g, "")}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="form-label">사용 수명</span>
            <input
              name="useful_life_years"
              type="number"
              min={0}
              className="form-input"
              placeholder="예: 5"
              value={usefulLifeYears}
              onChange={(e) => setUsefulLifeYears(e.target.value)}
            />
            <p className="text-xs text-neutral-500 mt-1">예상 사용 연한 (년)</p>
          </label>
          <label className="flex flex-col gap-2">
            <span className="form-label">사용 기한</span>
            <input
              name="usable_until"
              type="date"
              className="form-input"
              value={usableUntil}
              onChange={(e) => setUsableUntil(e.target.value)}
            />
            <p className="text-xs text-neutral-500 mt-1">사용 가능한 최종 날짜 {usefulLifeYears && purchaseDate && "(자동 계산됨)"}</p>
          </label>
        </div>
        <label className="flex flex-col gap-2">
          <span className="form-label">설치 형태</span>
          <select
            name="mobility"
            className="form-select"
            defaultValue={asset?.mobility || "movable"}
          >
            <option value="movable">이동</option>
            <option value="fixed">고정</option>
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="form-label">대여 가능 여부</span>
            <select
              name="loanable"
              className="form-select"
              defaultValue={asset?.loanable === false ? "false" : "true"}
            >
              <option value="true">대여 가능</option>
              <option value="false">대여 불가</option>
            </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="form-label">카테고리</span>
          <select
            name="category"
            className="form-select"
            defaultValue={asset?.category || ""}
          >
            <option value="">선택</option>
            {categories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="form-label">태그</span>
          <input
            name="tags"
            className="form-input"
            placeholder="예: 절기, 행사, 야외 (쉼표로 구분)"
            defaultValue={asset?.tags?.join(", ") || ""}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="form-label">수량</span>
          <input
            name="quantity"
            type="number"
            min={1}
            className="form-input"
            defaultValue={asset?.quantity || 1}
          />
        </label>
        <label className="flex flex-col gap-2 md:col-span-2">
          <span className="form-label">설치(보관) 장소</span>
          <input
            name="location"
            className="form-input"
            placeholder="예: 비전홀 3층 창고"
            defaultValue={asset?.location || ""}
          />
        </label>
        <label className="flex flex-col gap-2 md:col-span-2">
          <span className="form-label">
            구매 링크
            <span className="form-label-optional">(선택)</span>
          </span>
          <input
            name="shopping_link"
            type="url"
            className="form-input"
            placeholder="https://..."
            defaultValue={asset?.shopping_link || ""}
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

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting || !organizationId}
          className="btn-primary flex-1"
        >
          {isSubmitting ? (isEditMode ? "수정 중..." : "등록 중...") : (isEditMode ? "물품 수정" : "물품 등록")}
        </button>
        {isEditMode && asset && (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isSubmitting || isDeleting}
            className="btn-ghost text-sm"
          >
            삭제
          </button>
        )}
      </div>

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            {/* 모달 헤더 */}
            <div className="rounded-t-lg bg-blue-600 px-6 py-4">
              <h3 className="text-lg font-semibold text-white">물품 삭제</h3>
            </div>

            {/* 모달 본문 */}
            <div className="px-6 py-4 space-y-4">
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
                <p className="text-sm text-rose-700">
                  정말 이 물품을 삭제하시겠습니까? 삭제된 물품은 휴지통으로 이동하며, 최고 관리자가 영구 삭제할 수 있습니다.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-900">
                  삭제 사유 <span className="text-rose-500">*</span>
                </label>
                <select
                  value={deletionReason}
                  onChange={(e) => {
                    setDeletionReason(e.target.value);
                    if (e.target.value !== "기타") {
                      setDeletionReasonOther("");
                    }
                  }}
                  className="w-full form-select"
                  autoFocus
                >
                  <option value="">선택하세요</option>
                  <option value="불용품">불용품 (사용 가능한 상태)</option>
                  <option value="잔존 수명 종료">잔존 수명 종료</option>
                  <option value="고장">고장</option>
                  <option value="신제품 등록">신제품 등록</option>
                  <option value="기타">기타</option>
                </select>
              </div>

              {deletionReason === "기타" && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-900">
                    사유 입력 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={deletionReasonOther}
                    onChange={(e) => setDeletionReasonOther(e.target.value)}
                    placeholder="삭제 사유를 입력하세요"
                    className="w-full form-input"
                    autoFocus
                  />
                </div>
              )}

              {message && message.includes("삭제") && (
                <div className={`rounded-lg px-4 py-3 text-sm ${
                  message.includes("오류") || message.includes("실패")
                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                }`}>
                  {message}
                </div>
              )}
            </div>

            {/* 모달 하단 버튼 */}
            <div className="flex gap-3 rounded-b-lg border-t border-neutral-200 bg-neutral-50 px-6 py-4">
              <button
                type="button"
                onClick={async () => {
                  if (!asset) return;
                  if (!deletionReason) {
                    setMessage("삭제 사유를 선택해주세요.");
                    return;
                  }
                  if (deletionReason === "기타" && !deletionReasonOther.trim()) {
                    setMessage("기타 사유를 입력해주세요.");
                    return;
                  }
                  setIsDeleting(true);
                  setMessage(null);
                  try {
                    // 클라이언트에서 직접 삭제 처리
                    const { data: sessionData } = await supabase.auth.getSession();
                    if (!sessionData.session) {
                      throw new Error("인증이 필요합니다. 로그인 후 다시 시도해주세요.");
                    }

                    const user = sessionData.session.user;
                    
                    // 사용자 프로필 확인
                    const { data: profileData, error: profileError } = await supabase
                      .from("profiles")
                      .select("role, organization_id, department")
                      .eq("id", user.id)
                      .maybeSingle();

                    if (profileError || !profileData) {
                      throw new Error("사용자 정보를 가져올 수 없습니다.");
                    }

                    // 자산 정보 확인
                    const assetId = asset.short_id || asset.id;
                    const isUuid = isUUID(assetId);
                    let assetQuery = supabase
                      .from("assets")
                      .select("id, organization_id, owner_scope, owner_department")
                      .is("deleted_at", null);
                    
                    if (isUuid) {
                      assetQuery = assetQuery.eq("id", assetId);
                    } else {
                      assetQuery = assetQuery.eq("short_id", assetId);
                    }
                    
                    const { data: assetData, error: assetError } = await assetQuery.maybeSingle();
                    
                    if (assetError || !assetData) {
                      throw new Error("물품을 찾을 수 없습니다.");
                    }

                    // 권한 확인
                    const isAdmin = profileData.role === "admin";
                    const isManager = profileData.role === "manager" || isAdmin;
                    const isOwner = assetData.owner_scope === "organization" 
                      ? assetData.organization_id === profileData.organization_id
                      : assetData.owner_department === profileData.department;

                    if (!isManager && !isOwner) {
                      throw new Error("삭제 권한이 없습니다.");
                    }

                    // Soft delete 실행
                    const finalReason = deletionReason === "기타" ? deletionReasonOther.trim() : deletionReason;
                    const { error: updateError } = await supabase
                      .from("assets")
                      .update({ 
                        deleted_at: new Date().toISOString(),
                        deletion_reason: finalReason || null
                      })
                      .eq("id", assetData.id);

                    if (updateError) {
                      throw new Error(`삭제 실패: ${updateError.message}`);
                    }

                    setMessage("물품이 삭제되었습니다.");
                    setShowDeleteConfirm(false);
                    setDeletionReason("");
                    setDeletionReasonOther("");
                    setIsDeleting(false);
                    setTimeout(() => {
                      window.location.replace("/assets/manage");
                    }, 1000);
                  } catch (error) {
                    setMessage(`삭제 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
                    setIsDeleting(false);
                  } finally {
                    // 에러가 발생해도 모달은 닫기
                    setShowDeleteConfirm(false);
                  }
                }}
                disabled={isDeleting || !deletionReason || (deletionReason === "기타" && !deletionReasonOther.trim())}
                className="flex-1 btn-primary bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? "삭제 중..." : "삭제"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletionReason("");
                  setDeletionReasonOther("");
                  setMessage(null);
                }}
                disabled={isDeleting}
                className="flex-1 btn-ghost"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
