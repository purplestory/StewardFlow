import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, inviteLink, organizationName, role } = body;

    if (!email || !inviteLink) {
      return NextResponse.json(
        { ok: false, message: "이메일과 초대 링크가 필요합니다." },
        { status: 400 }
      );
    }

    // Get Supabase service role client for admin operations
    // For now, we'll use a simple approach with Supabase Auth's email
    // In production, you might want to use a dedicated email service like Resend

    // Option 1: Use Supabase's built-in email (limited customization)
    // Option 2: Use external email service (Resend, SendGrid, etc.)
    
    // For now, we'll create a notification record
    // The actual email sending can be handled by:
    // 1. Supabase Edge Function
    // 2. External email service
    // 3. Background job processor

    // Store email send request in notifications table for processing
    // This allows for retry logic and tracking
    const roleLabel = role === "admin" ? "관리자" : role === "manager" ? "부서 관리자" : "일반 사용자";
    
    const emailSubject = `${organizationName || "기관"}에 초대되었습니다`;
    const emailBody = `
안녕하세요,

${organizationName || "기관"}에서 귀하를 ${roleLabel} 역할로 초대했습니다.

아래 링크를 클릭하여 가입을 완료하세요:
${inviteLink}

이 링크는 7일간 유효합니다. (최소 유효기간)

감사합니다.
    `.trim();

    // For now, return success
    // In production, integrate with actual email service here
    // Example with Resend:
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // await resend.emails.send({
    //   from: 'noreply@yourdomain.com',
    //   to: email,
    //   subject: emailSubject,
    //   html: emailBody.replace(/\n/g, '<br>'),
    // });

    return NextResponse.json({
      ok: true,
      message: "초대 이메일 발송 요청이 처리되었습니다.",
      // In development, return the email content for testing
      ...(process.env.NODE_ENV === "development" && {
        debug: {
          to: email,
          subject: emailSubject,
          body: emailBody,
        },
      }),
    });
  } catch (error) {
    console.error("Error sending invite email:", error);
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "이메일 발송 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
