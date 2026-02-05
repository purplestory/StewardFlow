"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import ImageSlider from "@/components/common/ImageSlider";
import {
  sendReturnApprovalToAdmin,
  sendReturnApprovalToBorrower,
} from "@/lib/kakao-message";

type ReturnVerificationFormProps = {
  reservationId: string;
  resourceType: "asset" | "space" | "vehicle";
  returnImages?: string[] | null;
  vehicleOdometerImage?: string | null;
  vehicleExteriorImage?: string | null;
  odometerReading?: number | null;
  returnNote?: string | null;
  onVerificationComplete?: () => void;
};

const conditionOptions = [
  { value: "good", label: "양호" },
  { value: "damaged", label: "손상 있음" },
  { value: "missing_parts", label: "부품 누락" },
  { value: "dirty", label: "청소 필요" },
  { value: "other", label: "기타" },
];

export default function ReturnVerificationForm({
  reservationId,
  resourceType,
  returnImages,
  vehicleOdometerImage,
  vehicleExteriorImage,
  odometerReading,
  returnNote,
  onVerificationComplete,
}: ReturnVerificationFormProps) {
  const [condition, setCondition] = useState("good");
  const [verificationNote, setVerificationNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isApproved, setIsApproved] = useState(true);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      setMessage("로그인이 필요합니다.");
      return;
    }

    setIsSubmitting(true);

    try {
      const tableName =
        resourceType === "asset"
          ? "reservations"
          : resourceType === "space"
          ? "space_reservations"
          : "vehicle_reservations";

      const updateData: any = {
        return_status: isApproved ? "verified" : "rejected",
        return_condition: condition,
        return_verified_by: user.id,
        return_verified_at: new Date().toISOString(),
      };

      if (verificationNote) {
        updateData.return_note = verificationNote;
      }

      // If approved, update status to returned and make resource available
      if (isApproved) {
        updateData.status = "returned";

        const { data: reservationData } = await supabase
          .from(tableName)
          .select(
            resourceType === "asset"
              ? "asset_id"
              : resourceType === "space"
              ? "space_id"
              : "vehicle_id"
          )
          .eq("id", reservationId)
          .maybeSingle();

        if (reservationData) {
          const resourceId =
            resourceType === "asset"
              ? (reservationData as { asset_id: string }).asset_id
              : resourceType === "space"
              ? (reservationData as { space_id: string }).space_id
              : (reservationData as { vehicle_id: string }).vehicle_id;
          const resourceTable =
            resourceType === "asset"
              ? "assets"
              : resourceType === "space"
              ? "spaces"
              : "vehicles";

          // 차량인 경우 current_odometer도 업데이트
          if (resourceType === "vehicle" && odometerReading !== null) {
            await supabase
              .from(resourceTable)
              .update({ 
                status: "available",
                current_odometer: odometerReading,
              })
              .eq("id", resourceId);
          } else {
            await supabase
              .from(resourceTable)
              .update({ status: "available" })
              .eq("id", resourceId);
          }
        }
      }

      const { error: updateError } = await supabase
        .from(tableName)
        .update(updateData)
        .eq("id", reservationId);

      if (updateError) {
        throw updateError;
      }

      setMessage(
        isApproved
          ? "반납 확인이 완료되었습니다."
          : "반납이 반려되었습니다."
      );

      // 카카오톡 알림 발송 (비동기, 실패해도 승인은 완료)
      try {
        // 예약 정보 조회
        const { data: reservationInfo } = await supabase
          .from(tableName)
          .select(
            resourceType === "asset"
              ? "asset_id,borrower_id,assets(name)"
              : resourceType === "space"
              ? "space_id,borrower_id,spaces(name)"
              : "vehicle_id,borrower_id,vehicles(name)"
          )
          .eq("id", reservationId)
          .maybeSingle();

        if (reservationInfo) {
          const resourceName =
            resourceType === "asset"
              ? (reservationInfo as any).assets?.name
              : resourceType === "space"
              ? (reservationInfo as any).spaces?.name
              : (reservationInfo as any).vehicles?.name;

          // 신청자 정보 조회
          const { data: borrowerProfile } = await supabase
            .from("profiles")
            .select("phone,name,organization_id")
            .eq("id", (reservationInfo as any).borrower_id)
            .maybeSingle();

          // 관리자 정보 조회
          if (borrowerProfile?.organization_id) {
            const { data: adminProfiles } = await supabase
              .from("profiles")
              .select("phone")
              .eq("organization_id", borrowerProfile.organization_id)
              .in("role", ["admin", "manager"]);

            const verificationStatus = isApproved ? "verified" : "rejected";

            // 신청자에게 알림
            if (borrowerProfile.phone && resourceName) {
              await sendReturnApprovalToBorrower(
                borrowerProfile.phone,
                resourceName,
                verificationStatus,
                resourceType
              );
            }

            // 관리자들에게 알림
            if (adminProfiles && resourceName && borrowerProfile.name) {
              for (const admin of adminProfiles) {
                if (admin.phone) {
                  await sendReturnApprovalToAdmin(
                    admin.phone,
                    resourceName,
                    borrowerProfile.name,
                    verificationStatus,
                    resourceType
                  );
                }
              }
            }
          }
        }
      } catch (kakaoError) {
        console.error("카카오톡 반납 승인 알림 발송 실패:", kakaoError);
        // 알림 실패해도 승인은 계속 진행
      }

      if (onVerificationComplete) {
        setTimeout(() => {
          onVerificationComplete();
        }, 1000);
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "확인 처리 중 오류가 발생했습니다."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const allImages: string[] = [];
  if (returnImages && returnImages.length > 0) {
    allImages.push(...returnImages);
  }
  if (vehicleOdometerImage) {
    allImages.push(vehicleOdometerImage);
  }
  if (vehicleExteriorImage) {
    allImages.push(vehicleExteriorImage);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {allImages.length > 0 && (
        <div>
          <label className="form-label">반납 사진</label>
          <div className="mt-2">
            <ImageSlider
              images={allImages}
              alt="반납 확인 사진"
            />
          </div>
        </div>
      )}

      {resourceType === "vehicle" && odometerReading != null && (
        <div>
          <label className="form-label">주행거리</label>
          <div className="mt-2 p-3 bg-neutral-50 rounded-lg">
            <p className="text-lg font-semibold">{odometerReading.toLocaleString()} km</p>
          </div>
        </div>
      )}

      {returnNote && (
        <div>
          <label className="form-label">반납 메모</label>
          <div className="mt-2 p-3 bg-neutral-50 rounded-lg">
            <p className="text-sm text-neutral-700 whitespace-pre-wrap">
              {returnNote}
            </p>
          </div>
        </div>
      )}

      <div>
        <label className="flex flex-col gap-2">
          <span className="form-label">상태 확인</span>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className="form-select"
          >
            {conditionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <label className="flex flex-col gap-2">
          <span className="form-label">확인 메모</span>
          <textarea
            value={verificationNote}
            onChange={(e) => setVerificationNote(e.target.value)}
            className="form-textarea"
            placeholder="확인 시 특이사항을 기록해주세요."
            rows={3}
          />
        </label>
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="verification_status"
            value="approved"
            checked={isApproved}
            onChange={() => setIsApproved(true)}
            className="w-4 h-4"
          />
          <span className="text-sm font-medium">이상 없음 (승인)</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="verification_status"
            value="rejected"
            checked={!isApproved}
            onChange={() => setIsApproved(false)}
            className="w-4 h-4"
          />
          <span className="text-sm font-medium">문제 있음 (반려)</span>
        </label>
      </div>

      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            message.includes("오류") || message.includes("실패")
              ? "bg-rose-50 text-rose-700 border border-rose-200"
              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
          }`}
          role="status"
        >
          {message}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className={`btn-primary flex-1 ${
            isApproved
              ? "bg-emerald-600 hover:bg-emerald-700"
              : "bg-rose-600 hover:bg-rose-700"
          }`}
        >
          {isSubmitting
            ? "처리 중..."
            : isApproved
            ? "승인하기"
            : "반려하기"}
        </button>
      </div>
    </form>
  );
}
