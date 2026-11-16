import { cache } from "react";
import { ACCESS_COOKIE, type CurrentUser } from "./auth-shared";

export { ACCESS_COOKIE, REFRESH_COOKIE, safeRedirect, type CurrentUser } from "./auth-shared";

const API = (process.env.CMS_API_URL ?? "http://localhost:5100").replace(/\/$/, "");
// Khoá frontend: request SSR của website không bị tính chung giới hạn đăng nhập theo IP của máy chủ website
const KEY_HEADER: Record<string, string> = process.env.CMS_FRONTEND_KEY ? { "X-CMS-Frontend-Key": process.env.CMS_FRONTEND_KEY } : {};

/** @internal Access token của người đang xem (server). Theme dùng `getCurrentUser()` / `pluginFetch(..., { asUser: true })`. Trang gọi hàm này sẽ render theo từng người (không cache tĩnh). */
export const getAccessToken = cache(async (): Promise<string | undefined> => {
  try {
    const { cookies } = await import("next/headers");
    return (await cookies()).get(ACCESS_COOKIE)?.value;
  } catch {
    return undefined; // ngoài request (build)
  }
});

/**
 * Người đang đăng nhập trên website, null nếu là khách.
 * Dùng trong Server Component, route, generateMetadata. Component client: dùng useCurrentUser() hoặc nhận qua props.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = await getAccessToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API}/api/auth/me`, { headers: { ...KEY_HEADER, Authorization: `Bearer ${token}` }, cache: "no-store" });
    return res.ok ? ((await res.json()) as CurrentUser) : null;
  } catch {
    return null;
  }
});

/** Người dùng có quyền này không — current_user_can(). */
export function userCan(user: CurrentUser | null | undefined, capability: string) {
  return !!user?.capabilities.includes(capability);
}

/**
 * Bắt buộc đăng nhập: khách bị chuyển tới /login, đăng nhập xong quay lại <paramref name="returnTo"/>.
 *   const user = await requireUser("/account");
 */
export async function requireUser(returnTo = "/"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (user) return user;
  const [{ redirect }, { getSite }, { localeHref }] = await Promise.all([import("next/navigation"), import("./api"), import("./locale")]);
  // Trang đăng nhập cùng ngôn ngữ với trang đang xem (/en/login khi đang ở tiếng Anh)
  return redirect(`${localeHref(await getSite(), "/login")}?redirect=${encodeURIComponent(returnTo)}`);
}
