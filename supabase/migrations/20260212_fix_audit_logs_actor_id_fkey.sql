-- 사용자 삭제 시 외래 키 제약 조건 문제 해결
-- audit_logs, account_deletion_requests, department_change_requests 등의
-- profiles 참조를 안전하게 처리하도록 외래 키 제약 조건 수정

-- 1. audit_logs.actor_id: ON DELETE SET NULL (actor_id는 nullable)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
    ALTER TABLE public.audit_logs
    DROP CONSTRAINT IF EXISTS audit_logs_actor_id_fkey;

    ALTER TABLE public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey
    FOREIGN KEY (actor_id)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- 2. account_deletion_requests.resolved_by: ON DELETE SET NULL (nullable)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'account_deletion_requests') THEN
    ALTER TABLE public.account_deletion_requests
    DROP CONSTRAINT IF EXISTS account_deletion_requests_resolved_by_fkey;

    ALTER TABLE public.account_deletion_requests
    ADD CONSTRAINT account_deletion_requests_resolved_by_fkey
    FOREIGN KEY (resolved_by)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- 3. account_deletion_requests.transfer_to_user_id: ON DELETE SET NULL (nullable)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'account_deletion_requests') THEN
    ALTER TABLE public.account_deletion_requests
    DROP CONSTRAINT IF EXISTS account_deletion_requests_transfer_to_user_id_fkey;

    ALTER TABLE public.account_deletion_requests
    ADD CONSTRAINT account_deletion_requests_transfer_to_user_id_fkey
    FOREIGN KEY (transfer_to_user_id)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- 4. account_deletion_requests.requester_id: ON DELETE CASCADE (not null, 요청자 삭제 시 요청도 삭제)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'account_deletion_requests') THEN
    ALTER TABLE public.account_deletion_requests
    DROP CONSTRAINT IF EXISTS account_deletion_requests_requester_id_fkey;

    ALTER TABLE public.account_deletion_requests
    ADD CONSTRAINT account_deletion_requests_requester_id_fkey
    FOREIGN KEY (requester_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE;
  END IF;
END $$;

-- 5. department_change_requests.resolved_by: ON DELETE SET NULL (nullable)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'department_change_requests') THEN
    ALTER TABLE public.department_change_requests
    DROP CONSTRAINT IF EXISTS department_change_requests_resolved_by_fkey;

    ALTER TABLE public.department_change_requests
    ADD CONSTRAINT department_change_requests_resolved_by_fkey
    FOREIGN KEY (resolved_by)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- 6. department_change_requests.requester_id: ON DELETE CASCADE (not null, 요청자 삭제 시 요청도 삭제)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'department_change_requests') THEN
    ALTER TABLE public.department_change_requests
    DROP CONSTRAINT IF EXISTS department_change_requests_requester_id_fkey;

    ALTER TABLE public.department_change_requests
    ADD CONSTRAINT department_change_requests_requester_id_fkey
    FOREIGN KEY (requester_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE;
  END IF;
END $$;

-- 7. asset_transfer_requests.requester_id: ON DELETE SET NULL (nullable)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'asset_transfer_requests') THEN
    ALTER TABLE public.asset_transfer_requests
    DROP CONSTRAINT IF EXISTS asset_transfer_requests_requester_id_fkey;

    ALTER TABLE public.asset_transfer_requests
    ADD CONSTRAINT asset_transfer_requests_requester_id_fkey
    FOREIGN KEY (requester_id)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;
  END IF;
END $$;
