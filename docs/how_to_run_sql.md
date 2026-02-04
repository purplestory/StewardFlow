# Supabase SQL Editor 사용 방법

## 1단계: Supabase 대시보드 접속

1. 브라우저에서 [Supabase Dashboard](https://app.supabase.com) 접속
2. 프로젝트 선택 (예: "purplestory" 또는 "Steward Flow")

## 2단계: SQL Editor 열기

1. 왼쪽 사이드바에서 **"SQL Editor"** 클릭
   - 또는 상단 검색창에서 "SQL Editor" 검색
   - 또는 "Database" → "SQL Editor" 경로로 이동

## 3단계: SQL 실행

1. SQL Editor 화면에서:
   - 왼쪽: SQL 쿼리 입력창
   - 오른쪽: 결과 표시 영역

2. SQL 코드 복사 & 붙여넣기:
   - 제공된 SQL 코드 전체를 복사
   - SQL Editor의 입력창에 붙여넣기

3. 실행:
   - **"Run"** 버튼 클릭 (또는 `Cmd+Enter` / `Ctrl+Enter`)
   - 또는 쿼리 선택 후 실행

## 4단계: 결과 확인

- 오른쪽 패널에서 결과 확인
- 여러 SELECT 문이 있으면 각각의 결과가 탭으로 표시됨
- 에러가 있으면 빨간색으로 표시됨

## 주의사항

- ⚠️ **주의**: SQL을 실행하기 전에 반드시 코드를 확인하세요
- 🔄 **백업**: 중요한 데이터가 있다면 먼저 백업하세요
- 📝 **단계별 실행**: 긴 SQL은 단계별로 나눠서 실행하는 것이 안전합니다

## 예시: organizations 정책 확인 SQL 실행

1. SQL Editor 열기
2. 다음 코드 붙여넣기:
```sql
SELECT 
    tablename,
    policyname,
    cmd,
    roles::text as roles
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'organizations'
ORDER BY policyname, cmd;
```
3. "Run" 버튼 클릭
4. 결과 확인
