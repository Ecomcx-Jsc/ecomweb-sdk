import { createFetchKit, isFetchKitError } from "next-fetch-kit";
import type { Author, PostContentDoc, CommentPage, Media, Menu, Post, ResolveResult, Site, Term, WidgetInstance } from "./types";
import { getRequestLocale } from "./locale";
import { deprecated } from "./utils";

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

/** Lỗi khi gọi Public API của CMS. `status` = mã HTTP (0 = lỗi mạng / hết thời gian chờ). */
export class CmsApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export interface FetchOptions {
  tags?: string[]; noStore?: boolean; revalidate?: number; query?: Record<string, unknown>; headers?: Record<string, string>; asUser?: boolean;
  /**
   * Chiều biến thiên cache (core ≥ 1.22.0) mà plugin đang bật khai báo trong plugin.json › cacheVary: `{ device: "mobile", "flag:ab": "b" }`.
   * CMS gộp vào khoá cache công khai, mỗi giá trị một bản; chiều chưa ai khai báo bị bỏ qua. Danh sách chiều: GET /api/public/cache-vary.
   * Đọc header / cookie để biết giá trị sẽ khiến trang thành động — chỉ làm khi plugin thật sự cần.
   */
  vary?: Record<string, string>;
}

/** @internal Header X-CMS-Vary từ `vary` ("device=mobile,flag:ab=b"); rỗng → không gửi. */
export function varyHeader(vary?: Record<string, string>): Record<string, string> {
  const parts = Object.entries(vary ?? {}).filter(([k, v]) => /^(device|flag:[a-z][a-z0-9-]{0,23})$/.test(k) && /^[A-Za-z0-9_-]{1,32}$/.test(v)).map(([k, v]) => `${k}=${v.toLowerCase()}`);
  return parts.length ? { "X-CMS-Vary": parts.join(",") } : {};
}

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

/**
 * Gọi thẳng một endpoint của Public API (`/api/public/...`) khi SDK chưa có hàm riêng — lối thoát có cam kết cho theme / plugin.
 * Ưu tiên các hàm `get*`. Lỗi → ném `CmsApiError` (`status` = mã HTTP). Kết quả được cache và gắn tag "cms" để revalidate khi nội dung thay đổi. */
export async function cmsFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  if ((breaker.__cmsApiDownUntil ?? 0) > Date.now()) throw new CmsApiError(503, `CMS API tạm thời không phản hồi: ${path}`);
  const headers = { ...opts.headers, ...varyHeader(opts.vary) };
  const get = () => cmsApi.get<T>(path, opts.noStore
    ? { cache: "no-store", query: opts.query, headers }
    : { next: { tags: ["cms", ...(opts.tags ?? [])], revalidate: opts.revalidate ?? 3600 }, query: opts.query, headers });
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

/** @internal Core dùng để dựng trang theo URL. unlock: giá trị cookie cms-unlock — có thì không dùng cache (nội dung riêng của người đã nhập mật khẩu). */
export const resolvePath = (path: string, query: Record<string, string | string[] | undefined> = {}, noStore = false, unlock?: string) =>
  cmsFetch<ResolveResult>("/resolve", { tags: ["posts"], noStore: noStore || !!unlock, query: clean({ ...query, path }), headers: unlock ? { [UNLOCK_HEADER]: unlock } : undefined });

/** @internal Dữ liệu trang xem trước theo token (core dùng cho Draft Mode). */
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
  /** Bài con của một trong các id này / không thuộc các id này (post_parent__in / __not_in). */
  parentIn?: number[]; parentNotIn?: number[];
  /** Bỏ qua N bài đầu trước khi phân trang (cộng với (page-1)*perPage) — vd 5 bài nổi bật rồi mới phân trang. */
  offset?: number;
  /** true = không đếm tổng (nhanh hơn): `total` = số bài trả về, `totalPages` = page. Cho Tin liên quan, slider, top N. */
  noTotal?: boolean;
  /** true = chỉ bài ghim, false = bỏ bài ghim. */
  sticky?: boolean;
  /** Kèm nội dung đầy đủ (post.content). Mặc định không — danh sách chỉ cần tiêu đề, sapo, ảnh, giúp trang nhẹ và nhanh. */
  withContent?: boolean;
  /**
   * `include` = đúng thứ tự mảng `include`; `relevance` = theo độ khớp với `search` (trang tìm kiếm dùng mặc định); `rand` = ngẫu nhiên (kết quả vẫn được
   * cache, đổi khi cache hết hạn hoặc nội dung đổi).
   */
  page?: number; perPage?: number; orderBy?: "date" | "title" | "modified" | "menu_order" | "comment_count" | "id" | "slug" | "rand" | "include" | "relevance"; order?: "asc" | "desc";
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
/**
 * Danh sách bài đã đăng theo điều kiện (tương đương `WP_Query`). Mặc định không kèm nội dung đầy đủ (`withContent`).
 * Trả `{ items, total, page, totalPages }`; `noTotal: true` bỏ bước đếm tổng.
 * @example const { items } = await getPosts({ type: "post", taxQuery: [{ taxonomy: "category", terms: ["tin-tuc"] }], perPage: 6 });
 * @see docs/query-engine.md
 */
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

