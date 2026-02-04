/**
 * Get the origin URL, converting 0.0.0.0 to localhost for Safari compatibility
 */
export function getOrigin(): string {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  }

  const origin = window.location.origin;
  
  // Convert 0.0.0.0 to localhost for Safari compatibility
  if (origin.includes("0.0.0.0")) {
    return origin.replace("0.0.0.0", "localhost");
  }
  
  return origin;
}
