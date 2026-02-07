-- 피드백 게시판 테이블 생성
CREATE TABLE IF NOT EXISTS public.feedbacks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  category text DEFAULT 'other', -- 'bug', 'feature', 'improvement', 'other'
  status text DEFAULT 'new', -- 'new', 'reviewing', 'in_progress', 'completed', 'rejected'
  admin_response text,
  admin_response_at timestamp with time zone,
  responded_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_feedbacks_organization_id ON public.feedbacks(organization_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_author_id ON public.feedbacks(author_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_status ON public.feedbacks(status);
CREATE INDEX IF NOT EXISTS idx_feedbacks_created_at ON public.feedbacks(created_at DESC);

-- RLS 활성화
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION public.update_feedbacks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_feedbacks_updated_at ON public.feedbacks;
CREATE TRIGGER trigger_update_feedbacks_updated_at
  BEFORE UPDATE ON public.feedbacks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_feedbacks_updated_at();

-- RLS 정책: 본인이 작성한 피드백 조회 가능
CREATE POLICY "feedbacks_select_own"
ON public.feedbacks
FOR SELECT
TO authenticated
USING (
  author_id = auth.uid()
);

-- RLS 정책: 같은 기관의 피드백 조회 가능 (관리자/부서 관리자)
CREATE POLICY "feedbacks_select_same_org"
ON public.feedbacks
FOR SELECT
TO authenticated
USING (
  organization_id IS NOT NULL
  AND organization_id = public.get_user_organization_id()
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'manager')
  )
);

-- RLS 정책: 최고 관리자는 모든 피드백 조회 가능
CREATE POLICY "feedbacks_select_all_by_admin"
ON public.feedbacks
FOR SELECT
TO authenticated
USING (
  public.is_user_admin()
);

-- RLS 정책: 본인이 작성한 피드백 생성 가능
CREATE POLICY "feedbacks_insert_own"
ON public.feedbacks
FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    organization_id IS NULL
    OR organization_id = public.get_user_organization_id()
  )
);

-- RLS 정책: 본인이 작성한 피드백 수정 가능 (상태가 'new'일 때만)
CREATE POLICY "feedbacks_update_own"
ON public.feedbacks
FOR UPDATE
TO authenticated
USING (
  author_id = auth.uid()
  AND status = 'new'
)
WITH CHECK (
  author_id = auth.uid()
  AND status = 'new'
);

-- RLS 정책: 관리자/부서 관리자가 같은 기관의 피드백 상태 및 답변 업데이트 가능
CREATE POLICY "feedbacks_update_admin_same_org"
ON public.feedbacks
FOR UPDATE
TO authenticated
USING (
  organization_id IS NOT NULL
  AND organization_id = public.get_user_organization_id()
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'manager')
  )
)
WITH CHECK (
  organization_id IS NOT NULL
  AND organization_id = public.get_user_organization_id()
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'manager')
  )
);

-- RLS 정책: 최고 관리자는 모든 피드백 업데이트 가능
CREATE POLICY "feedbacks_update_all_by_admin"
ON public.feedbacks
FOR UPDATE
TO authenticated
USING (
  public.is_user_admin()
)
WITH CHECK (
  public.is_user_admin()
);
