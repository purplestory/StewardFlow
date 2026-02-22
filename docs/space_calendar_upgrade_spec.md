# 공간 예약 캘린더 고도화

## 목표
- 주말 중심 운영(토요일/주일)에서 예약 확인과 등록 속도를 높인다.
- 공간별 최소/최대 예약시간, 준비/정리 버퍼를 시스템 규칙으로 강제한다.

## 적용 범위
- 캘린더 UI: `src/components/assets/ReservationCalendar.tsx`
- 공간 예약 섹션: `src/components/spaces/SpaceReservationSection.tsx`
- 예약 폼: `src/components/assets/ReservationForm.tsx`
- 공간 등록/수정: `src/components/spaces/SpaceForm.tsx`
- 서버 검증: `src/actions/booking-actions.ts`
- 스키마: `supabase/migrations/20260222090000_add_space_reservation_constraints.sql`

## 구현 항목
- [x] 요일 필터: 전체/토요일만/주일만/주말(토·주일)
- [x] 요일 반복 리스트: 선택 요일의 월간 반복 목록 제공
- [x] 주간/일간 + 예약 버튼 제공
- [x] 모바일 롱프레스(길게 누르기) 예약 트리거
- [x] 공간별 최소 예약 시간(분) 설정
- [x] 공간별 최대 예약 시간(분) 설정 (`0`은 무제한)
- [x] 공간별 버퍼 시간(분) 설정
- [x] 서버측 최소/최대 시간 유효성 검사
- [x] 서버측 충돌 검사에 버퍼 반영

## 정책 동작 요약
- 최소시간: `예약 길이 < min_reservation_minutes`면 신청 차단
- 최대시간: `max_reservation_minutes > 0`이고 예약 길이가 초과되면 차단
- 버퍼시간: 충돌검사 시 예약 종료 뒤 `reservation_buffer_minutes`를 점유 시간으로 간주

## 후속 개선
- [ ] 관리자 화면에서 공간 정책 일괄 편집
- [ ] 주간 타임그리드(시간축) 기반 드래그 선택
- [ ] 버퍼 시간을 예약 상세 카드에도 시각화
