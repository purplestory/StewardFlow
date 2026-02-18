"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import Notice from "@/components/common/Notice";

type Feedback = {
  id: string;
  title: string;
  content: string;
  category: string;
  status: string;
  author_id: string;
  author_name: string | null;
  author_email: string | null;
  organization_id: string | null;
  admin_response: string | null;
  admin_response_at: string | null;
  responded_by: string | null;
  responded_by_name: string | null;
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

const statusBadgeStyles: Record<string, string> = {
  new: "border-blue-200 bg-blue-100 text-blue-700",
  reviewing: "border-amber-200 bg-amber-100 text-amber-700",
  in_progress: "border-violet-200 bg-violet-100 text-violet-700",
  completed: "border-emerald-200 bg-emerald-100 text-emerald-700",
  rejected: "border-rose-200 bg-rose-100 text-rose-700",
};

const statusOptions = [
  { value: "new", label: "새로 작성됨" },
  { value: "reviewing", label: "검토 중" },
  { value: "in_progress", label: "진행 중" },
  { value: "completed", label: "완료" },
  { value: "rejected", label: "거부됨" },
];

function formatDateTime(dateString: string) {
  return new Date(dateString).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function FeedbackDetail({ feedbackId }: { feedbackId: string }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<"admin" | "manager" | "user">("user");
  const [adminResponse, setAdminResponse] = useState("");
  const [status, setStatus] = useState("new");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadFeedback = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        router.push("/login");
        return;
      }

      setCurrentUserId(user.id);

      // 사용자 역할 확인
      const { data: profileData } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileData?.role) {
        setCurrentUserRole(profileData.role as "admin" | "manager" | "user");
      }

      // 피드백 조회
      const { data, error } = await supabase
        .from("feedbacks")
        .select(`
          id,
          title,
          content,
          category,
          status,
          author_id,
          organization_id,
          admin_response,
          admin_response_at,
          responded_by,
          created_at,
          updated_at,
          author:profiles!feedbacks_author_id_fkey(name, email),
          responder:profiles!feedbacks_responded_by_fkey(name)
        `)
        .eq("id", feedbackId)
        .maybeSingle();

      if (error) {
        console.error("Error loading feedback:", error);
        setLoading(false);
        return;
      }

      if (!data) {
        setLoading(false);
        return;
      }

      // 일반 사용자는 본인 작성한 피드백만 조회 가능
      if (profileData?.role === "user" && data.author_id !== user.id) {
        router.push("/feedback");
        return;
      }

      // author와 responder는 배열일 수 있으므로 첫 번째 요소를 가져옴
      const author = Array.isArray(data.author) ? data.author[0] : data.author;
      const responder = Array.isArray(data.responder) ? data.responder[0] : data.responder;

      const feedbackData: Feedback = {
        ...data,
        author_name: author?.name || null,
        author_email: author?.email || null,
        responded_by_name: responder?.name || null,
      };

      setFeedback(feedbackData);
      setStatus(feedbackData.status);
      setAdminResponse(feedbackData.admin_response || "");
      setLoading(false);
    };

    loadFeedback();
  }, [feedbackId, router]);

  const handleUpdate = async () => {
    if (!currentUserId || !feedback) return;

    // 관리자/부서 관리자만 업데이트 가능
    if (currentUserRole !== "admin" && currentUserRole !== "manager") {
      setMessage("권한이 없습니다.");
      return;
    }

    setSubmitting(true);
    setMessage(null);

    const updateData: {
      status: Feedback["status"];
      admin_response?: string;
      admin_response_at?: string;
      responded_by?: string;
    } = {
      status,
    };

    if (adminResponse.trim()) {
      updateData.admin_response = adminResponse.trim();
      updateData.admin_response_at = new Date().toISOString();
      updateData.responded_by = currentUserId;
    }

    const { error } = await supabase
      .from("feedbacks")
      .update(updateData)
      .eq("id", feedbackId);

    if (error) {
      console.error("Error updating feedback:", error);
      setMessage(`업데이트 실패: ${error.message}`);
      setSubmitting(false);
      return;
    }

    setMessage("피드백이 업데이트되었습니다.");
    setSubmitting(false);

    // 피드백 다시 로드
    const { data } = await supabase
      .from("feedbacks")
      .select(`
        id,
        title,
        content,
        category,
        status,
        author_id,
        organization_id,
        admin_response,
        admin_response_at,
        responded_by,
        created_at,
        updated_at,
        author:profiles!feedbacks_author_id_fkey(name, email),
        responder:profiles!feedbacks_responded_by_fkey(name)
      `)
      .eq("id", feedbackId)
      .maybeSingle();

    if (data) {
      // author와 responder는 배열일 수 있으므로 첫 번째 요소를 가져옴
      const author = Array.isArray(data.author) ? data.author[0] : data.author;
      const responder = Array.isArray(data.responder) ? data.responder[0] : data.responder;

      const feedbackData: Feedback = {
        ...data,
        author_name: author?.name || null,
        author_email: author?.email || null,
        responded_by_name: responder?.name || null,
      };
      setFeedback(feedbackData);
      setStatus(feedbackData.status);
      setAdminResponse(feedbackData.admin_response || "");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-neutral-500">로딩 중...</p>
      </div>
    );
  }

  if (!feedback) {
    return (
      <div className="space-y-4">
        <Notice>피드백을 찾을 수 없습니다.</Notice>
        <Link href="/feedback" className="mt-4 inline-block text-sm text-slate-600 hover:text-slate-900">
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

  const canEdit = currentUserRole === "admin" || currentUserRole === "manager";

  return (
    <div className="space-y-4">
      <div className="surface-card p-5 md:p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-neutral-500">
              {categoryLabels[feedback.category] || feedback.category}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                statusBadgeStyles[feedback.status] || "border-neutral-200 bg-neutral-100 text-neutral-700"
              }`}
            >
              {statusLabels[feedback.status] || feedback.status}
            </span>
          </div>

          <h1 className="text-2xl font-semibold text-neutral-900">{feedback.title}</h1>

          <div className="text-sm text-neutral-500">
            <span>{feedback.author_name || feedback.author_email || "익명"}</span>
            <span className="mx-2">•</span>
            <span>{formatDateTime(feedback.created_at)}</span>
          </div>

          <div className="border-t border-neutral-200 pt-4">
            <p className="text-neutral-700 whitespace-pre-wrap">{feedback.content}</p>
          </div>
        </div>
      </div>

      {/* 관리자 답변 섹션 */}
      {canEdit && (
        <div className="surface-card p-5 md:p-6">
          <h2 className="mb-4 text-lg font-semibold text-neutral-900">관리자 답변</h2>

          {message && (
            <div
              className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
                message.includes("실패")
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {message}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="status" className="form-label">
                상태
              </label>
              <select
                id="status"
                className="form-select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="admin_response" className="form-label">
                답변
              </label>
              <textarea
                id="admin_response"
                className="form-textarea"
                rows={6}
                value={adminResponse}
                onChange={(e) => setAdminResponse(e.target.value)}
                placeholder="피드백에 대한 답변을 입력하세요"
                maxLength={2000}
              />
              <p className="mt-1 text-xs text-neutral-500">
                {adminResponse.length} / 2000자
              </p>
            </div>

            {feedback.admin_response && feedback.admin_response_at && (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="mb-2 text-sm text-neutral-600">
                  <span className="font-medium">
                    {feedback.responded_by_name || "관리자"}
                  </span>
                  <span className="mx-2">•</span>
                  <span>{formatDateTime(feedback.admin_response_at)}</span>
                </div>
                <p className="text-neutral-700 whitespace-pre-wrap">
                  {feedback.admin_response}
                </p>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleUpdate}
                disabled={submitting}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 일반 사용자에게 관리자 답변 표시 */}
      {!canEdit && feedback.admin_response && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 md:p-6">
          <h2 className="mb-4 text-lg font-semibold text-emerald-900">관리자 답변</h2>
          <div className="mb-2 text-sm text-emerald-700">
            <span className="font-medium">
              {feedback.responded_by_name || "관리자"}
            </span>
            <span className="mx-2">•</span>
            <span>{formatDateTime(feedback.admin_response_at!)}</span>
          </div>
          <p className="text-emerald-800 whitespace-pre-wrap">
            {feedback.admin_response}
          </p>
        </div>
      )}
    </div>
  );
}
