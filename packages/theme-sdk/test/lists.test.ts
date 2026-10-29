import assert from "node:assert/strict";
import { test } from "node:test";
import { getAuthors, getFacets, getMedia, getPosts, queryTerms } from "../src/api";

// Danh sách công khai mới (core ≥ 1.15.0): kiểm tra URL + tham số mà SDK gửi lên Public API.
// fetch được thay bằng hàm ghi lại request — không cần CMS chạy.

const calls: URL[] = [];
globalThis.fetch = (async (input: RequestInfo | URL) => {
  calls.push(new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url));
  return new Response(JSON.stringify({ items: [], total: 0, page: 1, totalPages: 0, facets: {} }), { headers: { "content-type": "application/json" } });
}) as typeof fetch;
const last = () => calls[calls.length - 1]!;

test("getPosts: after/before (Date → ISO), year/month, orderBy mới", async () => {
  await getPosts({ locale: "vi", after: new Date("2026-09-01T00:00:00Z"), before: "2026-12-31", year: 2026, month: 10, orderBy: "relevance", search: "tuyen sinh" });
  const u = last();
  assert.equal(u.pathname, "/api/public/posts");
  assert.equal(u.searchParams.get("after"), "2026-09-01T00:00:00.000Z");
  assert.equal(u.searchParams.get("before"), "2026-12-31");
  assert.equal(u.searchParams.get("year"), "2026");
  assert.equal(u.searchParams.get("month"), "10");
  assert.equal(u.searchParams.get("orderBy"), "relevance");
});

test("getFacets: danh sách facet + cùng bộ lọc với getPosts", async () => {
  await getFacets(["khoa", "meta:hoc-ky"], { locale: "vi", type: "khoa-hoc", taxQuery: [{ taxonomy: "khoa", terms: ["cntt"] }] });
  const u = last();
  assert.equal(u.pathname, "/api/public/posts/facets");
  assert.equal(u.searchParams.get("facets"), "khoa,meta:hoc-ky");
  assert.equal(u.searchParams.get("type"), "khoa-hoc");
  assert.equal(u.searchParams.get("taxQuery"), '[{"taxonomy":"khoa","terms":["cntt"]}]');
  assert.equal(u.searchParams.get("metaQuery"), null);
});

test("queryTerms: phân trang, cha, meta, tham số thêm cho plugin", async () => {
  await queryTerms({ taxonomy: "category", locale: "en", parent: 0, metaKey: "mau", metaValue: "xanh", include: [1, 2], perPage: 5, params: { "my-plugin": "x" } });
  const u = last();
  assert.equal(u.pathname, "/api/public/terms");
  assert.equal(u.searchParams.get("taxonomy"), "category");
  assert.equal(u.searchParams.get("parent"), "0");
  assert.equal(u.searchParams.get("include"), "1,2");
  assert.equal(u.searchParams.get("metaKey"), "mau");
  assert.equal(u.searchParams.get("locale"), "en");
  assert.equal(u.searchParams.get("my-plugin"), "x");
});

test("getAuthors / getMedia: đường dẫn + bộ lọc", async () => {
  await getAuthors({ locale: "vi", search: "nguyen", metaKey: "khoa", metaValue: "cntt", orderBy: "post_count", params: { "danh-ba": "1" } });
  let u = last();
  assert.equal(u.pathname, "/api/public/authors");
  assert.equal(u.searchParams.get("search"), "nguyen");
  assert.equal(u.searchParams.get("orderBy"), "post_count");
  assert.equal(u.searchParams.get("danh-ba"), "1");
  await getMedia({ mime: "application/pdf", exclude: [9], perPage: 50 });
  u = last();
  assert.equal(u.pathname, "/api/public/media");
  assert.equal(u.searchParams.get("mime"), "application/pdf");
  assert.equal(u.searchParams.get("exclude"), "9");
  assert.equal(u.searchParams.get("perPage"), "50");
});
