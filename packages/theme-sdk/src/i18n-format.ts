import { IntlMessageFormat } from "intl-messageformat";

/**
 * Định dạng một thông điệp ICU (dùng chung cho getT phía server và useT phía trình duyệt).
 * Thiếu biến hoặc cú pháp sai → thay {biến} thô, không ném lỗi.
 */
export function formatMessage(src: string, locale: string, vars: Record<string, string | number> | undefined, compiled: Map<string, IntlMessageFormat | null>, id: string) {
  if (!src.includes("{") && !src.includes("'")) return src;
  if (!compiled.has(id)) {
    try { compiled.set(id, new IntlMessageFormat(src, locale, undefined, { ignoreTag: true })); } catch { compiled.set(id, null); }
  }
  const f = compiled.get(id);
  try { if (f) return String(f.format(vars)); } catch { /* thiếu biến → thay thô */ }
  let s = src;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
