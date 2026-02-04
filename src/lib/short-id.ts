import { nanoid } from "nanoid";

/**
 * Generate a short, URL-safe unique ID
 * Default length is 8 characters, which provides ~2.8 trillion unique IDs
 * For more uniqueness, you can increase the length
 */
export function generateShortId(length: number = 8): string {
  return nanoid(length);
}

/**
 * Check if a string is a UUID (36 characters with hyphens)
 */
export function isUUID(str: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}
