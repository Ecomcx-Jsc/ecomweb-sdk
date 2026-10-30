import { createFetchKit, isFetchKitError } from "next-fetch-kit";
import type { Author, PostContentDoc, CommentPage, Media, Menu, Post, ResolveResult, Site, Term, WidgetInstance } from "./types";
import { getRequestLocale } from "./locale";

/**
 * Client gọi Public API của CMS (dùng next-fetch-kit: chạy được cả SSR lẫn CSR,
 * tự gộp request trùng trong cùng một lần render, timeout + retry khi lỗi mạng).
 */
export const cmsApi = createFetchKit({
  baseURL: `${(process.env.CMS_API_URL ?? "http://localhost:5100").replace(/\/$/, "")}/api/public`,
  timeout: 8_000,
  retry: 1,
  dedupe: true,
  // Khoá bí mật dùng chung với CMS API: request SSR của website không bị rate limit như khách lạ.
  headers: process.env.CMS_FRONTEND_KEY ? { "X-CMS-Frontend-Key": process.env.CMS_FRONTEND_KEY } : undefined,
});

/** Client gọi endpoint của plugin (/api/plugins/{slug}/…) từ server — dùng qua pluginFetch(). */
const pluginApi = createFetchKit({
  baseURL: `${(process.env.CMS_API_URL ?? "http://localhost:5100").replace(/\/$/, "")}/api/plugins`,
  timeout: 8_000,
  retry: 1,
  dedupe: true,
  headers: process.env.CMS_FRONTEND_KEY ? { "X-CMS-Frontend-Key": process.env.CMS_FRONTEND_KEY } : undefined,
});

/**
 * Gọi endpoint public của plugin khi render trên server: pluginFetch("ecomcx-seo", "/sitemap/news").
 * Cache theo tag "cms" (+ tags) như dữ liệu khác của CMS; noStore để luôn lấy mới.
 * asUser: gửi kèm phiên của người đang xem (endpoint nhận ICurrentUser) — luôn không cache: pluginFetch("shop", "/cart", { asUser: true }).
 */
export async function pluginFetch<T>(slug: string, path: string, opts: FetchOptions = {}): Promise<T> {
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(slug) || !path.startsWith("/") || path.includes("..")) throw new CmsApiError(400, "Đường dẫn plugin không hợp lệ");
  if (opts.asUser) {
    const { getAccessToken } = await import("./auth");
    const token = await getAccessToken();
    opts = { ...opts, noStore: true, headers: { ...opts.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) } };
  }
  try {
    const { data } = await pluginApi.get<T>(`/${slug}${path}`, opts.noStore
      ? { cache: "no-store", query: opts.query, headers: opts.headers }
      : { next: { tags: ["cms", ...(opts.tags ?? [])], revalidate: opts.revalidate ?? 3600 }, query: opts.query, headers: opts.headers });
    return (data ?? null) as T;
  } catch (e) {
    if (isFetchKitError(e)) throw new CmsApiError(e.status ?? 0, `Plugin API ${e.status ?? e.type}: ${slug}${path}`);
    throw e;
  }
}

export class CmsApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export interface FetchOptions { tags?: string[]; noStore?: boolean; revalidate?: number; query?: Record<string, unknown>; headers?: Record<string, string>; asUser?: boolean }

/**
 * API không phản hồi (thường là đang khởi động lại vài giây khi bật/tắt plugin backend):
 * mọi request đang chờ cùng đợi một lần dò /api/health (tối đa 20 giây — máy chủ yếu khởi động lại chậm hơn) rồi gọi lại, thay vì trả trang lỗi 500.
 * API vẫn chưa lên sau 20 giây → ngắt mạch 5 giây: các lần gọi sau báo lỗi ngay, trang không bị treo hàng phút.
 */
const breaker = globalThis as unknown as { __cmsApiDownUntil?: number; __cmsApiRecovering?: Promise<boolean> };
const BREAK_MS = 5_000;
const WAIT_MS = 20_000;
const API_ROOT = (process.env.CMS_API_URL ?? "http://localhost:5100").replace(/\/$/, "");

