-- 관리자가 같은 기관의 다른 사용자 프로필을 업데이트할 수 있도록 정책 추가
-- 최고 관리자는 역할(role)과 부서(department) 변경 가능
-- 부서 관리자는 같은 부서 사용자의 역할만 변경 가능 (이미 애플리케이션 레벨에서 제한)

-- 최고 관리자가 같은 기관의 다른 사용자 프로필을 업데이트할 수 있도록 정책 추가
CREATE POLICY "profiles_update_admin_same_org"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  -- 현재 사용자가 최고 관리자이고
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
  -- 업데이트하려는 사용자가 같은 기관에 속해 있는 경우
  AND organization_id = (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
)
WITH CHECK (
  -- 업데이트 후에도 같은 기관에 속해 있어야 함
  organization_id = (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
  -- 현재 사용자가 최고 관리자인 경우
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- 부서 관리자가 같은 부서의 다른 사용자 프로필을 업데이트할 수 있도록 정책 추가
CREATE POLICY "profiles_update_manager_same_dept"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  -- 현재 사용자가 부서 관리자이고
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'manager'
  )
  -- 같은 기관에 속해 있고
  AND organization_id = (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
  -- 같은 부서에 속해 있는 경우
  AND department = (
    SELECT department FROM public.profiles WHERE id = auth.uid()
  )
  AND department IS NOT NULL
)
WITH CHECK (
  -- 업데이트 후에도 같은 기관에 속해 있어야 함
  organization_id = (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
  -- 같은 부서에 속해 있어야 함
  AND department = (
    SELECT department FROM public.profiles WHERE id = auth.uid()
  )
  AND department IS NOT NULL
  -- 현재 사용자가 부서 관리자인 경우
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'manager'
  )
);
