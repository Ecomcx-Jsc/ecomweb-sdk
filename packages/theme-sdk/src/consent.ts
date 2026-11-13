/**
 * Consent API (như WP Consent API): hợp đồng chung giữa plugin hỏi khách (banner cookie) và plugin cần biết câu trả lời
 * (analytics, pixel, widget chat, video nhúng…). Core không có banner, không chọn optin/optout thay ai — chỉ là API.
 *
 * Lựa chọn của khách chỉ đọc ở TRÌNH DUYỆT: HTML giống nhau cho mọi khách → trang cache được (không đọc cookie lúc render).
 *   Bên hỏi (trình duyệt):  hasConsent("statistics") / getConsent() từ "@ecomcx/ecomweb-theme-sdk/client";
 *                           on("consent.changed", …) để nạp script khi khách vừa cho phép.
 *   Plugin banner:          setConsent([...]) ở trình duyệt; mặc định khi khách chưa chọn khai ở 2 chỗ (cùng một cài đặt của site):
 *                           <meta name="cms-consent" content="optin"> trong <head> (trình duyệt đọc)
 *                           và filter "consent.default" (server, vd quyết định có in <noscript> theo dõi hay không).
 * Chưa có plugin banner → mọi nhóm được phép (website chạy như trước).
 */
export const CONSENT_CATEGORIES = ["functional", "preferences", "statistics", "statistics-anonymous", "marketing"] as const;
export type ConsentCategory = (typeof CONSENT_CATEGORIES)[number];

/** Lưu ở cookie tuỳ chọn "cms-pref-consent" (xem setPreference). */
export const CONSENT_PREF = "consent";
/** <meta name="cms-consent" content="optin|optout">: plugin banner khai mặc định cho trình duyệt. */
export const CONSENT_META = "cms-consent";
const NONE = "none";

/** Giá trị cookie → các nhóm khách đã đồng ý; undefined = khách chưa trả lời. */
export function parseConsent(value: string | undefined): ConsentCategory[] | undefined {
  if (value === undefined || value === "") return undefined;
  if (value === NONE) return [];
  return value.split("_").filter((c): c is ConsentCategory => (CONSENT_CATEGORIES as readonly string[]).includes(c));
}

/** Các nhóm → giá trị cookie ("functional" luôn được phép nên không lưu). */
export function serializeConsent(categories: readonly ConsentCategory[]): string {
  const list = CONSENT_CATEGORIES.filter((c) => c !== "functional" && categories.includes(c));
  return list.length ? list.join("_") : NONE;
}

/** Quyết định cho một nhóm: khách đã trả lời thì theo câu trả lời, chưa thì theo mặc định của plugin banner. */
export function decideConsent(category: ConsentCategory, choice: ConsentCategory[] | undefined, fallback: boolean): boolean {
  if (category === "functional") return true;
  return choice ? choice.includes(category) : fallback;
}

/**
 * (Server) Mặc định của site khi khách CHƯA chọn — filter "consent.default", không có plugin banner → true.
 * Không đọc cookie nên không làm mất cache trang; dùng cho phần không có JS (vd <noscript> của GTM).
 */
export async function consentDefault(category: ConsentCategory): Promise<boolean> {
  if (category === "functional") return true;
  // import động: client.tsx dùng chung file này mà không kéo runtime (server) vào bundle trình duyệt
  const { applyFilters } = await import("./runtime");
  return (await applyFilters("consent.default", true, { category })) !== false;
}
