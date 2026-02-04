# Supabase Storage 정책 설정 가이드

## 문제
이미지 업로드가 실패하는 경우, Storage 버킷의 정책이 제대로 설정되지 않았을 수 있습니다.

## 해결 방법

### 방법 1: Dashboard UI 사용 (권장)
Storage 정책은 Supabase 시스템 테이블이므로 Dashboard UI를 통해 생성해야 합니다.
자세한 내용은 `docs/storage_policy_setup_manual.md` 파일을 참고하세요.

**간단 요약:**
1. Supabase Dashboard → Storage → `asset-images` → Policies 탭
2. "New policy" 버튼 클릭
3. 다음 정책들을 추가:
   - INSERT 정책 (authenticated 역할)
   - SELECT 정책 (public 역할)

### 방법 2: Supabase Dashboard에서 수동 설정
1. Supabase Dashboard → Storage → `asset-images` → Policies 탭
2. "New policy" 버튼 클릭
3. 다음 정책들을 추가:

#### 정책 1: Authenticated 사용자 업로드 허용
- **Policy name**: `Allow authenticated uploads to asset-images`
- **Allowed operation**: `INSERT`
- **Target roles**: `authenticated`
- **Policy definition**:
```sql
bucket_id = 'asset-images'
```

#### 정책 2: Public 읽기 허용
- **Policy name**: `Allow public reads from asset-images`
- **Allowed operation**: `SELECT`
- **Target roles**: `public`
- **Policy definition**:
```sql
bucket_id = 'asset-images'
```

#### 정책 3: Authenticated 사용자 업데이트 허용 (선택사항)
- **Policy name**: `Allow authenticated updates to asset-images`
- **Allowed operation**: `UPDATE`
- **Target roles**: `authenticated`
- **Policy definition**:
```sql
bucket_id = 'asset-images'
```

#### 정책 4: Authenticated 사용자 삭제 허용 (선택사항)
- **Policy name**: `Allow authenticated deletes from asset-images`
- **Allowed operation**: `DELETE`
- **Target roles**: `authenticated`
- **Policy definition**:
```sql
bucket_id = 'asset-images'
```

### 3. 확인 사항
- 버킷이 Public으로 설정되어 있는지 (Storage → `asset-images` → Settings)
- 인증된 사용자가 업로드할 수 있는 정책이 있는지
- Public 읽기 정책이 있는지

### 4. 테스트
브라우저 콘솔에서 다음을 확인:
- 세션이 유효한지
- 업로드 에러 메시지의 상세 정보
- Storage 버킷 접근 권한

## 참고
- Storage 정책은 `storage.objects` 테이블에 대한 RLS 정책입니다
- 정책이 없으면 인증된 사용자도 업로드할 수 없습니다
- 버킷이 Public이어도 정책이 필요합니다
