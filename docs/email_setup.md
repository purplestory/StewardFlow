# 이메일 발송 설정 가이드

초대 링크를 이메일로 자동 발송하는 기능을 사용하려면 이메일 서비스를 설정해야 합니다.

## 현재 상태

현재는 이메일 발송 API Route (`/api/invite/send`)가 구현되어 있지만, 실제 이메일 서비스는 연동되지 않은 상태입니다. 
개발 환경에서는 이메일 내용이 콘솔에 출력되거나 응답에 포함됩니다.

## 이메일 서비스 연동 옵션

### 1. Resend (권장)

Resend는 개발자 친화적인 이메일 서비스입니다.

#### 설정 방법

1. [Resend](https://resend.com)에서 계정 생성
2. API 키 발급
3. `.env.local`에 추가:
   ```bash
   RESEND_API_KEY=re_xxxxxxxxxxxxx
   ```

4. `src/app/api/invite/send/route.ts` 수정:
   ```typescript
   import { Resend } from 'resend';
   
   const resend = new Resend(process.env.RESEND_API_KEY);
   
   await resend.emails.send({
     from: 'noreply@yourdomain.com', // Resend에서 도메인 인증 필요
     to: email,
     subject: emailSubject,
     html: emailBody.replace(/\n/g, '<br>'),
   });
   ```

5. 패키지 설치:
   ```bash
   npm install resend
   ```

### 2. SendGrid

SendGrid는 널리 사용되는 이메일 서비스입니다.

#### 설정 방법

1. [SendGrid](https://sendgrid.com)에서 계정 생성
2. API 키 발급
3. `.env.local`에 추가:
   ```bash
   SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
   ```

4. `src/app/api/invite/send/route.ts` 수정:
   ```typescript
   import sgMail from '@sendgrid/mail';
   
   sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
   
   await sgMail.send({
     from: 'noreply@yourdomain.com',
     to: email,
     subject: emailSubject,
     html: emailBody.replace(/\n/g, '<br>'),
   });
   ```

5. 패키지 설치:
   ```bash
   npm install @sendgrid/mail
   ```

### 3. Supabase Edge Functions

Supabase의 Edge Functions를 사용하여 이메일을 발송할 수 있습니다.

#### 설정 방법

1. Supabase 프로젝트에서 Edge Functions 생성
2. 이메일 발송 로직 구현
3. API Route에서 Edge Function 호출

### 4. AWS SES

AWS SES는 저렴한 비용으로 대량의 이메일을 발송할 수 있습니다.

#### 설정 방법

1. AWS 계정 생성 및 SES 설정
2. `.env.local`에 추가:
   ```bash
   AWS_ACCESS_KEY_ID=xxxxxxxxxxxxx
   AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxx
   AWS_REGION=ap-northeast-2
   ```

3. `src/app/api/invite/send/route.ts` 수정:
   ```typescript
   import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
   
   const sesClient = new SESClient({
     region: process.env.AWS_REGION,
     credentials: {
       accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
       secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
     },
   });
   
   await sesClient.send(new SendEmailCommand({
     Source: 'noreply@yourdomain.com',
     Destination: { ToAddresses: [email] },
     Message: {
       Subject: { Data: emailSubject },
       Body: { Html: { Data: emailBody.replace(/\n/g, '<br>') } },
     },
   }));
   ```

4. 패키지 설치:
   ```bash
   npm install @aws-sdk/client-ses
   ```

## 테스트

개발 환경에서는 이메일이 실제로 발송되지 않고, API 응답에 이메일 내용이 포함됩니다.
프로덕션 환경에서는 선택한 이메일 서비스를 통해 실제 이메일이 발송됩니다.

## 주의사항

- 이메일 서비스 사용 시 도메인 인증이 필요할 수 있습니다
- 스팸 필터를 통과하기 위해 SPF, DKIM, DMARC 설정이 권장됩니다
- 발송량 제한을 확인하세요
- 비용을 확인하세요 (대부분의 서비스는 무료 티어 제공)