function waitForApi(): Promise<boolean> {
  breaker.__cmsApiRecovering ??= (async () => {
    const until = Date.now() + WAIT_MS;
    while (Date.now() < until) {
      try {
        const res = await fetch(`${API_ROOT}/api/health`, { cache: "no-store", signal: AbortSignal.timeout(2_000) });
        // "restarting": API sắp tắt để khởi động lại → chờ bản mới
        if (res.ok && (await res.json().catch(() => null))?.status !== "restarting") return true;
      } catch { /* API chưa lên */ }
      await new Promise((r) => setTimeout(r, 400));
    }
    breaker.__cmsApiDownUntil = Date.now() + BREAK_MS;
    return false;
  })().finally(() => { breaker.__cmsApiRecovering = undefined; });
  return breaker.__cmsApiRecovering;
}

/** Lỗi mạng hoặc 502/503/504 (proxy/API đang khởi động) — không tính lỗi 500 thật của API. */
const isUnavailable = (e: unknown) => isFetchKitError(e) && (!e.status || e.status === 502 || e.status === 503 || e.status === 504);

/** Gọi Public API của CMS. Kết quả được cache và gắn tag "cms" để revalidate khi nội dung thay đổi. */
export async function cmsFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  if ((breaker.__cmsApiDownUntil ?? 0) > Date.now()) throw new CmsApiError(503, `CMS API tạm thời không phản hồi: ${path}`);
  const get = () => cmsApi.get<T>(path, opts.noStore
    ? { cache: "no-store", query: opts.query, headers: opts.headers }
    : { next: { tags: ["cms", ...(opts.tags ?? [])], revalidate: opts.revalidate ?? 3600 }, query: opts.query, headers: opts.headers });
  try {
    try { return ((await get()).data ?? null) as T; }
    catch (e) {
      if (!isUnavailable(e) || !(await waitForApi())) throw e;
      return ((await get()).data ?? null) as T;
    }
  } catch (e) {
    if (isFetchKitError(e)) throw new CmsApiError(e.status ?? 0, `CMS API ${e.status ?? e.type}: ${path}`);
    throw e;
  }
}

/** Bỏ giá trị rỗng; mảng → "1,2,3" (API nhận danh sách id phân tách bằng dấu phẩy). */
const clean = (params: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => [k, Array.isArray(v) ? v.join(",") : v]));

/** Thông tin site theo ngôn ngữ của request (hoặc locale truyền vào). */
export const getSite = async (locale?: string) =>
  cmsFetch<Site>("/site", { tags: ["site"], query: clean({ locale: locale ?? (await getRequestLocale()) }) });

/** Cookie (httpOnly) giữ token mở khoá bài có mật khẩu: "12:token,34:token". */
export const UNLOCK_COOKIE = "cms-unlock";
export const UNLOCK_HEADER = "X-CMS-Unlock";

/** unlock: giá trị cookie cms-unlock — có thì không dùng cache (nội dung riêng của người đã nhập mật khẩu). */
export const resolvePath = (path: string, query: Record<string, string | string[] | undefined> = {}, noStore = false, unlock?: string) =>
  cmsFetch<ResolveResult>("/resolve", { tags: ["posts"], noStore: noStore || !!unlock, query: clean({ ...query, path }), headers: unlock ? { [UNLOCK_HEADER]: unlock } : undefined });

export const getPreview = (token: string) => cmsFetch<ResolveResult>("/preview", { noStore: true, query: { token } });

/** Một điều kiện lọc theo taxonomy: bài phải khớp (hoặc không khớp) các term này. */
export interface TaxQueryClause {
  taxonomy: string;
  terms: string[];
  /** Mặc định "IN". "NOT IN" = loại bài thuộc các term này. */
  operator?: "IN" | "NOT IN";
}

/**
 * Một điều kiện lọc theo trường tuỳ biến (post.meta). Giá trị so sánh phải đúng kiểu JSON (số là số).
 *
 * So bằng (`=`, `!=`, `IN`, `NOT IN`, `EXISTS`, `NOT EXISTS`) chạy trên chỉ mục GIN sẵn có — dùng được
 * với mọi khoá meta.
 *
 * So khoảng (`>`, `>=`, `<`, `<=`, `BETWEEN`, `LIKE`) **chỉ dùng được với khoá đã khai báo
 * `filterable`** (backend tạo chỉ mục B-tree cho khoá đó lúc khởi động); khoá chưa khai báo trả 422.
 * Với khoá kiểu số, giá trị phải là số JSON (chuỗi số cũng được, core tự chuyển) — nếu không phép so
 * sẽ so chuỗi ("100" < "20").
 */
