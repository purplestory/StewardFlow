-- 안전한 RLS 정책 수정 (의존성 문제 해결)
-- CREATE OR REPLACE를 사용하여 함수를 삭제하지 않고 재생성합니다.

-- ============================================
-- 1. 모든 의존 정책 삭제 (더 철저하게)
-- ============================================

-- vehicles 정책들
DROP POLICY IF EXISTS "vehicles_insert_same_org" ON public.vehicles CASCADE;
DROP POLICY IF EXISTS "vehicles_update_same_org" ON public.vehicles CASCADE;
DROP POLICY IF EXISTS "vehicles_delete_managers" ON public.vehicles CASCADE;
DROP POLICY IF EXISTS "vehicles_select_same_org" ON public.vehicles CASCADE;

-- vehicle_reservations 정책들
DROP POLICY IF EXISTS "vehicle_reservations_delete_same_org" ON public.vehicle_reservations CASCADE;
DROP POLICY IF EXISTS "vehicle_reservations_select_same_org" ON public.vehicle_reservations CASCADE;
DROP POLICY IF EXISTS "vehicle_reservations_insert_same_org" ON public.vehicle_reservations CASCADE;
DROP POLICY IF EXISTS "vehicle_reservations_update_same_org" ON public.vehicle_reservations CASCADE;

-- assets 정책들
DROP POLICY IF EXISTS "assets_insert_same_org" ON public.assets CASCADE;
DROP POLICY IF EXISTS "assets_update_same_org" ON public.assets CASCADE;
DROP POLICY IF EXISTS "assets_delete_managers" ON public.assets CASCADE;
DROP POLICY IF EXISTS "assets_select_same_org" ON public.assets CASCADE;

-- spaces 정책들
DROP POLICY IF EXISTS "spaces_insert_same_org" ON public.spaces CASCADE;
DROP POLICY IF EXISTS "spaces_update_same_org" ON public.spaces CASCADE;
DROP POLICY IF EXISTS "spaces_delete_managers" ON public.spaces CASCADE;
DROP POLICY IF EXISTS "spaces_select_same_org" ON public.spaces CASCADE;

-- profiles 정책들
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles CASCADE;
DROP POLICY IF EXISTS "profiles_select_same_org" ON public.profiles CASCADE;

-- ============================================
-- 2. 보조 함수 생성 (SECURITY DEFINER로 RLS 우회)
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_id uuid;
BEGIN
  SELECT organization_id INTO org_id
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
  
  RETURN org_id;
END;
$$;

-- ============================================
-- 3. user_role() 함수 재생성 (CREATE OR REPLACE 사용)
-- ============================================

-- CREATE OR REPLACE를 사용하면 의존성 문제 없이 재생성 가능
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
  
  RETURN user_role;
END;
$$;

-- ============================================
-- 4. is_manager_or_admin() 함수 재생성
-- ============================================

CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.role_rank(public.user_role()) >= public.role_rank('manager');
$$;

-- ============================================
-- 5. profiles 테이블 RLS 정책 (재귀 방지)
-- ============================================

CREATE POLICY "profiles_select_same_org"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR (
    organization_id IS NOT NULL
    AND organization_id = public.get_user_organization_id()
  )
);

-- ============================================
-- 6. SELECT 정책 생성 (assets, spaces, vehicles)
-- ============================================

-- assets SELECT 정책
CREATE POLICY "assets_select_same_org"
ON public.assets
FOR SELECT
TO authenticated
USING (
  organization_id IS NOT NULL
  AND organization_id = public.get_user_organization_id()
);

-- spaces SELECT 정책
CREATE POLICY "spaces_select_same_org"
ON public.spaces
FOR SELECT
TO authenticated
USING (
  organization_id IS NOT NULL
  AND organization_id = public.get_user_organization_id()
);

-- vehicles SELECT 정책
CREATE POLICY "vehicles_select_same_org"
ON public.vehicles
FOR SELECT
TO authenticated
USING (
  organization_id IS NOT NULL
  AND organization_id = public.get_user_organization_id()
);

-- ============================================
-- 7. INSERT, UPDATE, DELETE 정책 생성
-- ============================================

-- assets INSERT 정책
CREATE POLICY "assets_insert_same_org"
ON public.assets
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = public.get_user_organization_id()
);

-- assets UPDATE 정책
CREATE POLICY "assets_update_same_org"
ON public.assets
FOR UPDATE
TO authenticated
USING (
  organization_id = public.get_user_organization_id()
)
WITH CHECK (
  organization_id = public.get_user_organization_id()
);

-- assets DELETE 정책 (관리자/부서 관리자만)
CREATE POLICY "assets_delete_managers"
ON public.assets
FOR DELETE
TO authenticated
USING (
  organization_id = public.get_user_organization_id()
  AND public.is_manager_or_admin()
);

-- spaces INSERT 정책
CREATE POLICY "spaces_insert_same_org"
ON public.spaces
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = public.get_user_organization_id()
);

-- spaces UPDATE 정책
CREATE POLICY "spaces_update_same_org"
ON public.spaces
FOR UPDATE
TO authenticated
USING (
  organization_id = public.get_user_organization_id()
)
WITH CHECK (
  organization_id = public.get_user_organization_id()
);

-- spaces DELETE 정책 (관리자/부서 관리자만)
CREATE POLICY "spaces_delete_managers"
ON public.spaces
FOR DELETE
TO authenticated
USING (
  organization_id = public.get_user_organization_id()
  AND public.is_manager_or_admin()
);

-- vehicles INSERT 정책
CREATE POLICY "vehicles_insert_same_org"
ON public.vehicles
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = public.get_user_organization_id()
  AND (public.user_role() = 'admin' OR public.user_role() = 'manager')
);

-- vehicles UPDATE 정책
CREATE POLICY "vehicles_update_same_org"
ON public.vehicles
FOR UPDATE
TO authenticated
USING (
  organization_id = public.get_user_organization_id()
  AND (public.user_role() = 'admin' OR public.user_role() = 'manager')
)
WITH CHECK (
  organization_id = public.get_user_organization_id()
  AND (public.user_role() = 'admin' OR public.user_role() = 'manager')
);

-- vehicles DELETE 정책 (관리자/부서 관리자만)
CREATE POLICY "vehicles_delete_managers"
ON public.vehicles
FOR DELETE
TO authenticated
USING (
  organization_id = public.get_user_organization_id()
  AND public.is_manager_or_admin()
);

-- vehicle_reservations DELETE 정책
CREATE POLICY "vehicle_reservations_delete_same_org"
ON public.vehicle_reservations
FOR DELETE
TO authenticated
USING (
  organization_id = public.get_user_organization_id()
  AND public.is_manager_or_admin()
);

-- ============================================
-- 8. 정책 확인
-- ============================================

SELECT 
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename IN ('profiles', 'assets', 'spaces', 'vehicles', 'vehicle_reservations')
ORDER BY tablename, policyname;
