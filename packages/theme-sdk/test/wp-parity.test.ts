import assert from "node:assert/strict";
import { test } from "node:test";
import { CmsApiError, getAdjacentPost, getPost, getPostById } from "../src/api";
import { isArchive, isAuthor, isCategory, isDate, isFrontPage, isHome, isPage, isSearch, isSingle, isSingular, isTag, isTax, is404 } from "../src/conditions";
import { formatDate, setting } from "../src/utils";
import type { ResolveKind } from "../src/types";

// Hàm tương đương WP (SDK 1.44): conditional tags, get_adjacent_post, getPost chỉ trả null khi 404.

let respond: (url: URL) => Response = () => new Response("{}");
const calls: URL[] = [];
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  calls.push(url);
  return respond(url);
}) as typeof fetch;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("getPost / getPostById: 404 → null, lỗi máy chủ → ném CmsApiError (không hiện 404 sai khi CMS lỗi)", async () => {
  respond = () => json({ title: "not found" }, 404);
  assert.equal(await getPost("page", "khong-co", "vi"), null);
  assert.equal(await getPostById(999), null);
  respond = () => json({ title: "boom" }, 500);
  await assert.rejects(getPost("page", "loi", "vi"), (e: unknown) => e instanceof CmsApiError && e.status === 500);
  await assert.rejects(getPostById(1000), (e: unknown) => e instanceof CmsApiError && e.status === 500);
});

test("getAdjacentPost: prev = đăng trước, mới nhất trước; next = đăng sau; loại chính bài đó; giữ bộ lọc thêm", async () => {
  respond = () => json({ items: [{ id: 7, title: "Bài 7" }], total: 1, page: 1, totalPages: 1 });
  const post = { id: 5, type: "post", publishedAt: "2026-11-10T08:00:00Z" };
  const prev = await getAdjacentPost(post, "prev", { locale: "vi", taxQuery: [{ taxonomy: "category", terms: ["tin"] }] });
  let u = calls[calls.length - 1]!;
  assert.equal(prev?.id, 7);
  assert.equal(u.searchParams.get("before"), post.publishedAt);
  assert.equal(u.searchParams.get("after"), null);
  assert.equal(u.searchParams.get("order"), "desc");
  assert.equal(u.searchParams.get("perPage"), "1");
  assert.equal(u.searchParams.get("noTotal"), "true");
  assert.equal(u.searchParams.get("exclude"), "5");
  assert.equal(u.searchParams.get("type"), "post");
  assert.equal(u.searchParams.get("taxQuery"), '[{"taxonomy":"category","terms":["tin"]}]');
  await getAdjacentPost(post, "next", { locale: "vi" });
  u = calls[calls.length - 1]!;
  assert.equal(u.searchParams.get("after"), post.publishedAt);
  assert.equal(u.searchParams.get("order"), "asc");
  respond = () => json({ items: [], total: 0, page: 1, totalPages: 1 });
  assert.equal(await getAdjacentPost(post, "next", { locale: "vi" }), null);
  const before = calls.length;
  assert.equal(await getAdjacentPost({ ...post, publishedAt: null }, "prev"), null, "bài chưa đăng: không gọi API");
  assert.equal(calls.length, before);
});

test("conditional tags theo data.kind, khớp cách core trả kind / templates", () => {
  const d = (kind: ResolveKind, extra: object = {}) => ({ kind, ...extra });
  // Trang chủ dạng bài mới: core trả kind "home", templates bắt đầu bằng "front-page"
  const postsFront = d("home", { templates: ["front-page", "home", "index"] });
  assert.ok(isFrontPage(postsFront) && isHome(postsFront) && !isPage(postsFront) && !isSingular(postsFront));
  // Trang "Bài viết" được chọn ở Cài đặt › Đọc
  const postsPage = d("home", { templates: ["home", "index"] });
  assert.ok(isHome(postsPage) && !isFrontPage(postsPage));
  // Trang chủ là trang tĩnh
  const staticFront = d("front-page", { post: { slug: "trang-chu", type: "page" } });
  assert.ok(isFrontPage(staticFront) && isPage(staticFront) && isPage(staticFront, "trang-chu") && isSingular(staticFront) && !isHome(staticFront));
  const single = d("single", { post: { slug: "a", type: "product" } });
  assert.ok(isSingle(single) && isSingle(single, "product") && !isSingle(single, "post") && isSingular(single) && !isPage(single));
  assert.ok(isPage(d("page", { post: { slug: "lien-he" } }), "lien-he") && !isPage(d("page", { post: { slug: "x" } }), "lien-he"));
  const cat = d("category", { term: { slug: "tin", taxonomy: "category" } });
  assert.ok(isCategory(cat) && isCategory(cat, "tin") && !isCategory(cat, "khac") && isArchive(cat) && !isTag(cat));
  assert.ok(isTag(d("tag", { term: { slug: "ai" } }), "ai"));
  assert.ok(isTax(d("taxonomy", { term: { taxonomy: "khoa" } }), "khoa") && !isTax(d("taxonomy", { term: { taxonomy: "khoa" } }), "nganh"));
  for (const k of ["category", "tag", "taxonomy", "author", "date", "archive"] as ResolveKind[]) assert.ok(isArchive(d(k)), k);
  for (const k of ["front-page", "home", "single", "page", "search", "404", "route"] as ResolveKind[]) assert.ok(!isArchive(d(k)), k);
  assert.ok(isAuthor(d("author")) && isDate(d("date")) && isSearch(d("search")) && is404(d("404")));
});

test("formatDate theo cấu hình admin (định dạng + múi giờ); setting có dự phòng", () => {
  const site = { dateFormat: "dd/MM/yyyy", timezone: "Asia/Ho_Chi_Minh", locale: "vi" };
  // 23:30 UTC ngày 15 = 06:30 ngày 16 ở Việt Nam
  assert.equal(formatDate("2026-11-15T23:30:00Z", site), "16/11/2026");
  assert.equal(formatDate("2026-11-15T23:30:00Z", { ...site, dateFormat: "yyyy-MM-dd", timezone: "UTC" }), "2026-11-15");
  assert.equal(formatDate(null, site), "");
  assert.equal(setting({ a: "" }, "a", "x"), "x");
  assert.equal(setting({ a: false }, "a", true), false);
});
