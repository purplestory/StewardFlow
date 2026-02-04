"use client";

import { useEffect, useState } from "react";
import { useParams, notFound, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { isUUID } from "@/lib/short-id";
import type { Space } from "@/types/database";
import {
  listReservationsBySpace,
  type SpaceReservationSummary,
} from "@/actions/booking-actions";
import { listApprovalPoliciesByOrg } from "@/actions/approval-actions";
import SpaceReservationSection from "@/components/spaces/SpaceReservationSection";
import ImageSlider from "@/components/common/ImageSlider";

const statusLabel: Record<SpaceReservationSummary["status"], string> = {
  pending: "승인 대기",
  approved: "승인됨",
  returned: "반납 완료",
  rejected: "반려",
};

function resolveRequiredRole(
  policies: Array<{ department: string | null; required_role: string }>,
  ownerScope: "organization" | "department",
  department: string
): "admin" | "manager" | "user" {
  const targetDepartment = ownerScope === "organization" ? null : department;
  const exactPolicy = policies.find(
    (policy) => policy.department === targetDepartment
  );
  const fallbackPolicy = policies.find((policy) => policy.department === null);
  return (exactPolicy?.required_role ??
    fallbackPolicy?.required_role ??
    "manager") as "admin" | "manager" | "user";
}

export default function SpaceDetailClient() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [space, setSpace] = useState<Space | null>(null);
  const [reservations, setReservations] = useState<SpaceReservationSummary[]>([]);
  const [requiredRole, setRequiredRole] = useState<"admin" | "manager" | "user">("manager");
  const [userRole, setUserRole] = useState<"admin" | "manager" | "user" | null>(null);
  const [userDepartment, setUserDepartment] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadSpace = async () => {
      if (!id || typeof id !== "string") {
        if (isMounted) {
          setLoading(false);
        }
        return;
      }

      try {
        const supabaseClient = supabase;

        // Check if id is UUID or short_id
        const isUuid = isUUID(id);
        
        let query = supabaseClient
          .from("spaces")
          .select("*");
        
        if (isUuid) {
          query = query.eq("id", id);
        } else {
          query = query.eq("short_id", id);
        }
        
        const { data, error } = await query.maybeSingle();

        if (error) {
          console.error("Error fetching space:", error);
          // If short_id lookup failed and it's not a UUID, try UUID as fallback
          if (!isUuid) {
            const { data: fallbackData, error: fallbackError } = await supabaseClient
              .from("spaces")
              .select("*")
              .eq("id", id)
              .maybeSingle();
            
            if (!fallbackError && fallbackData) {
              if (isMounted) {
                setSpace(fallbackData as Space);
                // Load reservations and approval policies
                const res = await listReservationsBySpace(fallbackData.id);
                const policies = await listApprovalPoliciesByOrg(
                  "space",
                  fallbackData.organization_id
                );
                const role = resolveRequiredRole(
                  policies,
                  fallbackData.owner_scope,
                  fallbackData.owner_department
                );
                setReservations(res);
                setRequiredRole(role);
                
                // Load current user role and department
                const { data: sessionData } = await supabase.auth.getSession();
                const user = sessionData.session?.user;
                if (user) {
                  const { data: profileData } = await supabase
                    .from("profiles")
                    .select("role,department")
                    .eq("id", user.id)
                    .maybeSingle();
                  if (profileData?.role) {
                    setUserRole(profileData.role as "admin" | "manager" | "user");
                    setUserDepartment(profileData.department ?? null);
                  }
                }
                
                setLoading(false);
              }
              return;
            }
          }
          if (isMounted) {
            setLoading(false);
          }
          return;
        }

        if (!data) {
          if (isMounted) {
            setLoading(false);
          }
          return;
        }

        if (isMounted) {
          setSpace(data as Space);
          // Load reservations and approval policies
          const res = await listReservationsBySpace(data.id);
          const policies = await listApprovalPoliciesByOrg(
            "space",
            data.organization_id
          );
          const role = resolveRequiredRole(
            policies,
            data.owner_scope,
            data.owner_department
          );
          setReservations(res);
          setRequiredRole(role);
          
          // Load current user role and department
          const { data: sessionData } = await supabase.auth.getSession();
          const user = sessionData.session?.user;
          if (user) {
            const { data: profileData } = await supabase
              .from("profiles")
              .select("role,department")
              .eq("id", user.id)
              .maybeSingle();
            if (profileData?.role) {
              setUserRole(profileData.role as "admin" | "manager" | "user");
              setUserDepartment(profileData.department ?? null);
            }
          }
          
          setLoading(false);
        }
      } catch (error) {
        console.error("Error loading space:", error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadSpace();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <p className="text-center text-neutral-500">로딩 중...</p>
        </div>
      </section>
    );
  }

  if (!space) {
    notFound();
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-6 rounded-2xl border border-neutral-200 bg-white p-6 md:flex-row">
        {/* 이미지 섹션 - 모바일에서는 위에, 데스크톱에서는 왼쪽 */}
        <div className="w-full md:w-1/2">
          <ImageSlider
            images={
              (space.image_urls && space.image_urls.length > 0)
                ? space.image_urls
                : space.image_url
                ? [space.image_url]
                : []
            }
            alt={space.name}
          />
        </div>
        
        {/* 텍스트 정보 섹션 - 모바일에서는 아래에, 데스크톱에서는 오른쪽 */}
        <div className="w-full space-y-4 md:w-1/2">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold text-neutral-900">{space.name}</h1>
            {(() => {
              // Admin은 항상 수정 가능
              if (userRole === "admin") {
                return (
                  <Link
                    href={`/spaces/${space.short_id || space.id}/edit`}
                    className="btn-secondary"
                  >
                    수정
                  </Link>
                );
              }
              // Manager는 자신의 부서 소유이거나 기관 공용인 경우 수정 가능
              if (userRole === "manager") {
                const canEdit = 
                  space.owner_scope === "organization" ||
                  (space.owner_scope === "department" && space.owner_department === userDepartment);
                if (canEdit) {
                  return (
                    <Link
                      href={`/spaces/${space.short_id || space.id}/edit`}
                      className="btn-secondary"
                    >
                      수정
                    </Link>
                  );
                }
              }
              return null;
            })()}
          </div>
          
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-sm font-semibold text-neutral-700 min-w-[100px]">
                소유 부서
              </span>
              <span className="text-sm text-neutral-600">
                {space.owner_scope === "organization" ? "기관 공용" : space.owner_department}
              </span>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-sm font-semibold text-neutral-700 min-w-[100px]">
                위치
              </span>
              <span className="text-sm text-neutral-600">
                {space.location || "미등록"}
              </span>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-sm font-semibold text-neutral-700 min-w-[100px]">
                상태
              </span>
              <span className="text-sm text-neutral-600">
                {space.status === "available" ? "사용 가능" : 
                 space.status === "rented" ? "예약 중" :
                 space.status === "repair" ? "사용 불가" : "사용 불가"}
              </span>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-sm font-semibold text-neutral-700 min-w-[100px]">
                수용 인원
              </span>
              <span className="text-sm text-neutral-600">
                {space.capacity ?? "미등록"}
              </span>
            </div>
            
            {space.note && (
              <div className="flex items-start gap-3">
                <span className="text-sm font-semibold text-neutral-700 min-w-[100px]">
                  비고
                </span>
                <span className="text-sm text-neutral-600 whitespace-pre-wrap">
                  {space.note}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <SpaceReservationSection
        spaceId={space.id}
        reservations={reservations}
        spaceStatus={space.status}
        requiredRole={requiredRole}
      />
    </section>
  );
}
