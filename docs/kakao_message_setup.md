# 카카오톡 알림 설정 가이드

StewardFlow에서 카카오톡 알림 기능을 사용하려면 카카오 비즈니스 메시지 API를 설정해야 합니다.

## 사전 준비

1. **카카오톡 채널 생성**
   - 카카오 비즈니스 센터(https://business.kakao.com)에 접속
   - 카카오톡 채널 생성 및 인증 완료

2. **카카오 개발자 계정 생성**
   - 카카오 개발자 콘솔(https://developers.kakao.com) 접속
   - 애플리케이션 등록

## 설정 단계

### 1. 카카오 비즈니스 메시지 API 키 발급

1. 카카오 개발자 콘솔에서 애플리케이션 선택
2. "앱 키" 메뉴에서 REST API 키 확인
3. "제품 설정" > "카카오톡 메시지" 활성화
4. "카카오톡 채널" 연결

### 2. 템플릿 메시지 등록

카카오 비즈니스 메시지에서는 템플릿 메시지를 사전에 등록해야 합니다.

#### 필요한 템플릿 코드 목록

1. **`RESERVATION_REQUEST_ADMIN`** - 예약 신청 알림 (관리자용)
   ```
   [StewardFlow] 새로운 대여 신청이 접수되었습니다.
   
   자원 유형: #{resource_type}
   자원명: #{resource_name}
   신청자: #{borrower_name} #{borrower_department}
   대여 기간: #{start_date} ~ #{end_date}
   
   승인 대기 중입니다.
   ```

2. **`RESERVATION_REQUEST_BORROWER`** - 예약 신청 알림 (신청자용)
   ```
   [StewardFlow] 대여 신청이 접수되었습니다.
   
   자원 유형: #{resource_type}
   자원명: #{resource_name}
   대여 기간: #{start_date} ~ #{end_date}
   
   승인 대기 중입니다.
   ```

3. **`RESERVATION_APPROVED`** - 예약 승인 알림 (신청자용)
   ```
   [StewardFlow] 대여 신청이 승인되었습니다.
   
   자원 유형: #{resource_type}
   자원명: #{resource_name}
   대여 기간: #{start_date} ~ #{end_date}
   반납 기한: #{return_deadline}
   
   반납 기한까지 반납해주세요.
   ```

4. **`RETURN_SUBMITTED_ADMIN`** - 반납 결과 등록 알림 (관리자용)
   ```
   [StewardFlow] 반납 결과가 등록되었습니다.
   
   자원 유형: #{resource_type}
   자원명: #{resource_name}
   신청자: #{borrower_name}
   반납일: #{return_date}
   
   확인이 필요합니다.
   ```

5. **`RETURN_SUBMITTED_BORROWER`** - 반납 결과 등록 알림 (신청자용)
   ```
   [StewardFlow] 반납이 완료되었습니다.
   
   자원 유형: #{resource_type}
   자원명: #{resource_name}
   반납일: #{return_date}
   
   관리자 확인 대기 중입니다.
   ```

6. **`RETURN_APPROVED_ADMIN`** - 반납 승인 알림 (관리자용)
   ```
   [StewardFlow] 반납 확인이 완료되었습니다.
   
   자원 유형: #{resource_type}
   자원명: #{resource_name}
   신청자: #{borrower_name}
   확인 결과: #{verification_status}
   ```

7. **`RETURN_APPROVED_BORROWER`** - 반납 승인 알림 (신청자용)
   ```
   [StewardFlow] 반납 확인이 완료되었습니다.
   
   자원 유형: #{resource_type}
   자원명: #{resource_name}
   확인 결과: #{verification_status}
   ```

### 3. 환경 변수 설정

`.env.local` 파일에 다음 환경 변수를 추가하세요:

```env
# 카카오 비즈니스 메시지 API
KAKAO_BUSINESS_API_KEY=your_rest_api_key_here
KAKAO_CHANNEL_ID=your_channel_id_here
KAKAO_SERVICE_URL=https://steward-flow.vercel.app
```

**Vercel 배포 시:**
1. Vercel 대시보드 > 프로젝트 > Settings > Environment Variables
2. 위 환경 변수들을 추가

### 4. 템플릿 등록 방법

1. 카카오 비즈니스 센터 접속
2. "메시지" > "템플릿" 메뉴
3. "템플릿 만들기" 클릭
4. 각 템플릿 코드에 해당하는 메시지 작성
5. 변수(`#{변수명}`) 형식으로 작성
6. 템플릿 코드는 위 목록의 코드와 정확히 일치해야 함

## 알림 발송 시점

카카오톡 알림은 다음 시점에 자동으로 발송됩니다:

1. **예약 신청 시**
   - 신청자에게: 신청 접수 알림
   - 관리자에게: 새로운 신청 알림

2. **예약 승인 시**
   - 신청자에게: 승인 알림 (반납 기한 포함)

3. **반납 결과 등록 시**
   - 신청자에게: 반납 완료 알림
   - 관리자에게: 반납 확인 필요 알림

4. **반납 승인 시**
   - 신청자에게: 반납 확인 완료 알림
   - 관리자에게: 반납 확인 완료 알림

## 주의사항

1. **전화번호 필수**: 사용자 프로필에 전화번호가 등록되어 있어야 알림이 발송됩니다.
2. **템플릿 승인**: 카카오톡 템플릿은 승인 과정이 필요하며, 승인까지 시간이 걸릴 수 있습니다.
3. **API 제한**: 카카오 비즈니스 메시지 API는 일일 발송량 제한이 있을 수 있습니다.
4. **실패 처리**: 알림 발송 실패 시에도 예약/반납 처리는 정상적으로 완료됩니다.

## 문제 해결

### 알림이 발송되지 않는 경우

1. 환경 변수 확인: `KAKAO_BUSINESS_API_KEY`, `KAKAO_CHANNEL_ID` 설정 확인
2. 템플릿 코드 확인: 등록한 템플릿 코드가 정확한지 확인
3. 전화번호 확인: 사용자 프로필에 전화번호가 등록되어 있는지 확인
4. 로그 확인: 서버 로그에서 카카오톡 발송 오류 메시지 확인

### 템플릿 승인 거부된 경우

1. 템플릿 내용이 카카오톡 정책에 위배되지 않는지 확인
2. 변수 형식(`#{변수명}`)이 정확한지 확인
3. 카카오 비즈니스 센터에서 거부 사유 확인

## 참고 자료

- [카카오 비즈니스 메시지 API 문서](https://developers.kakao.com/docs/latest/ko/business-message/rest-api)
- [카카오톡 템플릿 메시지 가이드](https://developers.kakao.com/docs/latest/ko/business-message/template)
