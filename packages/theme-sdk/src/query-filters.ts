import type { MetaQueryClause, PostQuery, TaxQueryClause } from "./api";
import type { Post, ResolveResult } from "./types";

/** Cách xếp của thanh lọc (?fq_sort=…) → tham số getPosts. */
export const SORTS: Record<string, Pick<PostQuery, "orderBy" | "order">> = {
  date_desc: { orderBy: "date", order: "desc" }, date_asc: { orderBy: "date", order: "asc" },
  title_asc: { orderBy: "title", order: "asc" }, title_desc: { orderBy: "title", order: "desc" },
  modified_desc: { orderBy: "modified", order: "desc" }, rand: { orderBy: "rand" },
};

type Attrs = Record<string, any>;
const SLUG = /^[a-z0-9_-]{1,64}$/i;
const ids = (v: unknown) => String(v ?? "").split(",").map((x) => Number(x.trim())).filter((x) => Number.isInteger(x) && x > 0).slice(0, 100);
const slugs = (v: unknown) => String(v ?? "").split(",").map((x) => x.trim()).filter((x) => SLUG.test(x)).slice(0, 50);
const scalar = (v: string) => (v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : v === "true" ? true : v === "false" ? false : v);

/**
 * Thuộc tính khối Query (bộ lọc 1.27) → tham số getPosts. Hàm thuần để thử được; `now` để cố định ngày trong test.
 * `fromContext`: Query "theo trang đang xem" nhưng có nhận bộ lọc URL → lấy loại bài / mục phân loại của trang lưu trữ rồi lọc thêm.
 */
export function buildPostQuery(a: Attrs, env: { post?: Post | null; data?: ResolveResult | null; now?: Date; fromContext?: boolean }): PostQuery {
  const data = env.data ?? null, cur = env.post ?? data?.post ?? null;
  const url = a.urlFilters === true ? (data?.query ?? {}) : {};
  const q: PostQuery = { type: env.fromContext ? data?.postType ?? a.postType ?? "post" : a.postType ?? "post", perPage: a.perPage ?? 10, orderBy: a.orderBy ?? "date", order: a.order ?? "desc" };
  const tax: TaxQueryClause[] = [];

  // Phân loại: ngữ cảnh (trang mục) + ô Phân loại / Mục + category / tag cũ
  if (env.fromContext && data?.term && SLUG.test(data.term.taxonomy)) tax.push({ taxonomy: data.term.taxonomy, terms: [data.term.slug] });
  const taxonomy = SLUG.test(String(a.taxonomy ?? "")) ? String(a.taxonomy) : undefined;
  const picked = [...slugs(a.terms), ...(a.term && SLUG.test(String(a.term)) ? [String(a.term)] : [])];
  if (taxonomy && picked.length) {
    if (a.termMode === "all") for (const t of picked) tax.push({ taxonomy, terms: [t] });
    else tax.push({ taxonomy, terms: picked, operator: a.termMode === "none" ? "NOT IN" : "IN" });
  }
  if (a.category) tax.push({ taxonomy: "category", terms: [String(a.category)] });
  if (a.tag) tax.push({ taxonomy: "post_tag", terms: [String(a.tag)] });

  // Nguồn
  if (a.source === "manual") { const inc = ids(a.include); q.include = inc.length ? inc : [0]; if (!a.orderBy || a.orderBy === "date") { q.orderBy = "include"; delete q.order; } }
  if (a.source === "related" && cur) {
    const tn = taxonomy ?? (cur.type === "post" ? "category" : Object.keys(cur.terms ?? {})[0]);
    const mine = tn ? (cur.terms?.[tn] ?? []).map((t) => t.slug) : [];
    if (tn && mine.length) tax.push({ taxonomy: tn, terms: mine });
    q.exclude = [...(q.exclude ?? []), cur.id];
  } else if (a.excludeCurrent !== false && cur && (q.type === cur.type || !q.type)) q.exclude = [...(q.exclude ?? []), cur.id];
  const ex = ids(a.exclude); if (ex.length) q.exclude = [...(q.exclude ?? []), ...ex];

  // Trường tuỳ biến (một điều kiện)
  if (typeof a.metaKey === "string" && a.metaKey.trim()) {
    const compare = (["=", "!=", ">", ">=", "<", "<=", "LIKE", "EXISTS", "NOT EXISTS"].includes(a.metaCompare) ? a.metaCompare : "=") as MetaQueryClause["compare"];
    const clause: MetaQueryClause = { key: a.metaKey.trim(), compare };
    if (compare !== "EXISTS" && compare !== "NOT EXISTS") clause.value = compare === "LIKE" ? String(a.metaValue ?? "") : scalar(String(a.metaValue ?? ""));
    q.metaQuery = { clauses: [clause] };
  }

  // Ngày
  const days = Number(a.dateRange);
  if (days > 0) q.after = new Date((env.now ?? new Date()).getTime() - days * 86_400_000);
  if (a.after) q.after = String(a.after);
  if (a.before) q.before = String(a.before);

  if (typeof a.parent === "number") q.parentId = a.parent;
  if (typeof a.offset === "number" && a.offset > 0) q.offset = a.offset;
  if (typeof a.authorId === "number") q.authorId = a.authorId;
  if (a.authorCurrent === true && cur?.author?.id) q.authorId = cur.author.id;
  if (a.search) q.search = String(a.search);
  if (a.sticky === "only") q.sticky = true; else if (a.sticky === "exclude") q.sticky = false;
  if (a.orderByMeta) q.orderByMeta = String(a.orderByMeta);

  // Bộ lọc người đọc chọn trên URL (?fq_s, ?fq_sort, ?fq_<phân loại>)
  if (a.urlFilters === true) {
    if (url.fq_s?.trim()) q.search = url.fq_s.trim().slice(0, 100);
    if (SORTS[url.fq_sort]) { delete q.order; Object.assign(q, SORTS[url.fq_sort]); }
    const tn = taxonomy;
    if (tn && SLUG.test(url[`fq_${tn}`] ?? "")) tax.push({ taxonomy: tn, terms: [url[`fq_${tn}`]] });
  }
  if (tax.length) q.taxQuery = tax;
  // Mọi ?fq_… còn lại chuyển cho plugin đọc (vd giá, giảm giá, còn hàng của plugin bán hàng)
  if (a.urlFilters === true) {
    const extra = Object.fromEntries(Object.entries(url).filter(([k, v]) => /^fq_[a-z0-9_-]{1,40}$/i.test(k) && typeof v === "string" && v.length <= 100 && k !== "fq_s"));
    if (Object.keys(extra).length) q.extra = extra;
  }
  return q;
}
