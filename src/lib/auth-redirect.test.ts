import { describe, expect, it } from "vitest";

import { sanitizeInternalRedirectPath } from "./auth-redirect";

describe("sanitizeInternalRedirectPath", () => {
  it.each([
    ["root path", "/", "/"],
    ["nested path", "/assets/asset-1", "/assets/asset-1"],
    [
      "path with query and hash",
      "/reservations?status=pending#latest",
      "/reservations?status=pending#latest",
    ],
  ])("keeps a valid internal %s", (_label, value, expected) => {
    expect(sanitizeInternalRedirectPath(value)).toBe(expected);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["empty string", ""],
    ["relative path without a leading slash", "assets/asset-1"],
    [
      "same-origin absolute URL",
      "https://steward-flow.internal/dashboard",
    ],
    ["HTTPS URL", "https://evil.example/account"],
    ["HTTP URL", "http://evil.example/account"],
    [
      "lookalike external origin",
      "https://steward-flow.internal.evil.example/account",
    ],
    ["protocol-relative URL", "//evil.example/account"],
    ["protocol-relative URL with credentials", "//steward-flow.internal@evil.example"],
    ["JavaScript URL", "javascript:alert(1)"],
    ["data URL", "data:text/html,malicious"],
    ["leading backslash", "\\evil.example/account"],
    ["backslash after slash", "/\\evil.example/account"],
    ["backslash inside a path", "/safe\\evil"],
    ["newline", "/safe\npath"],
    ["carriage return", "/safe\rpath"],
    ["tab", "/safe\tpath"],
    ["null character", "/safe\u0000path"],
    ["delete character", "/safe\u007fpath"],
  ])("rejects %s", (_label, value) => {
    expect(sanitizeInternalRedirectPath(value)).toBeNull();
  });
});
