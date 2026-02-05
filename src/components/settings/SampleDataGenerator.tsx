"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { generateShortId } from "@/lib/short-id";
import Notice from "@/components/common/Notice";

type SampleDataGeneratorProps = {
  organizationId: string;
  userId: string;
};

// 샘플 이미지 생성 함수 (제품명 기반 사실적인 이미지)
async function generateSampleImage(
  productName: string,
  category: string,
  backgroundColor: string,
  textColor: string = "#ffffff",
  gradient?: [string, string]
): Promise<File> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      reject(new Error("Canvas context를 가져올 수 없습니다."));
      return;
    }

    // 그라데이션 배경
    if (gradient) {
      const gradientObj = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradientObj.addColorStop(0, gradient[0]);
      gradientObj.addColorStop(1, gradient[1]);
      ctx.fillStyle = gradientObj;
    } else {
      ctx.fillStyle = backgroundColor;
    }
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 그림자 효과를 위한 패턴 추가
    ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const radius = Math.random() * 30 + 10;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // 제품명 텍스트 스타일 (더 크고 굵게)
    ctx.fillStyle = textColor;
    ctx.font = "bold 64px 'Arial', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    // 텍스트 그림자
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;

    // 제품명 그리기 (긴 경우 줄바꿈)
    const maxWidth = canvas.width - 100;
    const words = productName.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    words.forEach((word) => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });
    if (currentLine) {
      lines.push(currentLine);
    }

    const lineHeight = 80;
    const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;

    lines.forEach((line, index) => {
      ctx.fillText(line, canvas.width / 2, startY + index * lineHeight);
    });

    // 카테고리 라벨 (작은 텍스트로)
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.font = "24px 'Arial', sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    
    const categoryLabels: Record<string, string> = {
      sound: "음향 장비",
      video: "영상 장비",
      etc: "기타 물품",
      worship: "예배 공간",
      meeting: "모임 공간",
      classroom: "교육 공간",
      sedan: "승용차",
      suv: "SUV",
      van: "승합차",
    };
    
    const categoryLabel = categoryLabels[category] || "물품";
    ctx.fillText(categoryLabel, canvas.width / 2, canvas.height - 50);

    // Canvas를 Blob으로 변환
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("이미지 생성에 실패했습니다."));
          return;
        }
        const file = new File([blob], `${productName.replace(/\s+/g, "-")}.png`, {
          type: "image/png",
        });
        resolve(file);
      },
      "image/png",
      0.95
    );
  });
}

// 카테고리별 색상 및 텍스트 매핑
const categoryImageConfig: Record<
  string,
  { bgColor: string; textColor: string; gradient?: [string, string] }
> = {
  sound: {
    bgColor: "#3498db",
    textColor: "#ffffff",
    gradient: ["#3498db", "#2980b9"],
  },
  video: {
    bgColor: "#e74c3c",
    textColor: "#ffffff",
    gradient: ["#e74c3c", "#c0392b"],
  },
  etc: {
    bgColor: "#95a5a6",
    textColor: "#ffffff",
    gradient: ["#95a5a6", "#7f8c8d"],
  },
  worship: {
    bgColor: "#9b59b6",
    textColor: "#ffffff",
    gradient: ["#9b59b6", "#8e44ad"],
  },
  meeting: {
    bgColor: "#f39c12",
    textColor: "#ffffff",
    gradient: ["#f39c12", "#e67e22"],
  },
  classroom: {
    bgColor: "#1abc9c",
    textColor: "#ffffff",
    gradient: ["#1abc9c", "#16a085"],
  },
  sedan: {
    bgColor: "#34495e",
    textColor: "#ffffff",
    gradient: ["#34495e", "#2c3e50"],
  },
  suv: {
    bgColor: "#27ae60",
    textColor: "#ffffff",
    gradient: ["#27ae60", "#229954"],
  },
  van: {
    bgColor: "#e67e22",
    textColor: "#ffffff",
    gradient: ["#e67e22", "#d35400"],
  },
};

// 샘플 데이터 이름 목록
const SAMPLE_DEPARTMENT_NAMES = ["유년부", "청년부", "주일학교", "찬양팀"];
const SAMPLE_ASSET_NAMES = [
  "무선 마이크 세트",
  "프로젝터",
  "스피커 시스템",
  "노트북",
  "카메라",
];
const SAMPLE_SPACE_NAMES = ["본당", "비전홀", "교육관 2층", "유년부실"];
const SAMPLE_VEHICLE_NAMES = ["교회 승용차", "교회 승합차", "교회 SUV"];

