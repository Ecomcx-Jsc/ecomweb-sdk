import { applyFilters } from "./runtime";
import type { ConsentCategory } from "./consent";

// Tách khỏi consent.ts: file đó dùng chung với client.tsx, còn hàm này cần runtime (server-only).
/**
 * (Server) Mặc định của site khi khách CHƯA chọn — filter "consent.default", không có plugin banner → true.
 * Không đọc cookie nên không làm mất cache trang; dùng cho phần không có JS (vd <noscript> của GTM).
 */
export async function consentDefault(category: ConsentCategory): Promise<boolean> {
  if (category === "functional") return true;
  return (await applyFilters("consent.default", true, { category })) !== false;
}
