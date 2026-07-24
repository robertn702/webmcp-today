/**
 * Read a string entry from FormData without a type assertion. File uploads
 * and missing keys yield the fallback — form fields submitted by the
 * better-auth UI components are always plain text inputs.
 */
export function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Like {@link formString}, but preserves `null` for absent keys. */
export function formStringOrNull(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" ? value : null;
}
