# Supabase Storage 정책 수동 설정 가이드

## 문제
SQL로 직접 정책을 생성하려고 하면 "must be owner of table objects" 에러가 발생합니다.
이는 `storage.objects` 테이블이 Supabase 시스템 테이블이기 때문입니다.

## 해결 방법: Dashboard UI 사용

### 1. Storage Policies 페이지로 이동
1. Supabase Dashboard → Storage → `asset-images` 버킷
2. **Policies** 탭 클릭
3. "New policy" 버튼 클릭

### 2. 정책 1: Authenticated 사용자 업로드 허용
- **Policy name**: `Allow authenticated uploads to asset-images`
- **Allowed operation**: `INSERT`
- **Target roles**: `authenticated`
- **Policy definition** (USING 절):
```sql
bucket_id = 'asset-images'
```
- **Policy definition** (WITH CHECK 절):
```sql
bucket_id = 'asset-images'
```

### 3. 정책 2: Public 읽기 허용
- **Policy name**: `Allow public reads from asset-images`
- **Allowed operation**: `SELECT` 체크
- **Target roles**: 
  - **비워두세요!** (아무것도 선택하지 않음)
  - Target roles가 비어있으면 기본적으로 모든 역할(public 포함)에 적용됩니다
  - 설명에 "Defaults to all (public) roles if none selected"라고 표시됩니다
- **Policy definition** (USING 절):
```sql
bucket_id = 'asset-images'
```

### 4. 정책 3: Authenticated 사용자 업데이트 허용 (선택사항)
- **Policy name**: `Allow authenticated updates to asset-images`
- **Allowed operation**: `UPDATE`
- **Target roles**: `authenticated`
- **Policy definition** (USING 절):
```sql
bucket_id = 'asset-images'
```
- **Policy definition** (WITH CHECK 절):
```sql
bucket_id = 'asset-images'
```

### 5. 정책 4: Authenticated 사용자 삭제 허용 (선택사항)
- **Policy name**: `Allow authenticated deletes from asset-images`
- **Allowed operation**: `DELETE`
- **Target roles**: `authenticated`
- **Policy definition** (USING 절):
```sql
bucket_id = 'asset-images'
```

## 참고
- Dashboard UI를 사용하면 권한 문제 없이 정책을 생성할 수 있습니다
- 최소한 정책 1과 2는 필수입니다 (업로드와 읽기)
- 정책 생성 후 즉시 적용됩니다
