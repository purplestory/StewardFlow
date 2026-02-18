"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import Notice from "@/components/common/Notice";
import StatusFilterPills from "@/components/ui/StatusFilterPills";

type Feedback = {
  id: string;
  title: string;
  content: string;
  category: string;
  status: string;
  author_id: string;
  author_name: string | null;
  author_email: string | null;
  admin_response: string | null;
  admin_response_at: string | null;
  responded_by: string | null;
  created_at: string;
  updated_at: string;
};

const categoryLabels: Record<string, string> = {
  bug: "버그 리포트",
  feature: "기능 제안",
  improvement: "개선 아이디어",
  other: "기타",
};

const statusLabels: Record<string, string> = {
  new: "새로 작성됨",
  reviewing: "검토 중",
  in_progress: "진행 중",
  completed: "완료",
  rejected: "거부됨",
};

const statusColors: Record<string, string> = {
  new: "border-blue-200 bg-blue-100 text-blue-700",
  reviewing: "border-amber-200 bg-amber-100 text-amber-700",
  in_progress: "border-violet-200 bg-violet-100 text-violet-700",
  completed: "border-emerald-200 bg-emerald-100 text-emerald-700",
  rejected: "border-rose-200 bg-rose-100 text-rose-700",
};

export default function FeedbackList() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "new" | "reviewing" | "in_progress" | "completed">("all");
  const [currentUserRole, setCurrentUserRole] = useState<"admin" | "manager" | "user">("user");

  useEffect(() => {
    const loadFeedbacks = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        setLoading(false);
        return;
      }

      // 사용자 역할 확인
      const { data: profileData } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileData?.role) {
        setCurrentUserRole(profileData.role as "admin" | "manager" | "user");
      }

      // 관리자/부서 관리자는 모든 피드백 조회, 일반 사용자는 본인 작성한 것만
      let query = supabase
        .from("feedbacks")
        .select(`
          id,
          title,
          content,
          category,
          status,
          author_id,
          admin_response,
          admin_response_at,
          responded_by,
          created_at,
          updated_at,
          author:profiles!feedbacks_author_id_fkey(name, email)
        `)
        .order("created_at", { ascending: false });

      // 일반 사용자는 본인 작성한 것만
      if (profileData?.role === "user") {
        query = query.eq("author_id", user.id);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error loading feedbacks:", error);
        setLoading(false);
        return;
      }

      type FeedbackAuthor = { name?: string | null; email?: string | null };
      type FeedbackRow = Feedback & { author?: FeedbackAuthor | FeedbackAuthor[] | null };
      const feedbacksWithAuthor = ((data || []) as FeedbackRow[]).map((fb) => {
        // author는 배열일 수 있으므로 첫 번째 요소를 가져옴
        const author = Array.isArray(fb.author) ? fb.author[0] : fb.author;
        return {
          ...fb,
          author_name: author?.name || null,
          author_email: author?.email || null,
        };
      });

      setFeedbacks(feedbacksWithAuthor);
      setLoading(false);
    };

    loadFeedbacks();
  }, []);

  const filteredFeedbacks = feedbacks.filter((fb) => {
    if (filter === "all") return true;
    return fb.status === filter;
  });

  const filterOptions: Array<{
    value: "all" | "new" | "reviewing" | "in_progress" | "completed";
    label: string;
  }> = [
    { value: "all", label: "전체" },
    { value: "new", label: "새로 작성됨" },
    { value: "reviewing", label: "검토 중" },
    { value: "in_progress", label: "진행 중" },
    { value: "completed", label: "완료" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-neutral-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 필터 버튼 (관리자/부서 관리자만) */}
      {(currentUserRole === "admin" || currentUserRole === "manager") && (
        <StatusFilterPills
          options={filterOptions}
          value={filter}
          onChange={(next) =>
            setFilter(next as "all" | "new" | "reviewing" | "in_progress" | "completed")
          }
        />
      )}

      {filteredFeedbacks.length === 0 ? (
        <Notice>{filter === "all" ? "피드백이 없습니다." : "해당 상태의 피드백이 없습니다."}</Notice>
      ) : (
        <div className="space-y-3">
          {filteredFeedbacks.map((feedback) => (
            <Link
              key={feedback.id}
              href={`/feedback/${feedback.id}`}
              className="block rounded-xl border border-neutral-200 bg-white p-4 transition-all hover:border-neutral-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-neutral-500">
                      {categoryLabels[feedback.category] || feedback.category}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                        statusColors[feedback.status] || "bg-neutral-100 text-neutral-700"
                      }`}
                    >
                      {statusLabels[feedback.status] || feedback.status}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-neutral-900 mb-1 line-clamp-1">
                    {feedback.title}
                  </h3>
                  <p className="text-sm text-neutral-600 line-clamp-2 mb-2">
                    {feedback.content}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-neutral-500">
                    <span>
                      {feedback.author_name || feedback.author_email || "익명"}
                    </span>
                    <span>
                      {new Date(feedback.created_at).toLocaleDateString("ko-KR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                    {feedback.admin_response && (
                      <span className="text-emerald-600">답변 완료</span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
