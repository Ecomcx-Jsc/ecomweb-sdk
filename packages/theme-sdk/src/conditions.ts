import type { ResolveResult } from "./types";

/**
 * Điều kiện loại trang (tương đương conditional tags của WP: `is_front_page`, `is_single`…), đọc từ `data` của `TemplateProps`.
 * Hàm thuần, không gọi mạng, chạy được ở server và client.
 * @since 1.44.0
 */
type Page = Pick<ResolveResult, "kind"> & { templates?: string[] } & { post?: { slug?: string; type?: string } | null; term?: { slug?: string; taxonomy?: string } | null };

const ARCHIVE_KINDS: ReadonlySet<string> = new Set(["category", "tag", "taxonomy", "author", "date", "archive"]);

/** Trang chủ của website, dạng bài mới hoặc trang tĩnh — `is_front_page`. */
export const isFrontPage = (data: Page) => data.kind === "front-page" || (data.kind === "home" && data.templates?.[0] === "front-page");
/** Danh sách bài của blog — `is_home`: trang chủ dạng bài mới, hoặc trang được chọn làm "Trang bài viết" (Cài đặt › Đọc). */
export const isHome = (data: Page) => data.kind === "home";
/** Một bài (không phải trang tĩnh); `type` để kiểm tra loại nội dung, vd `isSingle(data, "product")` — `is_single` / `is_singular($type)`. */
export const isSingle = (data: Page, type?: string) => data.kind === "single" && (!type || data.post?.type === type);
/** Trang tĩnh; `slug` để kiểm tra trang cụ thể, vd `isPage(data, "lien-he")` — `is_page`. */
export const isPage = (data: Page, slug?: string) => (data.kind === "page" || data.kind === "front-page") && (!slug || data.post?.slug === slug);
/** Bài hoặc trang tĩnh (có `data.post`) — `is_singular`. */
export const isSingular = (data: Page) => isSingle(data) || isPage(data);
/** Trang chuyên mục; `slug` để kiểm tra chuyên mục cụ thể — `is_category`. */
export const isCategory = (data: Page, slug?: string) => data.kind === "category" && (!slug || data.term?.slug === slug);
/** Trang thẻ; `slug` để kiểm tra thẻ cụ thể — `is_tag`. */
export const isTag = (data: Page, slug?: string) => data.kind === "tag" && (!slug || data.term?.slug === slug);
/** Trang của phân loại tuỳ biến; `taxonomy` để kiểm tra phân loại cụ thể — `is_tax`. */
export const isTax = (data: Page, taxonomy?: string) => data.kind === "taxonomy" && (!taxonomy || data.term?.taxonomy === taxonomy);
/** Trang tác giả — `is_author`. */
export const isAuthor = (data: Page) => data.kind === "author";
/** Trang lưu trữ theo ngày — `is_date`. */
export const isDate = (data: Page) => data.kind === "date";
/** Mọi trang lưu trữ: chuyên mục, thẻ, phân loại, tác giả, ngày, lưu trữ theo loại nội dung — `is_archive`. */
export const isArchive = (data: Page) => ARCHIVE_KINDS.has(data.kind);
/** Trang kết quả tìm kiếm — `is_search`. */
export const isSearch = (data: Page) => data.kind === "search";
/** Trang không tìm thấy — `is_404`. */
export const is404 = (data: Page) => data.kind === "404";