// Storage URL에서 파일 경로 추출
function extractFilePathFromUrl(url: string): string | null {
  try {
    // Supabase Storage URL 형식: https://[project].supabase.co/storage/v1/object/public/asset-images/path/to/file.png
    const match = url.match(/\/asset-images\/(.+)$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export default function SampleDataGenerator({
  organizationId,
  userId,
}: SampleDataGeneratorProps) {
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const generateSampleData = async () => {
    setGenerating(true);
    setMessage(null);

    // 디버깅: organizationId와 userId 확인
    console.log("샘플 데이터 생성 시작:", {
      organizationId,
      userId,
      hasOrganizationId: !!organizationId,
      hasUserId: !!userId,
    });

    if (!organizationId) {
      setMessage("기관 ID가 없습니다. 기관 설정을 먼저 완료해주세요.");
      setGenerating(false);
      return;
    }

    if (!userId) {
      setMessage("사용자 ID가 없습니다. 로그인 상태를 확인해주세요.");
      setGenerating(false);
      return;
    }

    // 사용자 역할 확인
    const { data: profileData } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    const userRole = profileData?.role;
    console.log("사용자 역할:", userRole);

    if (userRole !== "admin" && userRole !== "manager") {
      setMessage("샘플 데이터 생성은 관리자 또는 부서 관리자만 가능합니다.");
      setGenerating(false);
      return;
    }

    try {
      // 1. 샘플 부서 생성
      const sampleDepartments = [
        { name: "유년부", description: "유년부 사역" },
        { name: "청년부", description: "청년부 사역" },
        { name: "주일학교", description: "주일학교 사역" },
        { name: "찬양팀", description: "찬양 사역" },
      ];

      const departmentMap = new Map<string, string>();

      for (const dept of sampleDepartments) {
        const { data, error } = await supabase
          .from("departments")
          .insert({
            organization_id: organizationId,
            name: dept.name,
            description: dept.description,
          })
          .select("id,name")
          .maybeSingle();

        if (!error && data) {
          departmentMap.set(dept.name, data.id);
        }
      }

      // 2. 샘플 물품 생성 (이미지 포함)
      const sampleAssets = [
        {
          name: "무선 마이크 세트",
          category: "sound",
          owner_scope: "department" as const,
          owner_department: "찬양팀",
          location: "본당 무대",
          quantity: 4,
          purchase_price: 350000,
          mobility: "movable" as const,
          loanable: true,
          tags: ["음향", "행사"],
        },
        {
          name: "프로젝터",
          category: "video",
          owner_scope: "organization" as const,
          owner_department: "기관 공용",
          location: "교육관 2층",
          quantity: 2,
          purchase_price: 1200000,
          mobility: "movable" as const,
          loanable: true,
          tags: ["영상", "교육"],
        },
        {
          name: "스피커 시스템",
          category: "sound",
          owner_scope: "organization" as const,
          owner_department: "기관 공용",
          location: "본당",
          quantity: 1,
          purchase_price: 2500000,
          mobility: "fixed" as const,
          loanable: false,
          tags: ["음향", "고정"],
        },
        {
          name: "노트북",
          category: "etc",
          owner_scope: "department" as const,
          owner_department: "청년부",
          location: "청년부실",
          quantity: 2,
          purchase_price: 1500000,
          mobility: "movable" as const,
          loanable: true,
          tags: ["IT", "교육"],
        },
        {
          name: "카메라",
          category: "video",
          owner_scope: "department" as const,
          owner_department: "주일학교",
          location: "주일학교 사무실",
          quantity: 1,
          purchase_price: 800000,
          mobility: "movable" as const,
          loanable: true,
          tags: ["영상", "기록"],
        },
      ];

      for (const asset of sampleAssets) {
        let imageUrl: string | null = null;

        // 카테고리에 맞는 샘플 이미지 생성 및 업로드
        const imageConfig = categoryImageConfig[asset.category];
        if (imageConfig) {
          try {
            const imageFile = await generateSampleImage(
              asset.name,
              asset.category,
              imageConfig.bgColor,
              imageConfig.textColor,
              imageConfig.gradient
            );
            
            // 파일 크기 확인
            if (imageFile.size === 0) {
              console.warn(`이미지 파일 크기가 0입니다 (${asset.name})`);
            } else {
              const fileExt = "png";
              const filePath = `assets/${Date.now()}-${crypto.randomUUID()}.${fileExt}`;

              console.log(`이미지 업로드 시도 (${asset.name}):`, {
                fileSize: imageFile.size,
                filePath,
                fileType: imageFile.type,
              });

              // 세션 확인
              const { data: sessionData } = await supabase.auth.getSession();
              if (!sessionData.session) {
                console.error(`이미지 업로드 실패 (${asset.name}): 세션이 없습니다.`);
                continue;
              }

              const { error: uploadError, data: uploadData } = await supabase.storage
                .from("asset-images")
                .upload(filePath, imageFile, {
                  cacheControl: "3600",
                  upsert: false,
                  contentType: "image/png",
                });

              if (uploadError) {
                console.error(`이미지 업로드 실패 (${asset.name}):`, {
                  error: uploadError,
                  message: uploadError.message || "알 수 없는 오류",
                  statusCode: uploadError.statusCode || "N/A",
                  name: uploadError.name || "N/A",
                  stack: uploadError.stack || "N/A",
                });
                // 에러 상세 정보를 문자열로 변환
                const errorDetails = JSON.stringify(uploadError, Object.getOwnPropertyNames(uploadError));
                console.error(`에러 상세 정보:`, errorDetails);
              } else if (uploadData) {
                const { data: urlData } = supabase.storage
                  .from("asset-images")
                  .getPublicUrl(filePath);
                imageUrl = urlData?.publicUrl || null;
                console.log(`이미지 업로드 성공 (${asset.name}):`, imageUrl);
              } else {
                console.warn(`이미지 업로드 데이터 없음 (${asset.name})`);
              }
            }
          } catch (error) {
            console.error(`이미지 생성/업로드 실패 (${asset.name}):`, error);
            // 이미지 생성 실패해도 계속 진행
          }
        }

        const { error: assetInsertError } = await supabase.from("assets").insert({
          organization_id: organizationId,
          short_id: generateShortId(8),
          name: asset.name,
          image_url: imageUrl,
          category: asset.category,
          owner_scope: asset.owner_scope,
          owner_department: asset.owner_department,
          location: asset.location,
          quantity: asset.quantity,
          purchase_price: asset.purchase_price,
          mobility: asset.mobility,
          loanable: asset.loanable,
          tags: asset.tags,
          status: "available",
        });
      }

      // 3. 샘플 공간 생성 (이미지 포함)
      const sampleSpaces = [
        {
          name: "본당",
          category: "worship",
          owner_scope: "organization" as const,
          owner_department: "기관 공용",
          managed_by_department: "찬양팀",
          location: "1층",
          capacity: 200,
          note: "주일 예배 및 특별 집회",
        },
        {
          name: "비전홀",
          category: "meeting",
          owner_scope: "organization" as const,
          owner_department: "기관 공용",
          managed_by_department: "청년부",
          location: "지하 1층",
          capacity: 80,
          note: "청년부 모임 및 소그룹 모임",
        },
        {
          name: "교육관 2층",
          category: "classroom",
          owner_scope: "organization" as const,
          owner_department: "기관 공용",
          managed_by_department: "주일학교",
          location: "교육관 2층",
          capacity: 50,
          note: "주일학교 교실",
        },
        {
          name: "유년부실",
          category: "classroom",
          owner_scope: "organization" as const,
          owner_department: "기관 공용",
          managed_by_department: "유년부",
          location: "교육관 1층",
          capacity: 30,
          note: "유년부 모임 공간",
        },
      ];

      for (const space of sampleSpaces) {
        let imageUrl: string | null = null;

        // 카테고리에 맞는 샘플 이미지 생성 및 업로드
        const imageConfig = categoryImageConfig[space.category];
        if (imageConfig) {
          try {
            const imageFile = await generateSampleImage(
              space.name,
              space.category,
              imageConfig.bgColor,
              imageConfig.textColor,
              imageConfig.gradient
            );
            
            // 파일 크기 확인
            if (imageFile.size === 0) {
              console.warn(`이미지 파일 크기가 0입니다 (${space.name})`);
            } else {
              const fileExt = "png";
              const filePath = `spaces/${Date.now()}-${crypto.randomUUID()}.${fileExt}`;

              console.log(`이미지 업로드 시도 (${space.name}):`, {
                fileSize: imageFile.size,
                filePath,
                fileType: imageFile.type,
              });

              // 세션 확인
              const { data: sessionData } = await supabase.auth.getSession();
              if (!sessionData.session) {
                console.error(`이미지 업로드 실패 (${space.name}): 세션이 없습니다.`);
                continue;
              }

              const { error: uploadError, data: uploadData } = await supabase.storage
                .from("asset-images")
                .upload(filePath, imageFile, {
                  cacheControl: "3600",
                  upsert: false,
                  contentType: "image/png",
                });

              if (uploadError) {
                console.error(`이미지 업로드 실패 (${space.name}):`, {
                  error: uploadError,
                  message: uploadError.message || "알 수 없는 오류",
                  statusCode: uploadError.statusCode || "N/A",
                  name: uploadError.name || "N/A",
                  stack: uploadError.stack || "N/A",
                });
                // 에러 상세 정보를 문자열로 변환
                const errorDetails = JSON.stringify(uploadError, Object.getOwnPropertyNames(uploadError));
                console.error(`에러 상세 정보:`, errorDetails);
              } else if (uploadData) {
                const { data: urlData } = supabase.storage
                  .from("asset-images")
                  .getPublicUrl(filePath);
                imageUrl = urlData?.publicUrl || null;
                console.log(`이미지 업로드 성공 (${space.name}):`, imageUrl);
              } else {
                console.warn(`이미지 업로드 데이터 없음 (${space.name})`);
              }
            }
          } catch (error) {
            console.error(`이미지 생성/업로드 실패 (${space.name}):`, error);
            // 이미지 생성 실패해도 계속 진행
          }
        }

        const { error: spaceInsertError } = await supabase.from("spaces").insert({
          organization_id: organizationId,
          short_id: generateShortId(8),
          name: space.name,
          image_url: imageUrl,
          category: space.category,
          owner_scope: space.owner_scope,
          owner_department: space.owner_department,
          managed_by_department: space.managed_by_department,
          location: space.location,
          capacity: space.capacity,
          note: space.note,
          status: "available",
        });
        
        if (spaceInsertError) {
          console.error(`공간 삽입 실패 (${space.name}):`, spaceInsertError);
        }
      }

      // 4. 샘플 차량 생성 (이미지 포함)
      const sampleVehicles = [
        {
          name: "교회 승용차",
          category: "sedan",
          owner_scope: "organization" as const,
          owner_department: "기관 공용",
          managed_by_department: "청년부",
          location: "교회 주차장",
          license_plate: "12가3456",
          vehicle_type: "승용차",
          fuel_type: "가솔린",
          capacity: 5,
          current_odometer: 45000,
          note: "일반 업무용 차량",
        },
        {
          name: "교회 승합차",
          category: "van",
          owner_scope: "organization" as const,
          owner_department: "기관 공용",
          managed_by_department: "유년부",
          location: "교회 주차장",
          license_plate: "34나7890",
          vehicle_type: "승합차",
          fuel_type: "디젤",
          capacity: 12,
          current_odometer: 78000,
          note: "행사 및 단체 이동용",
        },
        {
          name: "교회 SUV",
          category: "suv",
          owner_scope: "organization" as const,
          owner_department: "기관 공용",
          managed_by_department: "주일학교",
          location: "교회 주차장",
          license_plate: "56다1234",
          vehicle_type: "SUV",
          fuel_type: "가솔린",
          capacity: 7,
          current_odometer: 32000,
          note: "야외 행사 및 캠프용",
        },
      ];

      let successfulVehicles = 0;
      let failedVehicles = 0;
      
      // 사용자 역할 다시 확인 (스코프 문제 해결)
      const { data: currentProfileData } = await supabase
        .from("profiles")
        .select("role,organization_id")
        .eq("id", userId)
        .maybeSingle();
      
      const currentUserRole = currentProfileData?.role;
      const currentOrgId = currentProfileData?.organization_id;
      
      console.log("차량 샘플 데이터 생성 시작:", {
        organizationId,
        userId,
        currentUserRole,
        currentOrgId,
        orgIdMatch: organizationId === currentOrgId,
        vehicleCount: sampleVehicles.length,
      });
      
      if (currentUserRole !== "admin" && currentUserRole !== "manager") {
        console.error("차량 삽입 실패: 사용자 역할이 admin 또는 manager가 아닙니다.", {
          currentUserRole,
          required: ["admin", "manager"],
        });
        setMessage("차량 삽입 실패: 관리자 또는 부서 관리자 권한이 필요합니다.");
        setGenerating(false);
        return;
      }
      
      if (organizationId !== currentOrgId) {
        console.error("차량 삽입 실패: organization_id가 일치하지 않습니다.", {
          providedOrgId: organizationId,
          userOrgId: currentOrgId,
        });
        setMessage("차량 삽입 실패: 기관 ID가 일치하지 않습니다.");
        setGenerating(false);
        return;
      }

      for (const vehicle of sampleVehicles) {
        console.log(`차량 생성 시도: ${vehicle.name}`);
        let imageUrl: string | null = null;

        // 카테고리에 맞는 샘플 이미지 생성 및 업로드
        const imageConfig = categoryImageConfig[vehicle.category];
        if (imageConfig) {
          try {
            const imageFile = await generateSampleImage(
              vehicle.name,
              vehicle.category,
              imageConfig.bgColor,
              imageConfig.textColor,
              imageConfig.gradient
            );
            
            // 파일 크기 확인
            if (imageFile.size === 0) {
              console.warn(`이미지 파일 크기가 0입니다 (${vehicle.name})`);
            } else {
              const fileExt = "png";
              const filePath = `vehicles/${Date.now()}-${crypto.randomUUID()}.${fileExt}`;

              console.log(`이미지 업로드 시도 (${vehicle.name}):`, {
                fileSize: imageFile.size,
                filePath,
                fileType: imageFile.type,
              });

              // 세션 확인
              const { data: sessionData } = await supabase.auth.getSession();
              if (!sessionData.session) {
                console.error(`이미지 업로드 실패 (${vehicle.name}): 세션이 없습니다.`);
                continue;
              }

              const { error: uploadError, data: uploadData } = await supabase.storage
                .from("asset-images")
                .upload(filePath, imageFile, {
                  cacheControl: "3600",
                  upsert: false,
                  contentType: "image/png",
                });

              if (uploadError) {
                console.error(`이미지 업로드 실패 (${vehicle.name}):`, {
                  error: uploadError,
                  message: uploadError.message || "알 수 없는 오류",
                  statusCode: uploadError.statusCode || "N/A",
                  name: uploadError.name || "N/A",
                  stack: uploadError.stack || "N/A",
                });
                // 에러 상세 정보를 문자열로 변환
                const errorDetails = JSON.stringify(uploadError, Object.getOwnPropertyNames(uploadError));
                console.error(`에러 상세 정보:`, errorDetails);
              } else if (uploadData) {
                const { data: urlData } = supabase.storage
                  .from("asset-images")
                  .getPublicUrl(filePath);
                imageUrl = urlData?.publicUrl || null;
                console.log(`이미지 업로드 성공 (${vehicle.name}):`, imageUrl);
              } else {
                console.warn(`이미지 업로드 데이터 없음 (${vehicle.name})`);
              }
            }
          } catch (error) {
            console.error(`이미지 생성/업로드 실패 (${vehicle.name}):`, error);
            // 이미지 생성 실패해도 계속 진행
          }
        }

        // 삽입할 데이터 준비
        // current_odometer 컬럼이 없을 수 있으므로 조건부로 포함
        const vehicleData: any = {
          organization_id: organizationId,
          short_id: generateShortId(8),
          name: vehicle.name,
          image_url: imageUrl,
          category: vehicle.category,
          owner_scope: vehicle.owner_scope,
          owner_department: vehicle.owner_department,
          managed_by_department: vehicle.managed_by_department,
          location: vehicle.location,
          license_plate: vehicle.license_plate,
          vehicle_type: vehicle.vehicle_type,
          fuel_type: vehicle.fuel_type,
          capacity: vehicle.capacity,
          note: vehicle.note,
          status: "available",
        };
        
        // current_odometer는 마이그레이션이 실행된 경우에만 포함
        // 마이그레이션 20260205_add_odometer_fields.sql이 실행되었는지 확인 필요
        // 일단 제외하고, 마이그레이션 실행 후 활성화
        // vehicleData.current_odometer = vehicle.current_odometer;
        
        console.log(`차량 삽입 시도 (${vehicle.name}):`, {
          vehicleData,
          organizationId,
          userId,
          currentUserRole,
          currentOrgId,
        });
        
        // 세션 확인
        const { data: sessionData } = await supabase.auth.getSession();
        console.log("현재 세션:", {
          hasSession: !!sessionData.session,
          userId: sessionData.session?.user?.id,
          sessionUserId: sessionData.session?.user?.id,
          providedUserId: userId,
          userIdMatch: sessionData.session?.user?.id === userId,
        });
        
        let vehicleInsertError: any = null;
        let vehicleInsertData: any = null;
        
        try {
          const result = await supabase
            .from("vehicles")
            .insert(vehicleData)
            .select();
          
          vehicleInsertError = result.error;
          vehicleInsertData = result.data;
          
          console.log(`차량 삽입 결과 (${vehicle.name}):`, {
            hasError: !!vehicleInsertError,
            error: vehicleInsertError,
            hasData: !!vehicleInsertData,
            data: vehicleInsertData,
            resultKeys: Object.keys(result),
          });
        } catch (exception) {
          const error = exception as Error;
          console.error(`차량 삽입 예외 발생 (${vehicle.name}):`, {
            exception,
            exceptionType: typeof exception,
            exceptionName: error?.constructor?.name,
            exceptionMessage: error?.message,
            exceptionStack: error?.stack,
            stringified: JSON.stringify(exception, Object.getOwnPropertyNames(exception)),
          });
          vehicleInsertError = exception;
        }
        
        // 에러 객체의 모든 속성 확인
        let errorDetails: any = null;
        if (vehicleInsertError) {
          try {
            // Supabase PostgrestError의 모든 속성 확인
            const error = vehicleInsertError as any;
            errorDetails = {
              message: error.message,
              details: error.details,
              hint: error.hint,
              code: error.code,
              name: error.name,
              status: error.status,
              statusCode: error.statusCode,
              allKeys: Object.keys(error),
              allPropertyNames: Object.getOwnPropertyNames(error),
              stringified: JSON.stringify(error, Object.getOwnPropertyNames(error)),
              toString: String(error),
            };
          } catch (e) {
            errorDetails = {
              raw: String(vehicleInsertError),
              stringError: String(e),
              errorType: typeof vehicleInsertError,
            };
          }
          
          console.error(`차량 삽입 에러 상세 (${vehicle.name}):`, errorDetails);
        }

        if (vehicleInsertError) {
          // 에러 객체의 모든 속성을 확인
          const errorInfo: any = {
            error: vehicleInsertError,
            message: vehicleInsertError?.message || "메시지 없음",
            details: vehicleInsertError?.details || "상세 없음",
            hint: vehicleInsertError?.hint || "힌트 없음",
            code: vehicleInsertError?.code || "코드 없음",
          };
          
          // 에러 객체의 모든 속성을 문자열로 변환
          try {
            errorInfo.fullError = JSON.stringify(vehicleInsertError, Object.getOwnPropertyNames(vehicleInsertError));
          } catch (e) {
            errorInfo.fullError = String(vehicleInsertError);
          }
          
          console.error(`차량 삽입 실패 (${vehicle.name}):`, errorInfo);
          
          // RLS 정책 위반 가능성 체크
          if (vehicleInsertError?.code === "42501" || vehicleInsertError?.message?.includes("row-level security")) {
            console.error("RLS 정책 위반 가능성: 차량 삽입은 admin 또는 manager 역할이 필요합니다.");
          }
          
          failedVehicles++;
          // 에러가 발생해도 나머지 차량은 계속 생성 시도
        } else if (vehicleInsertData && vehicleInsertData.length > 0) {
          console.log(`차량 삽입 성공 (${vehicle.name}):`, vehicleInsertData[0].id);
          successfulVehicles++;
        } else {
          console.warn(`차량 삽입 데이터 없음 (${vehicle.name})`);
          failedVehicles++;
        }
      }
      
      console.log(`차량 생성 완료: 성공 ${successfulVehicles}개, 실패 ${failedVehicles}개`);
      
      if (failedVehicles > 0) {
        console.warn(`일부 차량 생성 실패: ${failedVehicles}개 실패, ${successfulVehicles}개 성공`);
      }

      // 5. 감사 로그 기록
      await supabase.from("audit_logs").insert({
        organization_id: organizationId,
        actor_id: userId,
        action: "sample_data_generated",
        target_type: "organization",
        metadata: {
          departments: sampleDepartments.length,
          assets: sampleAssets.length,
          spaces: sampleSpaces.length,
          vehicles: sampleVehicles.length,
        },
      });

      const vehicleMessage = successfulVehicles > 0 
        ? `차량 ${successfulVehicles}개` 
        : failedVehicles > 0 
        ? `차량 생성 실패 (${failedVehicles}개)` 
        : `차량 ${sampleVehicles.length}개`;
      
      setMessage(
        `샘플 데이터가 생성되었습니다: 부서 ${sampleDepartments.length}개, 물품 ${sampleAssets.length}개, 공간 ${sampleSpaces.length}개, ${vehicleMessage}`
      );
    } catch (error) {
      console.error("Sample data generation error:", error);
      setMessage(
        `샘플 데이터 생성 중 오류가 발생했습니다: ${
          error instanceof Error ? error.message : "알 수 없는 오류"
        }`
      );
    } finally {
      setGenerating(false);
    }
  };

  const deleteSampleData = async () => {
    if (
      !confirm(
        "샘플 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
      )
    ) {
      return;
    }

    setDeleting(true);
    setMessage(null);

    try {
      let deletedCount = {
        departments: 0,
        assets: 0,
        spaces: 0,
        vehicles: 0,
        images: 0,
      };

      // 1. 샘플 물품 삭제 (이미지 포함)
      // 먼저 모든 매칭되는 물품 조회
      const { data: assets, error: selectAssetsError } = await supabase
        .from("assets")
        .select("id, name, image_url")
        .eq("organization_id", organizationId)
        .in("name", SAMPLE_ASSET_NAMES);

      if (selectAssetsError) {
        console.error("Error selecting assets:", selectAssetsError);
        setMessage(
          `물품 조회 중 오류가 발생했습니다: ${selectAssetsError.message}`
        );
      } else if (assets && assets.length > 0) {
        // 이미지 파일 삭제
        const imagePaths: string[] = [];
        for (const asset of assets) {
          if (asset.image_url) {
            const filePath = extractFilePathFromUrl(asset.image_url);
            if (filePath) {
              imagePaths.push(filePath);
            }
          }
        }

        if (imagePaths.length > 0) {
          const { error: deleteImageError } = await supabase.storage
            .from("asset-images")
            .remove(imagePaths);

          if (!deleteImageError) {
            deletedCount.images += imagePaths.length;
            console.log(`이미지 삭제 성공: ${imagePaths.length}개`);
          } else {
            console.warn("Error deleting images:", deleteImageError);
          }
        }

        // 물품 삭제 (count 반환받기)
        const { error: deleteAssetsError, count: deletedAssetsCount } =
          await supabase
            .from("assets")
            .delete({ count: "exact" })
            .eq("organization_id", organizationId)
            .in("name", SAMPLE_ASSET_NAMES);

        if (deleteAssetsError) {
          console.error("Error deleting assets:", deleteAssetsError);
          setMessage(
            `물품 삭제 중 오류가 발생했습니다: ${deleteAssetsError.message} (코드: ${deleteAssetsError.code})`
          );
        } else if (deletedAssetsCount !== null) {
          deletedCount.assets = deletedAssetsCount;
          console.log(`물품 삭제 성공: ${deletedAssetsCount}개`);
        }
      } else {
        console.log("삭제할 샘플 물품이 없습니다.");
      }

      // 2. 샘플 공간 삭제 (이미지 포함)
      const { data: spaces, error: selectSpacesError } = await supabase
        .from("spaces")
        .select("id, name, image_url")
        .eq("organization_id", organizationId)
        .in("name", SAMPLE_SPACE_NAMES);

      if (selectSpacesError) {
        console.error("Error selecting spaces:", selectSpacesError);
        setMessage(
          `공간 조회 중 오류가 발생했습니다: ${selectSpacesError.message}`
        );
      } else if (spaces && spaces.length > 0) {
        // 이미지 파일 삭제
        const imagePaths: string[] = [];
        for (const space of spaces) {
          if (space.image_url) {
            const filePath = extractFilePathFromUrl(space.image_url);
            if (filePath) {
              imagePaths.push(filePath);
            }
          }
        }

        if (imagePaths.length > 0) {
          const { error: deleteImageError } = await supabase.storage
            .from("asset-images")
            .remove(imagePaths);

          if (!deleteImageError) {
            deletedCount.images += imagePaths.length;
            console.log(`이미지 삭제 성공: ${imagePaths.length}개`);
          } else {
            console.warn("Error deleting images:", deleteImageError);
          }
        }

        // 공간 삭제 (count 반환받기)
        const { error: deleteSpacesError, count: deletedSpacesCount } =
          await supabase
            .from("spaces")
            .delete({ count: "exact" })
            .eq("organization_id", organizationId)
            .in("name", SAMPLE_SPACE_NAMES);

        if (deleteSpacesError) {
          console.error("Error deleting spaces:", deleteSpacesError);
          setMessage(
            `공간 삭제 중 오류가 발생했습니다: ${deleteSpacesError.message} (코드: ${deleteSpacesError.code})`
          );
        } else if (deletedSpacesCount !== null) {
          deletedCount.spaces = deletedSpacesCount;
          console.log(`공간 삭제 성공: ${deletedSpacesCount}개`);
        }
      } else {
        console.log("삭제할 샘플 공간이 없습니다.");
      }

      // 3. 샘플 차량 삭제 (이미지 포함)
      const { data: vehicles, error: selectVehiclesError } = await supabase
        .from("vehicles")
        .select("id, name, image_url")
        .eq("organization_id", organizationId)
        .in("name", SAMPLE_VEHICLE_NAMES);

      if (selectVehiclesError) {
        console.error("Error selecting vehicles:", selectVehiclesError);
        setMessage(
          `차량 조회 중 오류가 발생했습니다: ${selectVehiclesError.message}`
        );
      } else if (vehicles && vehicles.length > 0) {
        // 이미지 파일 삭제
        const imagePaths: string[] = [];
        for (const vehicle of vehicles) {
          if (vehicle.image_url) {
            const filePath = extractFilePathFromUrl(vehicle.image_url);
            if (filePath) {
              imagePaths.push(filePath);
            }
          }
        }

        if (imagePaths.length > 0) {
          const { error: deleteImageError } = await supabase.storage
            .from("asset-images")
            .remove(imagePaths);

          if (!deleteImageError) {
            deletedCount.images += imagePaths.length;
            console.log(`이미지 삭제 성공: ${imagePaths.length}개`);
          } else {
            console.warn("Error deleting images:", deleteImageError);
          }
        }

        // 차량 삭제 (count 반환받기)
        const { error: deleteVehiclesError, count: deletedVehiclesCount } =
          await supabase
            .from("vehicles")
            .delete({ count: "exact" })
            .eq("organization_id", organizationId)
            .in("name", SAMPLE_VEHICLE_NAMES);

        if (deleteVehiclesError) {
          console.error("Error deleting vehicles:", deleteVehiclesError);
          setMessage(
            `차량 삭제 중 오류가 발생했습니다: ${deleteVehiclesError.message} (코드: ${deleteVehiclesError.code})`
          );
        } else if (deletedVehiclesCount !== null) {
          deletedCount.vehicles = deletedVehiclesCount;
          console.log(`차량 삭제 성공: ${deletedVehiclesCount}개`);
        }
      } else {
        console.log("삭제할 샘플 차량이 없습니다.");
        deletedCount.vehicles = 0; // 차량이 없을 때도 0으로 명시적으로 설정
      }

      // 4. 샘플 부서 삭제
      const { error: deleteDeptsError, count: deletedDeptsCount } =
        await supabase
          .from("departments")
          .delete({ count: "exact" })
          .eq("organization_id", organizationId)
          .in("name", SAMPLE_DEPARTMENT_NAMES);

      if (deleteDeptsError) {
        console.error("Error deleting departments:", deleteDeptsError);
        setMessage(
          `부서 삭제 중 오류가 발생했습니다: ${deleteDeptsError.message} (코드: ${deleteDeptsError.code})`
        );
      } else if (deletedDeptsCount !== null) {
        deletedCount.departments = deletedDeptsCount;
        console.log(`부서 삭제 성공: ${deletedDeptsCount}개`);
      } else {
        console.log("삭제할 샘플 부서가 없습니다.");
      }

      // 4. 삭제 후 확인 - 실제로 삭제되었는지 재조회
      const { data: remainingAssets } = await supabase
        .from("assets")
        .select("id")
        .eq("organization_id", organizationId)
        .in("name", SAMPLE_ASSET_NAMES)
        .limit(1);

      const { data: remainingSpaces } = await supabase
        .from("spaces")
        .select("id")
        .eq("organization_id", organizationId)
        .in("name", SAMPLE_SPACE_NAMES)
        .limit(1);

      const { data: remainingVehicles } = await supabase
        .from("vehicles")
        .select("id")
        .eq("organization_id", organizationId)
        .in("name", SAMPLE_VEHICLE_NAMES)
        .limit(1);

      const { data: remainingDepts } = await supabase
        .from("departments")
        .select("id")
        .eq("organization_id", organizationId)
        .in("name", SAMPLE_DEPARTMENT_NAMES)
        .limit(1);

      if (remainingAssets && remainingAssets.length > 0) {
        setMessage(
          `일부 물품이 삭제되지 않았습니다. 페이지를 새로고침한 후 다시 시도해주세요. (삭제됨: 부서 ${deletedCount.departments}개, 물품 ${deletedCount.assets}개, 공간 ${deletedCount.spaces}개)`
        );
      } else if (remainingSpaces && remainingSpaces.length > 0) {
        setMessage(
          `일부 공간이 삭제되지 않았습니다. 페이지를 새로고침한 후 다시 시도해주세요. (삭제됨: 부서 ${deletedCount.departments}개, 물품 ${deletedCount.assets}개, 공간 ${deletedCount.spaces}개, 차량 ${deletedCount.vehicles}개)`
        );
      } else if (remainingVehicles && remainingVehicles.length > 0) {
        setMessage(
          `일부 차량이 삭제되지 않았습니다. 페이지를 새로고침한 후 다시 시도해주세요. (삭제됨: 부서 ${deletedCount.departments}개, 물품 ${deletedCount.assets}개, 공간 ${deletedCount.spaces}개, 차량 ${deletedCount.vehicles}개)`
        );
      } else if (remainingDepts && remainingDepts.length > 0) {
        setMessage(
          `일부 부서가 삭제되지 않았습니다. 페이지를 새로고침한 후 다시 시도해주세요. (삭제됨: 부서 ${deletedCount.departments}개, 물품 ${deletedCount.assets}개, 공간 ${deletedCount.spaces}개, 차량 ${deletedCount.vehicles}개)`
        );
      } else {
        // 5. 감사 로그 기록
        await supabase.from("audit_logs").insert({
          organization_id: organizationId,
          actor_id: userId,
          action: "sample_data_deleted",
          target_type: "organization",
          metadata: {
            departments: deletedCount.departments,
            assets: deletedCount.assets,
            spaces: deletedCount.spaces,
            vehicles: deletedCount.vehicles,
            images: deletedCount.images,
          },
        });

        setMessage(
          `샘플 데이터가 삭제되었습니다: 부서 ${deletedCount.departments}개, 물품 ${deletedCount.assets}개, 공간 ${deletedCount.spaces}개, 차량 ${deletedCount.vehicles}개, 이미지 ${deletedCount.images}개`
        );
      }
    } catch (error) {
      console.error("Sample data deletion error:", error);
      setMessage(
        `샘플 데이터 삭제 중 오류가 발생했습니다: ${
          error instanceof Error ? error.message : "알 수 없는 오류"
        }`
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">샘플 데이터 생성</h3>
        <p className="text-sm text-neutral-600">
          서비스를 테스트할 수 있도록 샘플 부서, 물품, 공간을 자동으로 생성합니다.
        </p>
      </div>

      {message && (
        <Notice
          variant={message.includes("오류") ? "warning" : "neutral"}
          className="mb-4 text-left"
        >
          {message}
        </Notice>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={generateSampleData}
          disabled={generating || deleting}
          className="btn-primary w-full sm:flex-1"
        >
          {generating ? "생성 중..." : "샘플 데이터 생성"}
        </button>
        <button
          type="button"
          onClick={deleteSampleData}
          disabled={generating || deleting}
          className="h-10 w-full sm:flex-1 rounded-lg text-sm font-medium transition-all bg-white text-red-600 border border-red-300 hover:bg-red-50 hover:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white whitespace-nowrap flex items-center justify-center"
        >
          {deleting ? "삭제 중..." : "샘플 데이터 삭제"}
        </button>
      </div>

      <div className="mt-4 text-xs text-neutral-500">
        <p className="font-medium mb-1">생성되는 샘플 데이터:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>부서: 유년부, 청년부, 주일학교, 찬양팀</li>
          <li>물품: 무선 마이크, 프로젝터, 스피커, 노트북, 카메라</li>
          <li>공간: 본당, 비전홀, 교육관 2층, 유년부실</li>
          <li>차량: 교회 승용차, 교회 승합차, 교회 SUV</li>
        </ul>
      </div>
    </div>
  );
}
