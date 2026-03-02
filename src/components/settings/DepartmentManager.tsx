"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Notice from "@/components/common/Notice";
import SectionCard from "@/components/ui/SectionCard";
import { ModuleList, ModuleListHeader } from "@/components/ui/ModuleList";

type Department = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

type DepartmentManagerProps = {
  organizationId: string;
};

export default function DepartmentManager({ organizationId }: DepartmentManagerProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [newDepartmentDescription, setNewDepartmentDescription] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [, setIsReordering] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const loadDepartments = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    // 부서 목록 로드
    const { data: deptData, error: deptError } = await supabase
      .from("departments")
      .select("id,name,description,created_at")
      .eq("organization_id", organizationId);

    if (deptError) {
      setMessage(`부서 목록 불러오기 오류: ${deptError.message}`);
      setLoading(false);
      return;
    }

    // 순서 정보 로드
    let departmentOrder: string[] = [];
    try {
      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .select("department_order")
        .eq("id", organizationId)
        .maybeSingle();

      if (!orgError && orgData?.department_order) {
        departmentOrder = orgData.department_order as string[];
      }
    } catch (error) {
      // department_order 컬럼이 없을 수 있음 - 무시하고 계속 진행
      console.warn("department_order 컬럼을 읽을 수 없습니다:", error);
    }

    // 순서 정보가 있으면 그에 따라 정렬, 없으면 이름순 정렬
    let sortedDepartments = deptData || [];
    if (departmentOrder.length > 0) {
      const deptMap = new Map(sortedDepartments.map((d) => [d.id, d]));
      sortedDepartments = departmentOrder
        .map((id) => deptMap.get(id))
        .filter((d): d is Department => d !== undefined)
        .concat(sortedDepartments.filter((d) => !departmentOrder.includes(d.id)));
    } else {
      sortedDepartments.sort((a, b) => a.name.localeCompare(b.name));
    }

    setDepartments(sortedDepartments);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadDepartments();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadDepartments]);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setSaving(true);

    const name = newDepartmentName.trim();
    if (!name) {
      setMessage("부서 이름을 입력해주세요.");
      setSaving(false);
      return;
    }

    const { data: newDept, error } = await supabase
      .from("departments")
      .insert({
        organization_id: organizationId,
        name,
        description: newDepartmentDescription.trim() || null,
      })
      .select("id")
      .maybeSingle();

    if (error) {
      setMessage(`부서 생성 오류: ${error.message}`);
    } else {
      // 새 부서를 순서 목록에 추가
      if (newDept) {
        try {
          const { data: orgData } = await supabase
            .from("organizations")
            .select("department_order")
            .eq("id", organizationId)
            .maybeSingle();
          
          const currentOrder = (orgData?.department_order as string[]) || [];
          const newOrder = [...currentOrder, newDept.id];
          
          await supabase
            .from("organizations")
            .update({ department_order: newOrder })
            .eq("id", organizationId);
        } catch (error) {
          // department_order 컬럼이 없을 수 있음 - 무시하고 계속 진행
          console.warn("department_order 업데이트 실패:", error);
        }
      }
      
      setMessage("부서가 생성되었습니다.");
      setNewDepartmentName("");
      setNewDepartmentDescription("");
      await loadDepartments();
    }

    setSaving(false);
  };

  const handleUpdate = async (id: string) => {
    setMessage(null);
    setSaving(true);

    const name = editName.trim();
    if (!name) {
      setMessage("부서 이름을 입력해주세요.");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("departments")
      .update({
        name,
        description: editDescription.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      setMessage(`부서 수정 오류: ${error.message}`);
    } else {
      setMessage("부서가 수정되었습니다.");
      setEditingId(null);
      await loadDepartments();
    }

    setSaving(false);
  };

  const handleDelete = (id: string) => {
    setShowDeleteConfirm(id);
  };

  const confirmDelete = async () => {
    if (!showDeleteConfirm) {
      return;
    }

    setMessage(null);
    setSaving(true);

    const { error } = await supabase
      .from("departments")
      .delete()
      .eq("id", showDeleteConfirm);

    if (error) {
      setMessage(`부서 삭제 오류: ${error.message}`);
      setShowDeleteConfirm(null);
    } else {
      // 삭제된 부서를 순서 목록에서 제거
      try {
        const { data: orgData } = await supabase
          .from("organizations")
          .select("department_order")
          .eq("id", organizationId)
          .maybeSingle();
        
        const currentOrder = (orgData?.department_order as string[]) || [];
        const newOrder = currentOrder.filter((deptId) => deptId !== showDeleteConfirm);
        
        await supabase
          .from("organizations")
          .update({ department_order: newOrder })
          .eq("id", organizationId);
      } catch (error) {
        // department_order 컬럼이 없을 수 있음 - 무시하고 계속 진행
        console.warn("department_order 업데이트 실패:", error);
      }
      
      setMessage("부서가 삭제되었습니다.");
      setShowDeleteConfirm(null);
      await loadDepartments();
    }

    setSaving(false);
  };

  const startEdit = (dept: Department) => {
    setEditingId(dept.id);
    setEditName(dept.name);
    setEditDescription(dept.description || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditDescription("");
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
    setIsReordering(true);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const performDrop = async (dragIndex: number, dropIndex: number) => {
    if (dragIndex === null || dragIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      setIsReordering(false);
      return;
    }

    const newDepartments = [...departments];
    const [draggedItem] = newDepartments.splice(dragIndex, 1);
    const insertionIndex = dragIndex < dropIndex ? dropIndex - 1 : dropIndex;
    newDepartments.splice(insertionIndex, 0, draggedItem);
    setDepartments(newDepartments);

    // 순서를 데이터베이스에 저장
    const departmentOrder = newDepartments.map((d) => d.id);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({ department_order: departmentOrder })
        .eq("id", organizationId);

      if (error) {
        // department_order 컬럼이 없을 수 있음
        if (error.message?.includes("department_order") || error.code === "42703") {
          setMessage("데이터베이스 스키마가 업데이트되지 않았습니다. Supabase 대시보드의 SQL Editor에서 다음 마이그레이션을 실행해주세요:\n\nALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS department_order jsonb DEFAULT '[]'::jsonb;");
        } else {
          setMessage(`순서 저장 오류: ${error.message}`);
        }
        // 실패 시 원래 목록 다시 로드
        await loadDepartments();
        return;
      }
    } catch (error) {
      console.error("Error saving department order:", error);
      setMessage("순서 저장 중 오류가 발생했습니다.");
      await loadDepartments();
      return;
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
    setIsReordering(false);
  };

  const handleDrop = async (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      setIsReordering(false);
      return;
    }
    await performDrop(draggedIndex, index);
  };

  // 모바일 터치 이벤트 핸들러
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchCurrentIndex, setTouchCurrentIndex] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent, index: number) => {
    if (editingId) return;
    const touch = e.touches[0];
    setTouchStartY(touch.clientY);
    setTouchCurrentIndex(index);
    setDraggedIndex(index);
    setIsReordering(true);
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
    setIsReordering(false);
  };

  if (loading) {
    return <Notice>부서 목록을 불러오는 중입니다...</Notice>;
  }

  return (
    <div className="space-y-6">
      {message && (
        <Notice
          variant={
            message.includes("오류") || message.includes("실패")
              ? "error"
              : "success"
          }
          className="text-left"
        >
          {message}
        </Notice>
      )}

      <SectionCard
        title="부서 생성"
        description="기관 내 부서를 추가하고 설명을 관리합니다."
      >
        <form
          onSubmit={handleCreate}
          className="space-y-3"
        >
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <input
              type="text"
              value={newDepartmentName}
              onChange={(e) => setNewDepartmentName(e.target.value)}
              className="form-input"
              placeholder="부서 이름 (예: 유년부, 중고등부, 청년부)"
              required
            />
            <input
              type="text"
              value={newDepartmentDescription}
              onChange={(e) => setNewDepartmentDescription(e.target.value)}
              className="form-input"
              placeholder="부서 설명 (선택사항)"
            />
            <button
              type="submit"
              disabled={saving}
              className="btn-primary w-full md:w-auto"
            >
              부서 생성
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="부서 목록"
        description="드래그로 순서를 변경하고 부서 정보를 수정할 수 있습니다."
      >
        {departments.length === 0 ? (
          <Notice variant="neutral" className="text-left">
            등록된 부서가 없습니다.
          </Notice>
        ) : (
          <ModuleList className="module-list-departments">
            <ModuleListHeader
              left="부서 정보"
              right="관리"
              className="md:grid-cols-[minmax(0,1fr)_168px]"
            />
            <div className="department-list-body">
              {departments.map((dept, index) => (
                <div
                  key={dept.id}
                  data-drag-index={index}
                  draggable={!editingId && editingId !== dept.id}
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onTouchStart={(e) => handleTouchStart(e, index)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  className={`list-row department-row module-row-department transition-all ${
                    draggedIndex === index
                      ? "opacity-50 cursor-grabbing"
                      : dragOverIndex === index
                      ? "bg-blue-50"
                      : editingId === dept.id
                      ? ""
                      : "cursor-grab hover:bg-neutral-50"
                  }`}
                >
                  {editingId === dept.id ? (
                      <div className="flex-1 space-y-2 md:pr-3">
                        <input
                          type="text"
                          value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="form-input"
                        required
                      />
                      <input
                        type="text"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="form-input"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdate(dept.id)}
                          disabled={saving}
                          className="btn-primary w-auto"
                        >
                          저장
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={saving}
                          className="btn-secondary w-auto"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex min-w-0 items-center gap-2">
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
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 font-medium">
                            <span>{dept.name}</span>
                            {dept.description && (
                              <span className="text-sm text-neutral-500">
                                ({dept.description})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-1 md:justify-self-end">
                        <button
                          type="button"
                          onClick={() => startEdit(dept)}
                          className="icon-button"
                          title="수정"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(dept.id)}
                          disabled={saving}
                          className="icon-button icon-button-danger"
                          title="삭제"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </ModuleList>
        )}
      </SectionCard>

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <div className="modal-backdrop">
          <div className="modal-surface max-w-md">
            <h3 className="text-lg font-semibold text-slate-900">부서 삭제</h3>
            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
                <p className="text-sm text-rose-700">
                  정말 &quot;{departments.find((d) => d.id === showDeleteConfirm)?.name}&quot; 부서를 삭제하시겠습니까?
                </p>
                <p className="text-xs text-rose-600 mt-2">
                  이 부서에 속한 회원들의 부서 정보가 초기화될 수 있습니다.
                </p>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={confirmDelete}
                disabled={saving}
                className="btn-danger flex-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "삭제 중..." : "삭제"}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(null)}
                disabled={saving}
                className="btn-outline flex-1 disabled:cursor-not-allowed disabled:opacity-50"
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