/**
 * Bài liền trước (`"prev"`, đăng sớm hơn) hoặc liền sau (`"next"`) cùng loại nội dung (tương đương `get_adjacent_post`).
 * `query` lọc thêm, vd cùng chuyên mục: `{ taxQuery: [{ taxonomy: "category", terms: [slug] }] }`. Không có → `null`.
 * @since 1.44.0
 * @example const [prev, next] = await Promise.all([getAdjacentPost(post, "prev"), getAdjacentPost(post, "next")]);
 */
export async function getAdjacentPost(post: Pick<Post, "id" | "type" | "publishedAt">, direction: "prev" | "next", query: Omit<PostQuery, "after" | "before" | "orderBy" | "order" | "perPage" | "page" | "offset"> = {}): Promise<Post | null> {
  if (!post.publishedAt) return null;
  const at = direction === "prev" ? { before: post.publishedAt, order: "desc" as const } : { after: post.publishedAt, order: "asc" as const };
  const r = await getPosts({ type: post.type, ...query, ...at, orderBy: "date", perPage: 1, noTotal: true, exclude: [...(query.exclude ?? []), post.id] });
  return r.items[0] ?? null;
}

/**
 * Chỉ lấy id bài (tương đương `WP_Query` với `fields => 'ids'`): cùng điều kiện như {@link getPosts}, máy chủ không dựng đối tượng bài.
 * @since 1.44.0
 */
