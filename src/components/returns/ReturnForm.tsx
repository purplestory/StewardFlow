"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Notice from "@/components/common/Notice";

type ReturnFormProps = {
  reservationId: string;
  resourceType: "asset" | "space";
  onReturnComplete?: () => void;
};

export default function ReturnForm({
  reservationId,
  resourceType,
  onReturnComplete,
}: ReturnFormProps) {
  const [returnImages, setReturnImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [returnNote, setReturnNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setMessage(null);

    if (files.length > 0) {
      const limitedFiles = files.slice(0, 10);
      setReturnImages(limitedFiles);

      const urls = limitedFiles.map((file) => URL.createObjectURL(file));
      setPreviewUrls(urls);

      if (files.length > 10) {
        setMessage("최대 10개까지 이미지를 업로드할 수 있습니다.");
      }
    } else {
      setReturnImages([]);
      setPreviewUrls([]);
    }
  };

  const removeImage = (index: number) => {
    const newFiles = returnImages.filter((_, i) => i !== index);
    const newUrls = previewUrls.filter((_, i) => i !== index);

    URL.revokeObjectURL(previewUrls[index]);

    setReturnImages(newFiles);
    setPreviewUrls(newUrls);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    // Check if return verification is required
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

    if (policy?.enabled && policy?.require_photo && returnImages.length === 0) {
      setMessage("반납 확인이 활성화되어 있어 사진을 촬영해야 합니다.");
      return;
    }

    setIsSubmitting(true);

    try {
      const uploadedUrls: string[] = [];

      // Upload images
      for (const imageFile of returnImages) {
        const fileExt = imageFile.name.split(".").pop() ?? "jpg";
        const filePath = `returns/${Date.now()}-${crypto.randomUUID()}.${fileExt}`;

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

      const tableName =
        resourceType === "asset" ? "reservations" : "space_reservations";

      // Update reservation with return information
      const updateData: any = {
        return_images: uploadedUrls,
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
        .from(tableName)
        .update(updateData)
        .eq("id", reservationId);

      if (updateError) {
        throw updateError;
      }

      // Update asset/space status if not requiring verification
      if (!policy?.require_verification) {
        const { data: reservationData } = await supabase
          .from(tableName)
          .select(
            resourceType === "asset" ? "asset_id" : "space_id"
          )
          .eq("id", reservationId)
          .maybeSingle();

        if (reservationData) {
          const resourceId =
            resourceType === "asset"
              ? (reservationData as { asset_id: string }).asset_id
              : (reservationData as { space_id: string }).space_id;
          const resourceTable = resourceType === "asset" ? "assets" : "spaces";

          await supabase
            .from(resourceTable)
            .update({ status: "available" })
            .eq("id", resourceId);
        }
      }

      setMessage("반납이 완료되었습니다.");
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
      setReturnImages([]);
      setPreviewUrls([]);
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="flex flex-col gap-2">
          <span className="form-label">
            반납 사진 <span className="form-label-optional">(필수)</span>
          </span>
          <div className="image-upload-area">
            {previewUrls.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {previewUrls.map((preview, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={preview}
                      alt={`반납 사진 ${index + 1}`}
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
                      {index + 1}/{previewUrls.length}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="image-upload-placeholder">
                반납 시 상태를 확인할 수 있도록 사진을 촬영해주세요.
              </div>
            )}
            <input
              name="return_images"
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              onChange={handleFileChange}
              className="image-upload-input"
              required
            />
          </div>
          <p className="text-xs text-neutral-500">
            여러 장의 사진을 선택할 수 있습니다. 반납 시 상태를 명확히 확인할 수 있도록 촬영해주세요.
          </p>
        </label>
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
        disabled={isSubmitting || returnImages.length === 0}
        className="btn-primary w-full"
      >
        {isSubmitting ? "반납 처리 중..." : "반납하기"}
      </button>
    </form>
  );
}
