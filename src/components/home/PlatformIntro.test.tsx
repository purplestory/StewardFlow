import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PlatformIntro from "./PlatformIntro";

const mocks = vi.hoisted(() => ({ useHeaderSession: vi.fn() }));

vi.mock("@/components/layout/useHeaderSession", () => mocks);
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const guestSession = {
  isAuthed: false,
  hasOrganization: false,
  loading: false,
  error: null,
  retry: vi.fn(),
  menuLabels: null,
  menuOrder: [],
  mainNavItems: [],
};

const render = () => renderToStaticMarkup(createElement(PlatformIntro));

describe("PlatformIntro navigation states", () => {
  beforeEach(() => mocks.useHeaderSession.mockReturnValue(guestSession));

  it("routes guests to login without linking protected resources", () => {
    const html = render();
    expect(html).toContain('href="/login"');
    for (const path of ["/books", "/assets", "/spaces", "/vehicles", "/join"]) {
      expect(html).not.toContain(`href="${path}"`);
    }
  });

  it("keeps configured menu labels and order", () => {
    mocks.useHeaderSession.mockReturnValue({
      ...guestSession,
      isAuthed: true,
      hasOrganization: true,
      menuLabels: { spaces: "회의실", books: "도서관" },
      menuOrder: [{ key: "spaces", enabled: true }, { key: "books", enabled: true }],
      mainNavItems: [{ href: "/spaces", label: "회의실" }, { href: "/books", label: "도서관" }],
    });
    const html = render();
    expect(html).toContain('aria-label="회의실: 바로가기"');
    expect(html).toContain('aria-label="도서관: 바로가기"');
    expect(html.indexOf('href="/spaces"')).toBeLessThan(html.indexOf('href="/books"'));
  });

  it("does not link modules absent from the header navigation", () => {
    mocks.useHeaderSession.mockReturnValue({
      ...guestSession,
      isAuthed: true,
      hasOrganization: true,
      mainNavItems: [{ href: "/books", label: "도서" }],
    });
    const html = render();
    expect(html).toContain('href="/books"');
    expect(html).not.toContain('href="/assets"');
    expect(html).toContain("사용 안 함");
  });

  it("shows a retry state instead of joining or logging in on lookup failure", () => {
    mocks.useHeaderSession.mockReturnValue({ ...guestSession, error: "기관 메뉴를 불러오지 못했습니다." });
    const html = render();
    expect(html).toContain('role="alert"');
    expect(html).toContain("다시 시도");
    expect(html).not.toContain('href="/join"');
    expect(html).not.toContain('href="/login"');
  });

  it("keeps all resource links inactive while loading", () => {
    mocks.useHeaderSession.mockReturnValue({ ...guestSession, loading: true });
    const html = render();
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('href="/login"');
    expect(html).toContain("확인 중");
  });

  it("offers joining only for a verified member without an organization", () => {
    mocks.useHeaderSession.mockReturnValue({ ...guestSession, isAuthed: true });
    expect(render()).toContain('href="/join"');
  });

  it("escapes organization-defined labels", () => {
    mocks.useHeaderSession.mockReturnValue({
      ...guestSession,
      menuLabels: { books: "<script>unsafe</script>" },
    });
    const html = render();
    expect(html).toContain("&lt;script&gt;unsafe&lt;/script&gt;");
    expect(html).not.toContain("<script>unsafe</script>");
  });
});
