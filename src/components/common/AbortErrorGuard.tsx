"use client";

import { useEffect } from "react";

function isAbortError(reason: unknown): boolean {
  if (reason instanceof DOMException && reason.name === "AbortError") return true;
  if (reason instanceof Error && reason.name === "AbortError") return true;
  if (
    typeof reason === "object" &&
    reason !== null &&
    "name" in reason &&
    (reason as { name?: string }).name === "AbortError"
  ) {
    return true;
  }
  return false;
}

export default function AbortErrorGuard() {
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isAbortError(event.reason)) {
        event.preventDefault();
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}
