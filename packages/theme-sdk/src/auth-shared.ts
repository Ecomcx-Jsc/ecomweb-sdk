/** Tên cookie phiên đăng nhập của website (httpOnly, do frontend core đặt). Dùng chung cho proxy và SDK. */
export const ACCESS_COOKIE = "cms_at";
export const REFRESH_COOKIE = "cms_rt";

/** Người dùng đang đăng nhập trên website. */
export interface CurrentUser {
  id: number;
  email: string;
  userName: string;
  displayName: string;
  roles: string[];
  capabilities: string[];
  /** Giới thiệu (core ≥ 1.20.0). */
  bio?: string | null;
}

/**
 * Chỉ nhận đường dẫn nội bộ ("/account") — chặn chuyển hướng ra trang ngoài (?redirect=https://lừa-đảo).
 * Trình duyệt bỏ tab / xuống dòng và coi "\" như "/" khi phân tích URL, nên "/<TAB>/evil.com" hay "/\evil.com" thành "//evil.com":
 * chặn mọi ký tự điều khiển và dấu "\" ở bất kỳ vị trí nào, không chỉ ở đầu.
 */
export function safeRedirect(target: string | null | undefined, fallback = "/") {
  // eslint-disable-next-line no-control-regex
  if (!target || !target.startsWith("/") || /[\u0000-\u001f\u007f\\]/.test(target)) return fallback;
  return target.startsWith("//") ? fallback : target;
}
