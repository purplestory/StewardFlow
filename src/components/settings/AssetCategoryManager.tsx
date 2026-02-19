"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Notice from "@/components/common/Notice";
import { generateShortId } from "@/lib/short-id";

type AssetCategory = {
  value: string;
  label: string;
};

type AssetCategoryManagerProps = {
  organizationId: string | null;
};

export default function AssetCategoryManager({
  organizationId,
}: AssetCategoryManagerProps) {
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [newCategoryLabel, setNewCategoryLabel] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingCategoryValue, setEditingCategoryValue] = useState<string | null>(null);
  const [editingCategoryLabel, setEditingCategoryLabel] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [userRole, setUserRole] = useState<"admin" | "manager" | "user">("user");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // 카테고리 코드를 자동 생성하는 함수 (시스템이 고유한 코드 생성)
  const generateCategoryValue = (): string => {
    // nanoid를 사용하여 고유한 카테고리 코드 생성 (8자리)
    return generateShortId(8);
  };

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    const loadCategories = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData.session?.user;
        if (user) {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();
          if (profileData?.role) {
            setUserRole(profileData.role as "admin" | "manager" | "user");
          }
        }

        const { data: orgData, error } = await supabase
          .from("organizations")
          .select("asset_categories")
          .eq("id", organizationId)
          .maybeSingle();

        if (error && (error.message || error.details || error.hint || error.code)) {
          // 에러가 실제로 발생한 경우에만 상세 로그 출력
          // error 객체에 실제 에러 정보가 있을 때만 로그 출력
          console.error("Error loading categories:", {
            message: error.message || null,
            details: error.details || null,
            hint: error.hint || null,
            code: error.code || null,
            organizationId: organizationId || null,
          });
          // 오류가 발생해도 기본 카테고리를 사용하도록 함
          const defaultCategories: AssetCategory[] = [
            { value: "sound", label: "음향" },
            { value: "video", label: "영상" },
            { value: "kitchen", label: "조리" },
            { value: "furniture", label: "가구" },
            { value: "etc", label: "기타" },
          ];
          setCategories(defaultCategories);
          // 오류 메시지는 표시하지 않음 (기본 카테고리 사용)
          setMessage(null);
        } else if (error) {
          // error 객체가 존재하지만 실제 에러 정보가 없는 경우 (빈 객체)
          // 조용히 기본 카테고리를 사용
          const defaultCategories: AssetCategory[] = [
            { value: "sound", label: "음향" },
            { value: "video", label: "영상" },
            { value: "kitchen", label: "조리" },
            { value: "furniture", label: "가구" },
            { value: "etc", label: "기타" },
          ];
          setCategories(defaultCategories);
          setMessage(null);
        } else {
          const assetCategories = (orgData?.asset_categories as AssetCategory[]) || [
            { value: "sound", label: "음향" },
            { value: "video", label: "영상" },
            { value: "kitchen", label: "조리" },
            { value: "furniture", label: "가구" },
            { value: "etc", label: "기타" },
          ];
          setCategories(assetCategories);
          setMessage(null);
        }
      } catch (error) {
        console.error("Error loading categories (exception):", {
          error,
          errorType: typeof error,
          errorMessage: error instanceof Error ? error.message : String(error),
          organizationId,
        });
        // 예외 발생 시에도 기본 카테고리 사용
        const defaultCategories: AssetCategory[] = [
          { value: "sound", label: "음향" },
          { value: "video", label: "영상" },
          { value: "kitchen", label: "조리" },
          { value: "furniture", label: "가구" },
          { value: "etc", label: "기타" },
        ];
        setCategories(defaultCategories);
        // 오류 메시지는 표시하지 않음 (기본 카테고리 사용)
        setMessage(null);
      } finally {
        setLoading(false);
      }
    };

    loadCategories();
  }, [organizationId]);

  const handleAddCategory = async () => {
    if (!organizationId) {
      setMessage("기관 정보가 없습니다.");
      return;
    }

    if (!newCategoryLabel.trim()) {
      setMessage("카테고리명을 입력해주세요.");
      return;
    }

    // 중복 체크 (카테고리명 기준)
    if (categories.some((cat) => cat.label.trim() === newCategoryLabel.trim())) {
      setMessage(`이미 존재하는 카테고리명입니다. (${newCategoryLabel.trim()})`);
      return;
    }

    // 카테고리 코드 자동 생성 (시스템이 고유한 코드 생성)
    let generatedValue = generateCategoryValue();
    
    // 중복되지 않는 고유한 코드가 생성될 때까지 반복 (매우 드문 경우지만 안전장치)
    let attempts = 0;
    while (categories.some((cat) => cat.value === generatedValue) && attempts < 10) {
      generatedValue = generateCategoryValue();
      attempts++;
    }
    
    if (categories.some((cat) => cat.value === generatedValue)) {
      setMessage("카테고리 코드 생성에 실패했습니다. 다시 시도해주세요.");
      return;
    }

    setIsAdding(true);
    setMessage(null);

    try {
      const newCategory: AssetCategory = {
        value: generatedValue,
        label: newCategoryLabel.trim(),
      };

      const updatedCategories = [...categories, newCategory];

      const { error } = await supabase
        .from("organizations")
        .update({ asset_categories: updatedCategories })
        .eq("id", organizationId);

      if (error) {
        throw error;
      }

      setCategories(updatedCategories);
      setNewCategoryLabel("");
      setMessage("카테고리가 추가되었습니다.");
    } catch (error) {
      console.error("Error adding category:", error);
      setMessage(
        `카테고리 추가 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`
      );
    } finally {
      setIsAdding(false);
    }
  };

  const handleEditCategory = (value: string) => {
    const category = categories.find((c) => c.value === value);
    if (category) {
      setEditingCategoryValue(value);
      setEditingCategoryLabel(category.label);
    }
  };

  const handleCancelEdit = () => {
    setEditingCategoryValue(null);
    setEditingCategoryLabel("");
  };

  const handleUpdateCategory = async () => {
    if (!organizationId) {
      setMessage("기관 정보가 없습니다.");
      return;
    }

    if (!editingCategoryValue || !editingCategoryLabel.trim()) {
      setMessage("카테고리명을 입력해주세요.");
      return;
    }

    setIsUpdating(true);
    setMessage(null);

    try {
      const updatedCategories = categories.map((cat) =>
        cat.value === editingCategoryValue
          ? { ...cat, label: editingCategoryLabel.trim() }
          : cat
      );

      const { error } = await supabase
        .from("organizations")
        .update({ asset_categories: updatedCategories })
        .eq("id", organizationId);

      if (error) {
        console.error("Error updating category:", {
          message: error.message || "Unknown error",
          details: error.details || null,
          hint: error.hint || null,
          code: error.code || null,
          organizationId: organizationId || null,
        });
        
        // 스키마 캐시 오류인 경우 특별 처리
        if (
          error.message?.includes("schema cache") || 
          error.message?.includes("asset_categories") || 
          error.message?.includes("Could not find") ||
          error.code === "PGRST116"
        ) {
          setMessage("데이터베이스 스키마가 업데이트되지 않았습니다. Supabase 대시보드의 SQL Editor에서 다음 마이그레이션을 실행해주세요:\n\nALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS asset_categories jsonb DEFAULT '[]'::jsonb;");
          return;
        }
        
        throw error;
      }

      setCategories(updatedCategories);
      setEditingCategoryValue(null);
      setEditingCategoryLabel("");
      setMessage("카테고리가 수정되었습니다.");
    } catch (error) {
      console.error("Error updating category (catch):", error);
      let errorMessage = "알 수 없는 오류";
      
      if (error && typeof error === 'object') {
        if ('message' in error && typeof error.message === 'string') {
          errorMessage = error.message;
        } else if ('details' in error && typeof error.details === 'string') {
          errorMessage = error.details;
        } else if ('hint' in error && typeof error.hint === 'string') {
          errorMessage = error.hint;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setMessage(`카테고리 수정 실패: ${errorMessage}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const performDrop = async (dragIndex: number, dropIndex: number) => {
    if (dragIndex === null || dragIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    if (!organizationId) {
      setMessage("기관 정보가 없습니다.");
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    setIsReordering(true);
    setMessage(null);

    try {
      const newCategories = [...categories];
      const [removed] = newCategories.splice(dragIndex, 1);
      newCategories.splice(dropIndex, 0, removed);

      const { error } = await supabase
        .from("organizations")
        .update({ asset_categories: newCategories })
        .eq("id", organizationId);

      if (error) {
        console.error("Error reordering categories:", {
          message: error.message || "Unknown error",
          details: error.details || null,
          hint: error.hint || null,
          code: error.code || null,
          organizationId: organizationId || null,
        });
        
        if (
          error.message?.includes("schema cache") || 
          error.message?.includes("asset_categories") || 
          error.message?.includes("Could not find") ||
          error.code === "PGRST116"
        ) {
          setMessage("데이터베이스 스키마가 업데이트되지 않았습니다. Supabase 대시보드의 SQL Editor에서 다음 마이그레이션을 실행해주세요:\n\nALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS asset_categories jsonb DEFAULT '[]'::jsonb;");
          return;
        }
        
        throw error;
      }

      setCategories(newCategories);
      setMessage("카테고리 순서가 변경되었습니다.");
    } catch (error) {
      console.error("Error reordering categories (catch):", error);
      let errorMessage = "알 수 없는 오류";
      
      if (error && typeof error === 'object') {
        if ('message' in error && typeof error.message === 'string') {
          errorMessage = error.message;
        } else if ('details' in error && typeof error.details === 'string') {
          errorMessage = error.details;
        } else if ('hint' in error && typeof error.hint === 'string') {
          errorMessage = error.hint;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setMessage(`카테고리 순서 변경 실패: ${errorMessage}`);
    } finally {
      setIsReordering(false);
      setDraggedIndex(null);
      setDragOverIndex(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    await performDrop(draggedIndex, dropIndex);
  };

  // 모바일 터치 이벤트 핸들러
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchCurrentIndex, setTouchCurrentIndex] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent, index: number) => {
    if (isReordering || editingCategoryValue !== null) return;
    const touch = e.touches[0];
    setTouchStartY(touch.clientY);
    setTouchCurrentIndex(index);
    setDraggedIndex(index);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY === null || touchCurrentIndex === null) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const dragItem = element?.closest('[data-drag-index]');
    
    if (dragItem) {
      const targetIndex = parseInt(dragItem.getAttribute('data-drag-index') || '-1');
      if (targetIndex !== -1 && targetIndex !== draggedIndex) {
        setDragOverIndex(targetIndex);
      }
    }
  };

  const handleTouchEnd = async (e: React.TouchEvent) => {
    if (touchStartY === null || touchCurrentIndex === null) return;
    
    const touch = e.changedTouches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const dragItem = element?.closest('[data-drag-index]');
    
    if (dragItem) {
      const dropIndex = parseInt(dragItem.getAttribute('data-drag-index') || '-1');
      if (dropIndex !== -1 && dropIndex !== touchCurrentIndex) {
        await performDrop(touchCurrentIndex, dropIndex);
      }
    }
    
    setTouchStartY(null);
    setTouchCurrentIndex(null);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDeleteCategory = (value: string) => {
    setShowDeleteConfirm(value);
  };

  const confirmDeleteCategory = async () => {
    if (!showDeleteConfirm || !organizationId) {
      return;
    }

    const categoryToDelete = categories.find((c) => c.value === showDeleteConfirm);
    if (!categoryToDelete) {
      setShowDeleteConfirm(null);
      return;
    }

    try {
      const updatedCategories = categories.filter((cat) => cat.value !== showDeleteConfirm);

      const { error } = await supabase
        .from("organizations")
        .update({ asset_categories: updatedCategories })
        .eq("id", organizationId);

      if (error) {
        throw error;
      }

      setCategories(updatedCategories);
      setMessage("카테고리가 삭제되었습니다.");
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting category:", error);
      setMessage(
        `카테고리 삭제 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`
      );
      setShowDeleteConfirm(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-neutral-500">로딩 중...</p>;
  }

  if (userRole !== "admin") {
    return (
      <Notice variant="neutral">
        카테고리 관리는 관리자만 할 수 있습니다.
      </Notice>
    );
  }

  return (
    <div className="manage-stack">
      <div>
        <h3 className="module-title">물품 카테고리 관리</h3>
        <p className="module-description">
          물품 등록 시 사용할 카테고리를 추가하고 표시 순서를 관리할 수 있습니다.
        </p>
      </div>

      {message && (
        <Notice
          variant={message.includes("실패") || message.includes("오류") ? "error" : "success"}
          className="text-left"
        >
          {message}
        </Notice>
      )}

      <section className="surface-card p-5 md:p-6">
        <h4 className="text-sm font-semibold text-neutral-900">카테고리 추가</h4>
        <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
          <input
            type="text"
            className="form-input"
            placeholder="카테고리명 (예: 음향)"
            value={newCategoryLabel}
            onChange={(e) => setNewCategoryLabel(e.target.value)}
          />
          <button
            type="button"
            onClick={handleAddCategory}
            disabled={isAdding || !newCategoryLabel.trim()}
            className="btn-primary md:min-w-24"
          >
            {isAdding ? "추가 중..." : "추가"}
          </button>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          카테고리명을 입력하면 시스템이 고유한 카테고리 코드를 자동 생성합니다.
        </p>
      </section>

      <section className="surface-card p-5 md:p-6">
        <h4 className="text-sm font-semibold text-neutral-900">현재 카테고리 목록</h4>
        {categories.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">등록된 카테고리가 없습니다.</p>
        ) : (
          <div className="module-list mt-3">
            {categories.map((category, index) => (
              <div
                key={category.value}
                data-drag-index={index}
                draggable={!isReordering && editingCategoryValue === null}
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onTouchStart={(e) => handleTouchStart(e, index)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className={`flex items-center gap-2 px-4 py-3 transition-all ${
                  draggedIndex === index
                    ? "cursor-grabbing opacity-50"
                    : dragOverIndex === index
                    ? "bg-blue-50"
                    : "cursor-grab bg-white"
                } ${isReordering ? "pointer-events-none opacity-50" : ""}`}
              >
                <svg
                  className="h-5 w-5 flex-shrink-0 text-neutral-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8h16M4 16h16"
                  />
                </svg>

                {editingCategoryValue === category.value ? (
                  <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      type="text"
                      className="form-input flex-1 text-sm"
                      value={editingCategoryLabel}
                      onChange={(e) => setEditingCategoryLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleUpdateCategory();
                        } else if (e.key === "Escape") {
                          handleCancelEdit();
                        }
                      }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleUpdateCategory}
                      disabled={isUpdating || !editingCategoryLabel.trim()}
                      className="btn-primary h-9 px-3 text-xs"
                    >
                      {isUpdating ? "저장 중..." : "저장"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      disabled={isUpdating}
                      className="btn-outline h-9 px-3 text-xs"
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-neutral-900">
                        {category.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleEditCategory(category.value)}
                        className="icon-button"
                        title="수정"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(category.value)}
                        className="icon-button icon-button-danger"
                        title="삭제"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {showDeleteConfirm && (
        <div className="modal-backdrop">
          <div className="modal-surface max-w-md">
            <h3 className="text-lg font-semibold text-slate-900">카테고리 삭제</h3>
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="text-sm text-rose-700">
                정말 &quot;{categories.find((c) => c.value === showDeleteConfirm)?.label}&quot;
                {" "}카테고리를 삭제하시겠습니까?
              </p>
              <p className="mt-2 text-xs text-rose-600">
                이 카테고리를 사용하는 물품의 카테고리 정보가 제거될 수 있습니다.
              </p>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={confirmDeleteCategory}
                className="btn-danger flex-1"
              >
                삭제
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(null)}
                className="btn-outline flex-1"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
