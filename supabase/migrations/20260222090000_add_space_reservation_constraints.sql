alter table public.spaces
add column if not exists min_reservation_minutes integer,
add column if not exists max_reservation_minutes integer,
add column if not exists reservation_buffer_minutes integer not null default 0;

alter table public.spaces
drop constraint if exists spaces_min_reservation_minutes_nonnegative,
drop constraint if exists spaces_max_reservation_minutes_nonnegative,
drop constraint if exists spaces_reservation_buffer_minutes_nonnegative,
drop constraint if exists spaces_max_reservation_minutes_valid;

alter table public.spaces
add constraint spaces_min_reservation_minutes_nonnegative
check (min_reservation_minutes is null or min_reservation_minutes >= 0),
add constraint spaces_max_reservation_minutes_nonnegative
check (max_reservation_minutes is null or max_reservation_minutes >= 0),
add constraint spaces_reservation_buffer_minutes_nonnegative
check (reservation_buffer_minutes >= 0),
add constraint spaces_max_reservation_minutes_valid
check (
  min_reservation_minutes is null
  or max_reservation_minutes is null
  or max_reservation_minutes = 0
  or max_reservation_minutes >= min_reservation_minutes
);
