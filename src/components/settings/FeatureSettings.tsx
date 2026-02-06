"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Notice from "@/components/common/Notice";

type OrganizationFeatures = {
  equipment?: boolean;
  spaces?: boolean;
  vehicles?: boolean;
};

type OrganizationMenuLabels = {
  equipment?: string;
  spaces?: string;
  vehicles?: string;
};

type MenuOrderItem = {
  key: "equipment" | "spaces" | "vehicles";
  enabled: boolean;
};


type FeatureSettingsProps = {
  organizationId: string | null;
};

export default function FeatureSettings({ organizationId }: FeatureSettingsProps) {
  const [features, setFeatures] = useState<OrganizationFeatures>({
    equipment: true,
    spaces: true,
    vehicles: false,
  });
  const [menuLabels, setMenuLabels] = useState<OrganizationMenuLabels>({
    equipment: "물품",
    spaces: "공간",
    vehicles: "차량",
  });
  const [menuOrder, setMenuOrder] = useState<MenuOrderItem[]>([
    { key: "equipment", enabled: true },
    { key: "spaces", enabled: true },
    { key: "vehicles", enabled: false },
  ]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [showDisableConfirm, setShowDisableConfirm] = useState<{
    feature: "equipment" | "spaces" | "vehicles";
    enabled: boolean;
  } | null>(null);
  const [editingMenuKey, setEditingMenuKey] = useState<"equipment" | "spaces" | "vehicles" | null>(null);
  const [editingMenuLabel, setEditingMenuLabel] = useState<string>("");

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    const loadSettings = async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("features,menu_labels,menu_order")
        .eq("id", organizationId)
        .maybeSingle();

      if (error) {
        console.error("Error loading features:", error);
        setLoading(false);
        return;
      }

      if (data) {
        if (data.features) {
          setFeatures({
            equipment: data.features.equipment ?? true,
            spaces: data.features.spaces ?? true,
            vehicles: data.features.vehicles ?? false,
          });
        }
        if (data.menu_labels) {
          setMenuLabels({
            equipment: data.menu_labels.equipment ?? "물품",
            spaces: data.menu_labels.spaces ?? "공간",
            vehicles: data.menu_labels.vehicles ?? "차량",
          });
        }
        if (data.menu_order && Array.isArray(data.menu_order)) {
          setMenuOrder(data.menu_order as MenuOrderItem[]);
        }
      }

      setLoading(false);
    };

    loadSettings();
  }, [organizationId]);

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

    const newOrder = [...menuOrder];
    const [removed] = newOrder.splice(dragIndex, 1);
    newOrder.splice(dropIndex, 0, removed);
    setMenuOrder(newOrder);
    setDraggedIndex(null);
    setDragOverIndex(null);
    // 즉시 저장
    await handleSave(undefined, undefined, newOrder);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    performDrop(draggedIndex, dropIndex);
  };

  // 모바일 터치 이벤트 핸들러
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchCurrentIndex, setTouchCurrentIndex] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent, index: number) => {
    const touch = e.touches[0];
    setTouchStartY(touch.clientY);
    setTouchCurrentIndex(index);
    setDraggedIndex(index);
  };

  const handleTouchMove = (e: React.TouchEvent, index: number) => {
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

  const handleTouchEnd = (e: React.TouchEvent, index: number) => {
    if (touchStartY === null || touchCurrentIndex === null) return;
    
    const touch = e.changedTouches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const dragItem = element?.closest('[data-drag-index]');
    
    if (dragItem) {
      const dropIndex = parseInt(dragItem.getAttribute('data-drag-index') || '-1');
      if (dropIndex !== -1 && dropIndex !== touchCurrentIndex) {
        performDrop(touchCurrentIndex, dropIndex);
      }
    }
    
    setTouchStartY(null);
    setTouchCurrentIndex(null);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleSave = async (newFeatures?: OrganizationFeatures, newMenuLabels?: OrganizationMenuLabels, newMenuOrder?: MenuOrderItem[]) => {
    if (!organizationId) {
      setMessage("기관이 설정되지 않았습니다.");
      return;
    }

    setMessage(null);

    const featuresToSave = newFeatures || features;
    const menuLabelsToSave = newMenuLabels || menuLabels;
    const menuOrderToSave = newMenuOrder || menuOrder;

    const { error } = await supabase
      .from("organizations")
      .update({
        features: featuresToSave,
        menu_labels: menuLabelsToSave,
        menu_order: menuOrderToSave,
      })
      .eq("id", organizationId);

    if (error) {
      setMessage(`저장 오류: ${error.message}`);
    } else {
      setMessage("설정이 저장되었습니다.");
      // 성공 메시지를 2초 후 자동으로 숨김
      setTimeout(() => setMessage(null), 2000);
      // 헤더에 변경사항 알림
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("organizationSettingsUpdated"));
      }
    }
  };

  if (!organizationId) {
    return (
      <Notice variant="neutral" className="text-left">
        기관을 먼저 생성해주세요.
      </Notice>
    );
  }

  if (loading) {
    return <Notice>설정을 불러오는 중입니다...</Notice>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">기능 설정</h3>
        <p className="text-sm text-neutral-600 mb-4">
          기관에서 사용할 기능을 활성화하거나 비활성화할 수 있습니다.
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <h4 className="text-sm font-semibold mb-3">기능 및 메뉴 설정</h4>
        <p className="text-xs text-neutral-500 mb-4">
          기능을 활성화하고 메뉴 이름과 표시 순서를 변경할 수 있습니다.
        </p>

        <div className="space-y-3">
          {menuOrder.map((item, index) => {
            const labelKey = item.key;
            const labelValue = menuLabels[labelKey] || 
              (labelKey === "equipment" ? "물품" : 
               labelKey === "spaces" ? "공간" : "차량");
            const isEnabled = features[labelKey] !== false;
            
            const featureLabel = labelKey === "equipment" ? "물품관리" :
                                labelKey === "spaces" ? "공간관리" : "차량관리";

            return (
              <div
                key={item.key}
                data-drag-index={index}
                draggable={isEnabled}
                onDragStart={() => isEnabled && handleDragStart(index)}
                onDragOver={(e) => isEnabled && handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => isEnabled && handleDrop(e, index)}
                onTouchStart={(e) => isEnabled && handleTouchStart(e, index)}
                onTouchMove={(e) => isEnabled && handleTouchMove(e, index)}
                onTouchEnd={(e) => isEnabled && handleTouchEnd(e, index)}
                className={`flex items-center gap-3 p-3 border border-neutral-200 rounded-lg transition-all ${
                  draggedIndex === index
                    ? "opacity-50 cursor-grabbing"
                    : dragOverIndex === index
                    ? "border-blue-400 bg-blue-50"
                    : isEnabled
                    ? "cursor-grab bg-white"
                    : "bg-neutral-50"
                }`}
              >
                {/* 드래그 핸들 */}
                {isEnabled && (
                  <svg
                    className="w-5 h-5 text-neutral-400 flex-shrink-0"
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
                )}
                
                {editingMenuKey === labelKey ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={editingMenuLabel}
                      onChange={(e) => setEditingMenuLabel(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter") {
                          const newMenuLabels = { ...menuLabels, [labelKey]: editingMenuLabel };
                          setMenuLabels(newMenuLabels);
                          setEditingMenuKey(null);
                          setEditingMenuLabel("");
                          // 즉시 저장
                          await handleSave(undefined, newMenuLabels, undefined);
                        } else if (e.key === "Escape") {
                          setEditingMenuKey(null);
                          setEditingMenuLabel("");
                        }
                      }}
                      className="form-input flex-1 h-10 text-sm"
                      placeholder={
                        labelKey === "equipment" ? "물품" :
                        labelKey === "spaces" ? "공간" : "차량"
                      }
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const newMenuLabels = { ...menuLabels, [labelKey]: editingMenuLabel };
                        setMenuLabels(newMenuLabels);
                        setEditingMenuKey(null);
                        setEditingMenuLabel("");
                        // 즉시 저장
                        await handleSave(undefined, newMenuLabels, undefined);
                      }}
                      className="btn-primary text-xs px-3 py-1 whitespace-nowrap"
                    >
                      저장
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMenuKey(null);
                        setEditingMenuLabel("");
                      }}
                      className="btn-ghost text-xs px-3 py-1 whitespace-nowrap"
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <span className="font-medium text-sm flex-1">{labelValue}</span>
                )}
                <div className="flex items-center gap-3">
                  {editingMenuKey !== labelKey && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMenuKey(labelKey);
                        setEditingMenuLabel(labelValue);
                      }}
                      className="p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors"
                      title="수정"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  )}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={async (e) => {
                        // 비활성화 시 확인 모달 표시
                        if (!e.target.checked) {
                          setShowDisableConfirm({ feature: labelKey, enabled: false });
                        } else {
                          const newFeatures = { ...features, [labelKey]: e.target.checked };
                          const newMenuOrder = menuOrder.map(i => 
                            i.key === labelKey 
                              ? { ...i, enabled: e.target.checked }
                              : i
                          );
                          setFeatures(newFeatures);
                          setMenuOrder(newMenuOrder);
                          // 즉시 저장
                          await handleSave(newFeatures, undefined, newMenuOrder);
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {message && (
        <Notice
          variant={message.includes("오류") ? "warning" : "neutral"}
          className="text-left"
        >
          {message}
        </Notice>
      )}

      {/* 기능 비활성화 확인 모달 */}
      {showDisableConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="rounded-t-lg bg-amber-600 px-6 py-4">
              <h3 className="text-lg font-semibold text-white">기능 비활성화 확인</h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm text-amber-700">
                  {showDisableConfirm.feature === "equipment" && "물품 관리 기능을 비활성화하면 물품 목록과 대여 기능이 숨겨집니다. 기존 물품 데이터는 유지됩니다."}
                  {showDisableConfirm.feature === "spaces" && "공간 관리 기능을 비활성화하면 공간 목록과 예약 기능이 숨겨집니다. 기존 공간 데이터는 유지됩니다."}
                  {showDisableConfirm.feature === "vehicles" && "차량 관리 기능을 비활성화하면 차량 목록과 대여 기능이 숨겨집니다. 기존 차량 데이터는 유지됩니다."}
                </p>
              </div>
              <p className="text-sm text-neutral-600">
                정말 이 기능을 비활성화하시겠습니까?
              </p>
            </div>
            <div className="flex gap-3 rounded-b-lg border-t border-neutral-200 bg-neutral-50 px-6 py-4">
              <button
                type="button"
                onClick={async () => {
                  const feature = showDisableConfirm.feature;
                  const newFeatures = { ...features, [feature]: false };
                  const newMenuOrder = menuOrder.map(item => 
                    item.key === feature 
                      ? { ...item, enabled: false }
                      : item
                  );
                  setFeatures(newFeatures);
                  setMenuOrder(newMenuOrder);
                  setShowDisableConfirm(null);
                  // 즉시 저장
                  await handleSave(newFeatures, undefined, newMenuOrder);
                }}
                className="flex-1 btn-primary bg-amber-600 hover:bg-amber-700"
              >
                비활성화
              </button>
              <button
                type="button"
                onClick={() => setShowDisableConfirm(null)}
                className="flex-1 btn-ghost"
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
