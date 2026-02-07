-- 사용자 삭제 시 예약 내역도 함께 삭제되도록 외래 키 제약 조건 수정

-- 1. reservations (물품 예약)
DO $$
BEGIN
  -- 기존 제약조건 삭제
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'reservations_borrower_id_fkey') THEN
    ALTER TABLE public.reservations DROP CONSTRAINT reservations_borrower_id_fkey;
  END IF;

  -- 새로운 제약조건 추가 (ON DELETE CASCADE)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reservations') THEN
    ALTER TABLE public.reservations
    ADD CONSTRAINT reservations_borrower_id_fkey
    FOREIGN KEY (borrower_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE;
  END IF;
END $$;

-- 2. space_reservations (공간 예약)
DO $$
BEGIN
  -- 기존 제약조건 삭제
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'space_reservations_borrower_id_fkey') THEN
    ALTER TABLE public.space_reservations DROP CONSTRAINT space_reservations_borrower_id_fkey;
  END IF;

  -- 새로운 제약조건 추가 (ON DELETE CASCADE)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'space_reservations') THEN
    ALTER TABLE public.space_reservations
    ADD CONSTRAINT space_reservations_borrower_id_fkey
    FOREIGN KEY (borrower_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE;
  END IF;
END $$;

-- 3. vehicle_reservations (차량 예약)
DO $$
BEGIN
  -- 기존 제약조건 삭제
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'vehicle_reservations_borrower_id_fkey') THEN
    ALTER TABLE public.vehicle_reservations DROP CONSTRAINT vehicle_reservations_borrower_id_fkey;
  END IF;

  -- 새로운 제약조건 추가 (ON DELETE CASCADE)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicle_reservations') THEN
    ALTER TABLE public.vehicle_reservations
    ADD CONSTRAINT vehicle_reservations_borrower_id_fkey
    FOREIGN KEY (borrower_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE;
  END IF;
END $$;