export interface MetaQueryClause {
  key: string;
  compare: "=" | "!=" | "IN" | "NOT IN" | "EXISTS" | "NOT EXISTS" | ">" | ">=" | "<" | "<=" | "BETWEEN" | "LIKE";
  /** Bỏ trống với EXISTS / NOT EXISTS. Với LIKE: mẫu có `%` / `_`. */
  value?: string | number | boolean | (string | number | boolean)[];
  /** Cận trên của BETWEEN (bắt buộc với BETWEEN). */
  value2?: string | number;
}

export interface MetaQuery {
  /** Mặc định "AND". */
  relation?: "AND" | "OR";
  clauses: MetaQueryClause[];
}

export interface PostQuery {
  /** Mặc định: ngôn ngữ của request hiện tại. */
  locale?: string;
  type?: string; taxonomy?: string; term?: string; authorId?: number; search?: string;
  /** Lọc nhiều post type cùng lúc (bài viết + trang + job...). Gộp với `type`. */
  types?: string[];
  /** Lọc nhiều taxonomy cùng lúc — thay cho taxonomy/term khi cần AND/OR nhiều điều kiện. */
  taxQuery?: TaxQueryClause[];
  /** Lọc theo trường tuỳ biến; chạy trong cơ sở dữ liệu trên chỉ mục GIN của posts.meta. */
  metaQuery?: MetaQuery;
  /** Chỉ lấy bài thuộc ngữ cảnh này (plugin tự lọc thêm qua filter posts.query). */
  context?: string;
  include?: number[]; exclude?: number[]; parentId?: number;
  /** true = chỉ bài ghim, false = bỏ bài ghim. */
  sticky?: boolean;
  /** Kèm nội dung đầy đủ (post.content). Mặc định không — danh sách chỉ cần tiêu đề, sapo, ảnh, giúp trang nhẹ và nhanh. */
  withContent?: boolean;
  /**
   * `relevance` = theo độ khớp với `search` (trang tìm kiếm dùng mặc định); `rand` = ngẫu nhiên (kết quả vẫn được
   * cache, đổi khi cache hết hạn hoặc nội dung đổi).
   */
  page?: number; perPage?: number; orderBy?: "date" | "title" | "modified" | "menu_order" | "comment_count" | "id" | "slug" | "rand" | "relevance"; order?: "asc" | "desc";
  /** Ngày đăng từ (gồm cả mốc), ISO-8601 hoặc Date — vd sự kiện / tin tức từ đầu năm học. */
  after?: string | Date;
  /** Ngày đăng trước (không gồm mốc). */
  before?: string | Date;
  /** Năm đăng (UTC); kèm `month` 1–12 để lấy một tháng — trang lưu trữ. */
  year?: number;
  month?: number;
  /**
   * Sắp xếp theo một khoá meta đã khai báo `filterable` (vd `"gia"`, `"job_deadline"`) — thay cho `orderBy`.
   * Khoá chưa khai báo trả 422 (không có chỉ mục thì sắp xếp phải quét toàn bảng).
   */
  orderByMeta?: string;
}
export const getPosts = async ({ withContent, ...q }: PostQuery = {}) => {
  // Bóc tách TRONG thân hàm, không phải trong tham số: chữ ký đã công bố của getPosts nằm trong baseline
  // hợp đồng (api/theme-sdk.txt) nên thêm tên vào tham số là đổi một dòng đã ký (CI coi là phá hợp đồng).
  const { taxQuery, metaQuery, ...rest } = q;
  return cmsFetch<{ items: Post[]; total: number; page: number; totalPages: number }>("/posts", { tags: ["posts"], query: clean({
    ...postQueryParams(rest),
    // Bộ lọc phức tạp đi dạng JSON — core phân tích và áp thẳng vào câu SQL (không lọc bằng bộ nhớ).
    taxQuery: taxQuery?.length ? JSON.stringify(taxQuery) : undefined,
    metaQuery: metaQuery?.clauses?.length ? JSON.stringify(metaQuery) : undefined,
    content: withContent ?? false,
    locale: rest.locale ?? (await getRequestLocale()),
  } as Record<string, unknown>) });
};

const loc = async (locale?: string) => locale ?? (await getRequestLocale());

/** Tham số đơn giản của PostQuery → query string (Date → ISO). */
function postQueryParams(q: Omit<PostQuery, "taxQuery" | "metaQuery" | "withContent">): Record<string, unknown> {
  const iso = (d?: string | Date) => (d instanceof Date ? d.toISOString() : d);
  return { ...q, after: iso(q.after), before: iso(q.before) };
}

