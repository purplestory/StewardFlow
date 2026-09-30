import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./page";

const mocks = vi.hoisted(() => ({ searchParams: new URLSearchParams() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => mocks.searchParams,
}));
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/components/auth/AuthCard", () => ({
  default: () => createElement("button", { type: "button" }, "카카오톡으로 로그인"),
}));

const render = () => renderToStaticMarkup(createElement(LoginPage));

describe("login callback error feedback", () => {
  beforeEach(() => { mocks.searchParams = new URLSearchParams(); });

  it("keeps the regular login screen free of error alerts", () => {
    const html = render();
    expect(html).toContain("카카오톡으로 로그인");
    expect(html).not.toContain('role="alert"');
  });

  it("announces callback failures without hiding the retry action", () => {
    mocks.searchParams.set("error", "카카오 인증이 취소되었습니다.");
    const html = render();
    expect(html).toContain('role="alert"');
    expect(html).toContain("카카오 인증이 취소되었습니다.");
    expect(html).toContain("카카오톡으로 로그인");
  });

  it("renders untrusted provider messages as text", () => {
    mocks.searchParams.set("error", "<script>unsafe</script>");
    const html = render();
    expect(html).toContain("&lt;script&gt;unsafe&lt;/script&gt;");
    expect(html).not.toContain("<script>unsafe</script>");
  });
});
