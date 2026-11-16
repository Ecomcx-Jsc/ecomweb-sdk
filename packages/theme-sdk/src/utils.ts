import type { Site } from "./types";

const warned = new Set<string>();
/** @internal Cảnh báo một lần mỗi tiến trình khi gọi API đã cũ (chỉ ở môi trường dev). */
export function deprecated(old: string, use: string) {
  if (process.env.NODE_ENV === "production" || warned.has(old)) return;
  warned.add(old);
  console.warn(`[ecomweb-theme-sdk] ${old} đã cũ, dùng ${use}. Xem CHANGELOG của @ecomcx/ecomweb-theme-sdk.`);
}

/**
 * Định dạng một ngày theo cấu hình ngày của website (Cài đặt › Chung: `site.dateFormat`, `site.timezone`) — tương đương `date_i18n`.
 * Token: `yyyy`, `MMMM` (tên tháng theo `site.locale`), `MM`, `dd`, `d`. Luôn truyền `site` (có trong `TemplateProps`): thiếu thì dùng
 * `dd/MM/yyyy` + `Asia/Ho_Chi_Minh`, không theo cấu hình admin. Giá trị rỗng → `""`. Chạy được ở server và client.
 * @example formatDate(post.publishedAt, site) // "16/11/2026"
 */
export function formatDate(value: string | null | undefined, site?: Pick<Site, "dateFormat" | "timezone"> & { locale?: string }) {
  if (!value) return "";
  const d = new Date(value);
  const tz = site?.timezone || "Asia/Ho_Chi_Minh";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "2-digit", month: "2-digit", year: "numeric" })
      .formatToParts(d).map((p) => [p.type, p.value]),
  );
  const monthLong = new Intl.DateTimeFormat(site?.locale ?? "vi", { timeZone: tz, month: "long" }).format(d);
  const fmt = site?.dateFormat || "dd/MM/yyyy";
  return fmt
    .replace("yyyy", parts.year)
    .replace("MMMM", monthLong)
    .replace("MM", parts.month)
    .replace("dd", parts.day)
    .replace(/\bd\b/, String(Number(parts.day)));
}

/**
 * Đọc một giá trị Tuỳ biến của theme (`theme.json › settings`) từ `settings` của `TemplateProps` / `LayoutProps`, kèm giá trị dự phòng
 * (tương đương `get_theme_mod`). Rỗng / chưa đặt → `fallback`. Không gọi mạng.
 * @example setting(settings, "showComments", true)
 */
export function setting<T = string>(settings: Record<string, unknown>, key: string, fallback: T): T {
  const v = settings?.[key];
  return (v === undefined || v === null || v === "" ? fallback : v) as T;
}

/**
 * Đường dẫn trang thứ `page` của một danh sách (`/tin-tuc/page/2`), giữ từ khoá tìm kiếm nếu có. Trang 1 → đường dẫn gốc.
 * Danh sách có bộ lọc khác → {@link pageLinkWithQuery}.
 */
export function pageLink(basePath: string, page: number, search?: string | null) {
  const base = basePath === "/" ? "" : basePath.replace(/\/$/, "");
  const path = page <= 1 ? base || "/" : `${base}/page/${page}`;
  return search ? `${path}${path.includes("?") ? "&" : "?"}s=${encodeURIComponent(search)}` : path;
}

/**
 * Link của một trang trong danh sách CÓ bộ lọc: giữ nguyên mọi tham số truy vấn hiện có (phòng ban,
 * mức lương, từ khoá…) và chỉ đổi số trang. Truyền `data.query` của trang vào.
 *
 *   <Link href={pageLinkWithQuery(data.basePath, 2, data.query)}>2</Link>
 */
export function pageLinkWithQuery(basePath: string, page: number, query?: Record<string, string> | null) {
  const base = basePath === "/" ? "" : basePath.replace(/\/$/, "");
  const path = page <= 1 ? base || "/" : `${base}/page/${page}`;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    // "page" do đường dẫn quyết định; tham số rỗng không cần giữ
    if (k === "page" || v === "" || v === undefined || v === null) continue;
    params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `${path}${path.includes("?") ? "&" : "?"}${qs}` : path;
}

/** Ghép class CSS, bỏ giá trị rỗng / false (như `clsx`). @example cx("card", active && "is-active") */
export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