/** Một trang của danh sách công khai (term, tác giả, media). */
export interface ListPage<T> { items: T[]; total: number; page: number; totalPages: number }

/** Một giá trị facet: slug term (facet phân loại) hoặc giá trị meta, kèm số bài. */
export interface FacetValue { value: string; count: number; termId?: number | null; name?: string | null; parentId?: number | null }
export interface FacetResult { total: number; facets: Record<string, FacetValue[]> }

/**
 * Đếm số bài theo từng giá trị (bộ lọc có số đếm: "Khoa CNTT (12)") trên đúng tập bài mà {@link getPosts} trả về với
 * cùng điều kiện. `facets`: tên phân loại công khai ("category") và/hoặc `"meta:khoá"` (khoá khai báo `filterable`).
 * Tối đa 5 facet × 100 giá trị, đếm trong PostgreSQL.
 * @example const { facets } = await getFacets(["khoa", "meta:hoc-ky"], { type: "khoa-hoc", taxQuery })
 */
export async function getFacets(facets: string[], query: Omit<PostQuery, "page" | "perPage" | "withContent" | "orderBy" | "order" | "orderByMeta"> = {}) {
  const { taxQuery, metaQuery, ...rest } = query;
  return cmsFetch<FacetResult>("/posts/facets", { tags: ["posts"], query: clean({
    ...postQueryParams(rest),
    facets: facets.join(","),
    taxQuery: taxQuery?.length ? JSON.stringify(taxQuery) : undefined,
    metaQuery: metaQuery?.clauses?.length ? JSON.stringify(metaQuery) : undefined,
    locale: rest.locale ?? (await getRequestLocale()),
  } as Record<string, unknown>) });
}

export interface TermQuery {
  taxonomy: string;
  locale?: string;
  /** Tìm theo tên, không phân biệt dấu. */
  search?: string;
  /** Chỉ term con trực tiếp của term này; 0 = chỉ term gốc. */
  parent?: number;
  include?: number[]; exclude?: number[];
  hideEmpty?: boolean;
  /** Chỉ term có meta khoá này (và đúng giá trị nếu có metaValue). */
  metaKey?: string; metaValue?: string;
  orderBy?: "name" | "slug" | "count" | "id"; order?: "asc" | "desc";
  /** perPage 1–500 (mặc định 100). */
  page?: number; perPage?: number;
  /** Tham số thêm cho plugin (filter terms.query đọc trong Query). */
  params?: Record<string, string>;
}
/** Danh sách term có phân trang, lọc theo cha / từ khoá / meta, sắp xếp — bản đầy đủ của {@link getTerms}. */
export const queryTerms = async ({ params, ...q }: TermQuery) =>
  cmsFetch<ListPage<Term>>("/terms", { tags: ["terms"], query: clean({ ...params, ...q, locale: await loc(q.locale) }) });

export interface AuthorQuery {
  locale?: string;
  /** Tìm theo tên hiển thị, không phân biệt dấu. */
  search?: string;
  include?: number[]; exclude?: number[];
  /** Lọc theo meta công khai (khoá khai báo `UserMeta` Public), vd metaKey "khoa". Khoá không công khai → 422. */
  metaKey?: string; metaValue?: string;
  orderBy?: "name" | "post_count" | "id"; order?: "asc" | "desc";
  /** perPage 1–100 (mặc định 20). */
  page?: number; perPage?: number;
  /** Tham số thêm cho plugin (filter authors.query), vd plugin danh bạ thêm vai trò "giang-vien". */
  params?: Record<string, string>;
}
/**
 * Danh sách tác giả công khai (trang "Đội ngũ", danh bạ): mặc định thành viên có bài đã đăng; plugin mở rộng qua
 * filter authors.query. Chỉ có tên, slug, ảnh, tiểu sử, meta công khai — không bao giờ có email.
 */
export const getAuthors = async ({ params, ...q }: AuthorQuery = {}) =>
  cmsFetch<ListPage<Author>>("/authors", { tags: ["authors"], query: clean({ ...params, ...q, locale: await loc(q.locale) }) });

