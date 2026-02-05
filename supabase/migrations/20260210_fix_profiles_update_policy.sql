-- profiles_update_own 정책에 WITH CHECK 절 추가
-- 초대 수락 시 organization_id 업데이트가 제대로 작동하도록 함

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());