export const getPostIds = async ({ withContent: _w, ...q }: PostQuery = {}) => {
  const { taxQuery, metaQuery, ...rest } = q;
  return cmsFetch<{ items: number[]; total: number; page: number; totalPages: number }>("/posts", { tags: ["posts"], query: clean({
    ...postQueryParams(rest), fields: "ids",
    taxQuery: taxQuery?.length ? JSON.stringify(taxQuery) : undefined,
    metaQuery: metaQuery?.clauses?.length ? JSON.stringify(metaQuery) : undefined,
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

/** CMS trả 404 → null; lỗi khác (mạng, 5xx) ném tiếp để trang không hiện "không tìm thấy" sai khi CMS đang lỗi. */
const nullIf404 = (e: unknown) => { if (e instanceof CmsApiError && e.status === 404) return null; throw e; };

/**
 * Bài đã đăng theo loại nội dung + slug, ngôn ngữ của request hiện tại (tương đương `get_page_by_path`).
 * Không có / chưa đăng → `null`. CMS lỗi → ném `CmsApiError`.
 * @example const about = await getPost("page", "gioi-thieu");
 */
export const getPost = async (type: string, slug: string, locale?: string) =>
  cmsFetch<Post>(`/posts/${type}/${encodeURIComponent(slug)}`, { tags: ["posts"], query: clean({ locale: await loc(locale) }) }).catch(nullIf404);
/**
 * Bài đã đăng theo id (tương đương `get_post($id)`). Không có / chưa đăng → `null`. CMS lỗi → ném `CmsApiError`.
 * @since 1.31.0
 */
export const getPostById = async (id: number) =>
  cmsFetch<Post>(`/posts/id/${id}`, { tags: ["posts", `post:${id}`] }).catch(nullIf404);
/**
 * Mọi term của một phân loại (không phân trang), ngôn ngữ của request (tương đương `get_terms`).
 * `hideEmpty` mặc định `true` = bỏ term chưa có bài. Cần lọc / phân trang / sắp xếp → {@link queryTerms}.
 * @example const cats = await getTerms({ taxonomy: "category" });
 */
export function getTerms(query: { taxonomy: string; hideEmpty?: boolean; locale?: string }): Promise<Term[]>;
/** @deprecated Từ 2.0: dùng `getTerms({ taxonomy, hideEmpty, locale })`. Dạng tham số vị trí bị bỏ ở 3.0. */
export function getTerms(taxonomy: string, hideEmpty?: boolean, locale?: string): Promise<Term[]>;
export async function getTerms(q: string | { taxonomy: string; hideEmpty?: boolean; locale?: string }, hideEmpty = true, locale?: string): Promise<Term[]> {
  if (typeof q === "string") { deprecated("getTerms(taxonomy, hideEmpty, locale)", "getTerms({ taxonomy, hideEmpty, locale })"); q = { taxonomy: q, hideEmpty, locale }; }
  return cmsFetch<Term[]>(`/terms/${encodeURIComponent(q.taxonomy)}`, { tags: ["terms"], query: clean({ hideEmpty: q.hideEmpty ?? true, locale: await loc(q.locale) }) });
}
/** @internal Cookie giữ token bản nháp của Trình dựng (website đang ở chế độ xem trước). */
export const TEMPLATE_DRAFT_COOKIE = "cms-template-draft";

async function templateDraft(): Promise<string | null> {
  try {
    const { cookies, draftMode } = await import("next/headers");
    if (!(await draftMode()).isEnabled) return null;
    return (await cookies()).get(TEMPLATE_DRAFT_COOKIE)?.value ?? null;
  } catch { return null; }
}

/** @internal Template / phần dựng bằng khối của theme đang dùng (bản sửa trong Trình dựng thắng bản của theme; đang xem trước → bản nháp). */
export const getTemplates = async () => {
  const draft = await templateDraft();
  // Mỗi ngôn ngữ có thể có bản template / phần riêng (chưa có thì API trả bản mặc định)
  const locale = await getRequestLocale();
  return cmsFetch<{ theme: string; templates: Record<string, PostContentDoc>; parts: Record<string, PostContentDoc> }>("/templates",
    draft ? { noStore: true, query: clean({ draft, locale }) } : { tags: ["templates"], query: clean({ locale }) });
};

/** Nội dung mẫu đồng bộ (khối syncedPattern). Mẫu đã xoá / chưa xuất bản → `null`; CMS lỗi → ném `CmsApiError`. */
export const getPattern = (id: number) =>
  cmsFetch<PostContentDoc | null>(`/patterns/${id}`, { tags: ["patterns", "posts"] }).catch(nullIf404);

/**
 * Menu gắn ở một vị trí của theme (`theme.json › menuLocations`), ngôn ngữ của request (tương đương `wp_get_nav_menu_items` theo location).
 * Chưa gắn menu → `null`. Vẽ sẵn: `<Menu location="primary" />`.
 */
export const getMenu = async (location: string, locale?: string) =>
  cmsFetch<Menu | null>(`/menus/${location}`, { tags: ["menus"], query: clean({ locale: await loc(locale) }) }).catch(nullIf404);
/** Menu theo id (khối Điều hướng chọn menu cụ thể). Không có → `null`. */
export const getMenuById = (id: number) => cmsFetch<Menu | null>(`/menus/id/${id}`, { tags: ["menus"] }).catch(nullIf404);
/** Widget trong một khu vực (`theme.json › widgetAreas`), theo thứ tự. Vẽ sẵn: `<WidgetArea id="sidebar" />`. */
export const getWidgets = async (area: string, locale?: string) =>
  cmsFetch<WidgetInstance[]>(`/widgets/${area}`, { tags: ["widgets"], query: clean({ locale: await loc(locale) }) });
/** Tham số của {@link getComments}. Bỏ trống = theo Cài đặt › Thảo luận. */
export interface CommentQuery {
  page?: number; perPage?: number; order?: "asc" | "desc";
  /** Bài có mật khẩu: token mở khoá (giá trị cookie, xem {@link requestUnlock}). Có thì không cache. */
  unlock?: string;
}
/**
 * Bình luận đã duyệt của một bài, theo trang → `{ items, total, count, page, totalPages }` (tương đương `get_comments`).
 * Bài có mật khẩu: CMS chỉ trả bình luận khi có `unlock`.
 * @example const { items } = await getComments(post.id, { page: 2 });
 */
export function getComments(postId: number, query?: CommentQuery): Promise<CommentPage>;
/** @deprecated Từ 2.0: dùng `getComments(postId, { page, unlock, perPage, order })`. Dạng tham số vị trí bị bỏ ở 3.0. */
export function getComments(postId: number, page: number, unlock?: string, opts?: { perPage?: number; order?: "asc" | "desc" }): Promise<CommentPage>;
export function getComments(postId: number, q: number | CommentQuery = {}, unlock?: string, opts: { perPage?: number; order?: "asc" | "desc" } = {}): Promise<CommentPage> {
  if (typeof q === "number") { deprecated("getComments(postId, page, unlock, opts)", "getComments(postId, { page, unlock, perPage, order })"); q = { page: q, unlock, ...opts }; }
  const page = q.page ?? 1;
  return cmsFetch<CommentPage>(`/comments/${postId}`, {
    tags: [`comments:${postId}`], noStore: !!q.unlock, query: clean({ page: page > 1 ? page : undefined, perPage: q.perPage, order: q.order }), headers: q.unlock ? { [UNLOCK_HEADER]: q.unlock } : undefined,
  });
}

/** Cookie mở khoá bài có mật khẩu của request hiện tại (server component); ngoài request → undefined. */
export async function requestUnlock(): Promise<string | undefined> {
  try {
    const { cookies } = await import("next/headers");
    return (await cookies()).get(UNLOCK_COOKIE)?.value;
  } catch { return undefined; }
}
/** Số bài theo tháng, mới nhất trước, kèm link trang lưu trữ (tương đương `wp_get_archives`). */
export const getArchives = async (locale?: string) =>
  cmsFetch<Array<{ year: number; month: number; count: number; link: string }>>("/archives", { tags: ["posts"], query: clean({ locale: await loc(locale) }) });
/** Ngôn ngữ đang bật của website và ngôn ngữ mặc định. */
export const getLanguages = () => cmsFetch<{ defaultLocale: string; languages: Array<{ code: string; name: string; isDefault: boolean; flag?: string }> }>("/languages", { tags: ["site"] });
