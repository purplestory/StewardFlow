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
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const newOrder = [...menuOrder];
    const [removed] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(dropIndex, 0, removed);
    setMenuOrder(newOrder);
    setDraggedIndex(null);
  };

  const handleSave = async () => {
    if (!organizationId) {
      setMessage("기관이 설정되지 않았습니다.");
      return;
    }

    setSaving(true);
    setMessage(null);

    const { error } = await supabase
      .from("organizations")
      .update({
        features,
        menu_labels: menuLabels,
        menu_order: menuOrder,
      })
      .eq("id", organizationId);

    if (error) {
      setMessage(`저장 오류: ${error.message}`);
    } else {
      setMessage("설정이 저장되었습니다.");
      // 헤더에 변경사항 알림
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("organizationSettingsUpdated"));
      }
    }

    setSaving(false);
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

        <div className="space-y-4">
          {/* Equipment */}
          <div className="flex items-center justify-between p-4 border border-neutral-200 rounded-lg">
            <div className="flex-1">
              <label className="font-medium text-sm">물품 관리</label>
              <p className="text-xs text-neutral-500 mt-1">
                물품 목록, 등록, 대여 기능을 제공합니다.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={features.equipment !== false}
                onChange={(e) => {
                  const newFeatures = { ...features, equipment: e.target.checked };
                  setFeatures(newFeatures);
                  // Update menuOrder enabled state
                  setMenuOrder(prev => prev.map(item => 
                    item.key === "equipment" 
                      ? { ...item, enabled: e.target.checked }
                      : item
                  ));
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
            </label>
          </div>

          {/* Spaces */}
          <div className="flex items-center justify-between p-4 border border-neutral-200 rounded-lg">
            <div className="flex-1">
              <label className="font-medium text-sm">공간 관리</label>
              <p className="text-xs text-neutral-500 mt-1">
                공간 목록, 등록, 예약 기능을 제공합니다.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={features.spaces !== false}
                onChange={(e) => {
                  const newFeatures = { ...features, spaces: e.target.checked };
                  setFeatures(newFeatures);
                  // Update menuOrder enabled state
                  setMenuOrder(prev => prev.map(item => 
                    item.key === "spaces" 
                      ? { ...item, enabled: e.target.checked }
                      : item
                  ));
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
            </label>
          </div>

          {/* Vehicles */}
          <div className="flex items-center justify-between p-4 border border-neutral-200 rounded-lg">
            <div className="flex-1">
              <label className="font-medium text-sm">차량 관리</label>
              <p className="text-xs text-neutral-500 mt-1">
                차량 목록, 등록, 대여 기능을 제공합니다.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={features.vehicles === true}
                onChange={(e) => {
                  const newFeatures = { ...features, vehicles: e.target.checked };
                  setFeatures(newFeatures);
                  // Update menuOrder enabled state
                  setMenuOrder(prev => prev.map(item => 
                    item.key === "vehicles" 
                      ? { ...item, enabled: e.target.checked }
                      : item
                  ));
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <h4 className="text-sm font-semibold mb-3">메뉴 설정</h4>
        <p className="text-xs text-neutral-500 mb-3">
          메뉴 이름과 표시 순서를 변경할 수 있습니다.
        </p>

        <div className="space-y-2">
          {menuOrder.map((item, index) => {
            const labelKey = item.key;
            const labelValue = menuLabels[labelKey] || 
              (labelKey === "equipment" ? "물품" : 
               labelKey === "spaces" ? "공간" : "차량");
            const isEnabled = features[labelKey] !== false;
            
            if (!isEnabled) return null;

            return (
              <div
                key={item.key}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                className={`flex items-center justify-between p-2 rounded border border-neutral-200 bg-neutral-50 transition-all ${
                  draggedIndex === index
                    ? "opacity-50 cursor-grabbing"
                    : dragOverIndex === index
                    ? "border-blue-400 bg-blue-50"
                    : "cursor-grab"
                }`}
              >
                <div className="flex items-center gap-2 flex-1">
                  <svg
                    className="w-4 h-4 text-neutral-400"
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
                  <input
                    type="text"
                    value={labelValue}
                    onChange={(e) =>
                      setMenuLabels({ ...menuLabels, [labelKey]: e.target.value })
                    }
                    className="form-input flex-1 h-10"
                    placeholder={
                      labelKey === "equipment" ? "물품" :
                      labelKey === "spaces" ? "공간" : "차량"
                    }
                  />
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

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-primary w-auto"
        >
          {saving ? "저장 중..." : "설정 저장"}
        </button>
      </div>
    </div>
  );
}
