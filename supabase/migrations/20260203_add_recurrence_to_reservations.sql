-- 반복 일정 기능을 위한 컬럼 추가

-- reservations 테이블에 반복 일정 컬럼 추가
ALTER TABLE public.reservations
ADD COLUMN IF NOT EXISTS recurrence_type text DEFAULT 'none', -- 'none', 'weekly', 'monthly'
ADD COLUMN IF NOT EXISTS recurrence_interval integer DEFAULT 1, -- 몇 주/달마다 반복 (1 = 매주/매월, 2 = 격주/격월 등)
ADD COLUMN IF NOT EXISTS recurrence_end_date timestamp with time zone, -- 반복 종료일
ADD COLUMN IF NOT EXISTS recurrence_days_of_week integer[], -- 요일 배열 (0=일요일, 1=월요일, ..., 6=토요일) - 매주 반복 시 사용
ADD COLUMN IF NOT EXISTS recurrence_day_of_month integer, -- 월의 몇 일 (1-31) - 매월 반복 시 사용
ADD COLUMN IF NOT EXISTS parent_reservation_id uuid REFERENCES public.reservations(id), -- 원본 예약 ID (반복 예약의 경우)
ADD COLUMN IF NOT EXISTS is_recurring_instance boolean DEFAULT false; -- 반복 일정의 인스턴스인지 여부

-- space_reservations 테이블에 반복 일정 컬럼 추가
ALTER TABLE public.space_reservations
ADD COLUMN IF NOT EXISTS recurrence_type text DEFAULT 'none',
ADD COLUMN IF NOT EXISTS recurrence_interval integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS recurrence_end_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS recurrence_days_of_week integer[],
ADD COLUMN IF NOT EXISTS recurrence_day_of_month integer,
ADD COLUMN IF NOT EXISTS parent_reservation_id uuid REFERENCES public.space_reservations(id),
ADD COLUMN IF NOT EXISTS is_recurring_instance boolean DEFAULT false;

-- 인덱스 추가 (반복 일정 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_reservations_parent_id ON public.reservations(parent_reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservations_recurrence ON public.reservations(recurrence_type, recurrence_end_date) WHERE recurrence_type != 'none';

CREATE INDEX IF NOT EXISTS idx_space_reservations_parent_id ON public.space_reservations(parent_reservation_id);
CREATE INDEX IF NOT EXISTS idx_space_reservations_recurrence ON public.space_reservations(recurrence_type, recurrence_end_date) WHERE recurrence_type != 'none';
