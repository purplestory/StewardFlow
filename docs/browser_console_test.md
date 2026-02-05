# 브라우저 콘솔 테스트 코드

브라우저 개발자 도구(F12)의 Console 탭에서 다음 코드를 실행하세요.

## 1. Supabase 클라이언트 가져오기

```javascript
// Next.js 앱에서 supabase 클라이언트 가져오기
const { supabase } = await import('/src/lib/supabase.ts');
```

또는 더 간단하게:

```javascript
// window 객체에서 supabase 찾기 (개발 환경)
const supabase = window.__SUPABASE__ || (await import('/src/lib/supabase.ts')).supabase;
```

## 2. 프로필 확인 (안전한 방법)

```javascript
(async () => {
  try {
    // Supabase 클라이언트 가져오기
    const supabaseModule = await import('/src/lib/supabase.ts');
    const supabase = supabaseModule.supabase;
    
    // 세션 확인
    const { data: session } = await supabase.auth.getSession();
    console.log("1. User ID:", session.session?.user?.id);
    
    if (!session.session?.user) {
      console.log("로그인이 필요합니다.");
      return;
    }
    
    // 프로필 조회
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, email, name, organization_id, role")
      .eq("id", session.session.user.id)
      .maybeSingle();
    
    console.log("2. Profile:", profile);
    console.log("3. Error:", error);
    console.log("4. Has organization_id:", !!profile?.organization_id);
    
    if (error) {
      console.error("프로필 조회 오류:", error);
    }
  } catch (err) {
    console.error("테스트 오류:", err);
  }
})();
```

## 3. Assets, Spaces, Vehicles 확인

```javascript
(async () => {
  try {
    const supabaseModule = await import('/src/lib/supabase.ts');
    const supabase = supabaseModule.supabase;
    
    // Assets 확인
    const { data: assets, error: assetsError } = await supabase
      .from("assets")
      .select("id, name, organization_id")
      .is("deleted_at", null)
      .limit(5);
    
    console.log("Assets:", assets);
    console.log("Assets error:", assetsError);
    
    // Spaces 확인
    const { data: spaces, error: spacesError } = await supabase
      .from("spaces")
      .select("id, name, organization_id")
      .limit(5);
    
    console.log("Spaces:", spaces);
    console.log("Spaces error:", spacesError);
    
    // Vehicles 확인
    const { data: vehicles, error: vehiclesError } = await supabase
      .from("vehicles")
      .select("id, name, organization_id")
      .limit(5);
    
    console.log("Vehicles:", vehicles);
    console.log("Vehicles error:", vehiclesError);
  } catch (err) {
    console.error("테스트 오류:", err);
  }
})();
```

## 4. 가장 간단한 방법 (Next.js 개발 환경)

Next.js 개발 환경에서는 다음과 같이 직접 접근할 수 있습니다:

```javascript
// 개발 환경에서만 작동
if (typeof window !== 'undefined') {
  // React DevTools나 Next.js가 제공하는 전역 변수 확인
  console.log("Available globals:", Object.keys(window).filter(k => k.includes('supabase')));
}
```

## 5. 네트워크 탭에서 확인

브라우저 개발자 도구의 Network 탭에서:
1. "profiles" 또는 "assets"로 필터링
2. 실패한 요청(빨간색) 클릭
3. Response 탭에서 오류 메시지 확인

## 참고

- 브라우저 콘솔에서 직접 테스트하는 것보다, 애플리케이션 코드의 콘솔 로그를 확인하는 것이 더 정확합니다.
- 위의 테스트 코드는 Next.js 개발 환경에서만 작동할 수 있습니다.
- 프로덕션 환경에서는 보안상의 이유로 직접 접근이 제한될 수 있습니다.
