"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Notice from "@/components/common/Notice";

type VehicleReturnFormProps = {
  reservationId: string;
  onReturnComplete?: () => void;
};

export default function VehicleReturnForm({
  reservationId,
  onReturnComplete,
}: VehicleReturnFormProps) {
  const [odometerImage, setOdometerImage] = useState<File | null>(null);
  const [odometerPreview, setOdometerPreview] = useState<string | null>(null);
  const [exteriorImage, setExteriorImage] = useState<File | null>(null);
  const [exteriorPreview, setExteriorPreview] = useState<string | null>(null);
  const [odometerReading, setOdometerReading] = useState("");
  const [distanceTraveled, setDistanceTraveled] = useState<number | null>(null);
  const [startOdometerReading, setStartOdometerReading] = useState<number | null>(null);
  const [returnNote, setReturnNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load reservation data to get start_odometer_reading
  useEffect(() => {
    const loadReservation = async () => {
      const { data, error } = await supabase
        .from("vehicle_reservations")
        .select("start_odometer_reading")
        .eq("id", reservationId)
        .maybeSingle();

      if (!error && data) {
        setStartOdometerReading(data.start_odometer_reading ?? null);
      }
      setLoading(false);
    };

    loadReservation();
  }, [reservationId]);

  // Calculate distance traveled when odometer reading changes
  useEffect(() => {
    if (odometerReading && startOdometerReading !== null) {
      const final = Number(odometerReading);
      const start = startOdometerReading;
      if (!isNaN(final) && final >= start) {
        setDistanceTraveled(final - start);
      } else {
        setDistanceTraveled(null);
      }
    } else {
      setDistanceTraveled(null);
    }
  }, [odometerReading, startOdometerReading]);

  const handleOdometerFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      setOdometerImage(file);
      setOdometerPreview(URL.createObjectURL(file));
      setMessage(null);
    }
  };

  const handleExteriorFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      setExteriorImage(file);
      setExteriorPreview(URL.createObjectURL(file));
      setMessage(null);
    }
  };

  const removeOdometerImage = () => {
    if (odometerPreview) {
      URL.revokeObjectURL(odometerPreview);
    }
    setOdometerImage(null);
    setOdometerPreview(null);
  };

  const removeExteriorImage = () => {
    if (exteriorPreview) {
      URL.revokeObjectURL(exteriorPreview);
    }
    setExteriorImage(null);
    setExteriorPreview(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      setMessage("로그인이 필요합니다.");
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    const organizationId = profileData?.organization_id;
    if (!organizationId) {
      setMessage("기관 설정이 필요합니다.");
      return;
    }

    // Check return verification policy
    const { data: orgData } = await supabase
      .from("organizations")
      .select("return_verification_policy")
      .eq("id", organizationId)
      .maybeSingle();

    const policy = orgData?.return_verification_policy as {
      enabled?: boolean;
      require_photo?: boolean;
      require_verification?: boolean;
    } | null;

    if (policy?.enabled && policy?.require_photo) {
      if (!odometerImage || !exteriorImage) {
        setMessage("계기판 사진과 외관 사진을 모두 촬영해야 합니다.");
        return;
      }
    }

    if (!odometerReading || isNaN(Number(odometerReading))) {
      setMessage("주행거리를 입력해주세요.");
      return;
    }

    setIsSubmitting(true);

    try {
      let odometerImageUrl: string | null = null;
      let exteriorImageUrl: string | null = null;

      // Upload odometer image
      if (odometerImage) {
        const fileExt = odometerImage.name.split(".").pop() ?? "jpg";
        const filePath = `returns/vehicles/odometer/${Date.now()}-${crypto.randomUUID()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("asset-images")
          .upload(filePath, odometerImage);

        if (uploadError) {
          throw uploadError;
        }

        const { data: urlData } = supabase.storage
          .from("asset-images")
          .getPublicUrl(filePath);

        odometerImageUrl = urlData?.publicUrl || null;
      }

      // Upload exterior image
      if (exteriorImage) {
        const fileExt = exteriorImage.name.split(".").pop() ?? "jpg";
        const filePath = `returns/vehicles/exterior/${Date.now()}-${crypto.randomUUID()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("asset-images")
          .upload(filePath, exteriorImage);

        if (uploadError) {
          throw uploadError;
        }

        const { data: urlData } = supabase.storage
          .from("asset-images")
          .getPublicUrl(filePath);

        exteriorImageUrl = urlData?.publicUrl || null;
      }

      const finalOdometerReading = Number(odometerReading);
      const calculatedDistance = startOdometerReading !== null && !isNaN(finalOdometerReading)
        ? finalOdometerReading - startOdometerReading
        : null;

      // Update reservation with return information
      const updateData: any = {
        vehicle_odometer_image: odometerImageUrl,
        vehicle_exterior_image: exteriorImageUrl,
        odometer_reading: finalOdometerReading,
        distance_traveled: calculatedDistance,
        return_status: policy?.require_verification ? "returned" : "verified",
        return_note: returnNote || null,
      };

      // If verification is not required, mark as verified immediately
      if (!policy?.require_verification) {
        updateData.status = "returned";
        updateData.return_verified_by = user.id;
        updateData.return_verified_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from("vehicle_reservations")
        .update(updateData)
        .eq("id", reservationId);

      if (updateError) {
        throw updateError;
      }

      // Update vehicle status and current_odometer if not requiring verification
      if (!policy?.require_verification) {
        const { data: reservationData } = await supabase
          .from("vehicle_reservations")
          .select("vehicle_id")
          .eq("id", reservationId)
          .maybeSingle();

        if (reservationData) {
          // Update vehicle status and current_odometer
          await supabase
            .from("vehicles")
            .update({ 
              status: "available",
              current_odometer: finalOdometerReading,
            })
            .eq("id", reservationData.vehicle_id);
        }
      }

      setMessage("반납이 완료되었습니다.");
      if (odometerPreview) URL.revokeObjectURL(odometerPreview);
      if (exteriorPreview) URL.revokeObjectURL(exteriorPreview);
      setOdometerImage(null);
      setOdometerPreview(null);
      setExteriorImage(null);
      setExteriorPreview(null);
      setOdometerReading("");
      setReturnNote("");

      if (onReturnComplete) {
        setTimeout(() => {
          onReturnComplete();
        }, 1000);
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "반납 처리 중 오류가 발생했습니다."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <Notice>예약 정보를 불러오는 중입니다...</Notice>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="flex flex-col gap-2">
          <span className="form-label">
            계기판 사진 <span className="form-label-optional">(필수)</span>
          </span>
          <div className="image-upload-area">
            {odometerPreview ? (
              <div className="relative group">
                <img
                  src={odometerPreview}
                  alt="계기판 사진"
                  className="w-full aspect-[4/3] object-cover rounded-lg border border-neutral-200"
                />
                <button
                  type="button"
                  onClick={removeOdometerImage}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-rose-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="이미지 삭제"
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="image-upload-placeholder">
                계기판의 주행거리를 확인할 수 있도록 촬영해주세요.
              </div>
            )}
            <input
              name="odometer_image"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleOdometerFileChange}
              className="image-upload-input"
              required
            />
          </div>
        </label>
      </div>

      <div>
        <label className="flex flex-col gap-2">
          <span className="form-label">
            외관 사진 <span className="form-label-optional">(필수)</span>
          </span>
          <div className="image-upload-area">
            {exteriorPreview ? (
              <div className="relative group">
                <img
                  src={exteriorPreview}
                  alt="외관 사진"
                  className="w-full aspect-[4/3] object-cover rounded-lg border border-neutral-200"
                />
                <button
                  type="button"
                  onClick={removeExteriorImage}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-rose-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="이미지 삭제"
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="image-upload-placeholder">
                차량 외관의 상태를 확인할 수 있도록 촬영해주세요.
              </div>
            )}
            <input
              name="exterior_image"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleExteriorFileChange}
              className="image-upload-input"
              required
            />
          </div>
        </label>
      </div>

      <div className="space-y-3">
        {startOdometerReading !== null && (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
            <p className="text-neutral-600">
              대여 시 초기 주행거리: <span className="font-medium">{startOdometerReading.toLocaleString()} km</span>
            </p>
          </div>
        )}
        <label className="flex flex-col gap-2">
          <span className="form-label">
            반납 시 최종 주행거리 (km) <span className="form-label-optional">(필수)</span>
          </span>
          <input
            type="number"
            value={odometerReading}
            onChange={(e) => setOdometerReading(e.target.value)}
            className="form-input"
            placeholder="예: 50123"
            required
            min={startOdometerReading ?? 0}
          />
          <p className="text-xs text-neutral-500">
            계기판에 표시된 최종 주행거리를 입력해주세요.
          </p>
        </label>
        {distanceTraveled !== null && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <p className="text-sm font-medium text-emerald-900">
              실제 운행거리: <span className="text-lg">{distanceTraveled.toLocaleString()} km</span>
            </p>
            <p className="text-xs text-emerald-700 mt-1">
              (최종 주행거리 - 초기 주행거리)
            </p>
          </div>
        )}
      </div>

      <div>
        <label className="flex flex-col gap-2">
          <span className="form-label">반납 메모</span>
          <textarea
            value={returnNote}
            onChange={(e) => setReturnNote(e.target.value)}
            className="form-textarea"
            placeholder="반납 시 특이사항이나 상태를 기록해주세요."
            rows={3}
          />
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

      <button
        type="submit"
        disabled={
          isSubmitting ||
          !odometerImage ||
          !exteriorImage ||
          !odometerReading
        }
        className="btn-primary w-full"
      >
        {isSubmitting ? "반납 처리 중..." : "반납하기"}
      </button>
    </form>
  );
}
