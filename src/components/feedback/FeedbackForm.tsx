"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const categories = [
  { value: "bug", label: "버그 리포트" },
  { value: "feature", label: "기능 제안" },
  { value: "improvement", label: "개선 아이디어" },
  { value: "other", label: "기타" },
];

export default function FeedbackForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("other");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    const loadUserData = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileData?.organization_id) {
        setOrganizationId(profileData.organization_id);
      }
    };

    loadUserData();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;

    if (!user) {
      setMessage("로그인이 필요합니다.");
      setSubmitting(false);
      return;
    }

    if (!title.trim() || !content.trim()) {
      setMessage("제목과 내용을 입력해주세요.");
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from("feedbacks").insert({
      organization_id: organizationId,
      author_id: user.id,
      title: title.trim(),
      content: content.trim(),
      category,
      status: "new",
    });

    if (error) {
      console.error("Feedback creation error:", error);
      setMessage(`피드백 제출 실패: ${error.message}`);
      setSubmitting(false);
      return;
    }

    setMessage("피드백이 성공적으로 제출되었습니다. 감사합니다!");
    setTitle("");
    setContent("");
    setCategory("other");

    setTimeout(() => {
      router.push("/feedback");
    }, 1500);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {message && (
        <div
          className={`rounded-lg p-3 text-sm ${
            message.includes("실패") || message.includes("필요")
              ? "bg-rose-50 text-rose-700"
              : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {message}
        </div>
      )}

      <div>
        <label htmlFor="category" className="form-label">
          카테고리
        </label>
        <select
          id="category"
          className="form-select"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
        >
          {categories.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="title" className="form-label">
          제목
        </label>
        <input
          id="title"
          type="text"
          className="form-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="피드백 제목을 입력하세요"
          required
          maxLength={200}
        />
      </div>

      <div>
        <label htmlFor="content" className="form-label">
          내용
        </label>
        <textarea
          id="content"
          className="form-textarea"
          rows={8}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="피드백 내용을 자세히 입력해주세요. 구체적인 상황이나 개선 방안을 포함해주시면 더 도움이 됩니다."
          required
          maxLength={5000}
        />
        <p className="mt-1 text-xs text-neutral-500">
          {content.length} / 5000자
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "제출 중..." : "피드백 제출"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="btn-ghost"
          disabled={submitting}
        >
          취소
        </button>
      </div>
    </form>
  );
}
