# Storage 정책 생성 빠른 가이드

## 현재 설정 중인 정책: Public 읽기 허용

### 1. Policy name
✅ 이미 입력하신 것: `Allow public reads from asset-images`

### 2. Allowed operation
✅ SELECT만 체크되어 있음 (올바름)

### 3. Target roles
**문제:** "public" 역할이 드롭다운에 없음

**해결 방법 (2가지 중 선택):**

**방법 1: Target roles를 비워두기 (권장)**
- Target roles 필드를 **비워두세요** (아무것도 선택하지 않음)
- Supabase에서 Target roles가 비어있으면 기본적으로 모든 역할(public 포함)에 적용됩니다
- 설명에 "Defaults to all (public) roles if none selected"라고 나와있습니다

**방법 2: Policy definition에서 처리**
- Target roles는 그대로 두고
- Policy definition에 `true`를 입력하면 모든 사용자에게 적용됩니다

### 4. Policy definition (중요!)
**이 필드에 다음 SQL을 입력하세요:**

```sql
bucket_id = 'asset-images'
```

**또는 (더 간단한 방법):**
Target roles를 비워두고 Policy definition에 `true`를 입력해도 됩니다:
```sql
true
```

**주의:** 
- USING 절에 입력합니다
- 따옴표는 작은따옴표(`'`)를 사용하세요
- 세미콜론(`;`)은 필요 없습니다
- `bucket_id = 'asset-images'`를 사용하면 해당 버킷에만 적용됩니다

### 5. 저장
모든 필드를 입력한 후 "Save policy" 또는 "Create policy" 버튼을 클릭하세요.

---

## 다음에 생성할 정책: Authenticated 업로드 허용

### 정책 1: 업로드 허용 (필수)
- **Policy name**: `Allow authenticated uploads to asset-images`
- **Allowed operation**: `INSERT` 체크
- **Target roles**: `authenticated` 입력
- **Policy definition** (WITH CHECK 절):
```sql
bucket_id = 'asset-images'
```

### 정책 2: 삭제 허용 (선택사항)
- **Policy name**: `Allow authenticated deletes from asset-images`
- **Allowed operation**: `DELETE` 체크
- **Target roles**: `authenticated` 입력
- **Policy definition** (USING 절):
```sql
bucket_id = 'asset-images'
```

---

## 참고
- Policy definition은 SQL 조건식입니다
- `bucket_id = 'asset-images'`는 해당 버킷에만 정책이 적용되도록 합니다
- 정책 생성 후 즉시 적용됩니다