export interface MediaQuery {
  /** Tìm theo tiêu đề, alt, chú thích, tên file — không phân biệt dấu. */
  search?: string;
  /** Tiền tố kiểu file: "image/", "video/", "application/pdf". */
  mime?: string;
  folder?: number;
  include?: number[]; exclude?: number[];
  orderBy?: "date" | "title" | "id" | "size"; order?: "asc" | "desc";
  /** perPage 1–100 (mặc định 20). */
  page?: number; perPage?: number;
  /** Tham số thêm cho plugin (filter media.query). */
  params?: Record<string, string>;
}
/** Danh sách media (thư viện ảnh, tài liệu tải về) — plugin giới hạn / mở rộng qua filter media.query. */
export const getMedia = async ({ params, ...q }: MediaQuery = {}) =>
  cmsFetch<ListPage<Media>>("/media", { tags: ["media"], query: clean({ ...params, ...q }) });

export const getPost = async (type: string, slug: string, locale?: string) =>
  cmsFetch<Post>(`/posts/${type}/${encodeURIComponent(slug)}`, { tags: ["posts"], query: clean({ locale: await loc(locale) }) }).catch(() => null);
export const getTerms = async (taxonomy: string, hideEmpty = true, locale?: string) =>
  cmsFetch<Term[]>(`/terms/${taxonomy}`, { tags: ["terms"], query: clean({ hideEmpty, locale: await loc(locale) }) });
/** Cookie giữ token bản nháp của Trình dựng (website đang ở chế độ xem trước). */
export const TEMPLATE_DRAFT_COOKIE = "cms-template-draft";

async function templateDraft(): Promise<string | null> {
  try {
    const { cookies, draftMode } = await import("next/headers");
    if (!(await draftMode()).isEnabled) return null;
    return (await cookies()).get(TEMPLATE_DRAFT_COOKIE)?.value ?? null;
  } catch { return null; }
}

/** Template / phần dựng bằng khối của theme đang dùng (bản sửa trong Trình dựng thắng bản của theme; đang xem trước → bản nháp). */
export const getTemplates = async () => {
  const draft = await templateDraft();
  return cmsFetch<{ theme: string; templates: Record<string, PostContentDoc>; parts: Record<string, PostContentDoc> }>("/templates",
    draft ? { noStore: true, query: { draft } } : { tags: ["templates"] });
};

/** Nội dung mẫu đồng bộ (khối syncedPattern). null = mẫu đã xoá / chưa xuất bản. */
export const getPattern = (id: number) =>
  cmsFetch<PostContentDoc | null>(`/patterns/${id}`, { tags: ["patterns", "posts"] }).catch(() => null);

export const getMenu = async (location: string, locale?: string) =>
  cmsFetch<Menu | null>(`/menus/${location}`, { tags: ["menus"], query: clean({ locale: await loc(locale) }) });
export const getMenuById = (id: number) => cmsFetch<Menu | null>(`/menus/id/${id}`, { tags: ["menus"] });
export const getWidgets = async (area: string, locale?: string) =>
  cmsFetch<WidgetInstance[]>(`/widgets/${area}`, { tags: ["widgets"], query: clean({ locale: await loc(locale) }) });
/**
 * Bình luận đã duyệt theo trang (số mỗi trang, thứ tự: Cài đặt › Thảo luận).
 * Bài có mật khẩu (core >= 1.15): CMS chỉ trả bình luận khi có token mở khoá — unlock = giá trị cookie cms-unlock (không cache).
 */
export const getComments = (postId: number, page = 1, unlock?: string) =>
  cmsFetch<CommentPage>(`/comments/${postId}`, {
    tags: [`comments:${postId}`], noStore: !!unlock, query: page > 1 ? { page } : undefined, headers: unlock ? { [UNLOCK_HEADER]: unlock } : undefined,
  });

/** Cookie mở khoá bài có mật khẩu của request hiện tại (server component); ngoài request → undefined. */
export async function requestUnlock(): Promise<string | undefined> {
  try {
    const { cookies } = await import("next/headers");
    return (await cookies()).get(UNLOCK_COOKIE)?.value;
  } catch { return undefined; }
}
export const getArchives = async (locale?: string) =>
  cmsFetch<Array<{ year: number; month: number; count: number; link: string }>>("/archives", { tags: ["posts"], query: clean({ locale: await loc(locale) }) });
export const getLanguages = () => cmsFetch<{ defaultLocale: string; languages: Array<{ code: string; name: string; isDefault: boolean; flag?: string }> }>("/languages", { tags: ["site"] });
