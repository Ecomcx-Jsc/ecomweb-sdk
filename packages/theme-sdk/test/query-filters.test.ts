import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPostQuery } from "../src/query-filters";

const post = (o: object = {}) => ({ id: 7, type: "post", author: { id: 3 }, terms: { category: [{ slug: "tin" }, { slug: "huong-dan" }], product_cat: [{ slug: "giay" }] }, ...o }) as never;

test("mặc định: loại bài, số bài, sắp xếp; bài đang xem bị loại", () => {
  const q = buildPostQuery({ postType: "post", perPage: 4 }, { post: post() });
  assert.deepEqual([q.type, q.perPage, q.orderBy, q.order, q.exclude], ["post", 4, "date", "desc", [7]]);
  assert.equal(buildPostQuery({ excludeCurrent: false }, { post: post() }).exclude, undefined);
});
test("chọn tay: include theo thứ tự đã nhập; trống thì không trả bài nào", () => {
  const q = buildPostQuery({ source: "manual", include: "5, 9,x,3" }, {});
  assert.deepEqual([q.include, q.orderBy], [[5, 9, 3], "include"]);
  assert.deepEqual(buildPostQuery({ source: "manual", include: "" }, {}).include, [0]);
});
test("liên quan: cùng mục với bài đang xem, loại chính nó", () => {
  const q = buildPostQuery({ source: "related", postType: "post" }, { post: post() });
  assert.deepEqual(q.taxQuery, [{ taxonomy: "category", terms: ["tin", "huong-dan"] }]);
  assert.deepEqual(q.exclude, [7]);
  const p = buildPostQuery({ source: "related", postType: "product", taxonomy: "product_cat" }, { post: post({ type: "product" }) });
  assert.deepEqual(p.taxQuery, [{ taxonomy: "product_cat", terms: ["giay"] }]);
});
test("nhiều mục: bất kỳ = một mệnh đề IN, tất cả = mỗi mục một mệnh đề, loại trừ = NOT IN", () => {
  const any = buildPostQuery({ taxonomy: "product_cat", terms: "a,b", termMode: "any" }, {});
  assert.deepEqual(any.taxQuery, [{ taxonomy: "product_cat", terms: ["a", "b"], operator: "IN" }]);
  assert.equal(buildPostQuery({ taxonomy: "product_cat", terms: "a,b", termMode: "all" }, {}).taxQuery?.length, 2);
  assert.equal(buildPostQuery({ taxonomy: "product_cat", terms: "a", termMode: "none" }, {}).taxQuery?.[0].operator, "NOT IN");
  assert.equal(buildPostQuery({ taxonomy: "bad slug!", terms: "a" }, {}).taxQuery, undefined);
});
test("trường tuỳ biến: số giữ kiểu số, EXISTS không cần giá trị", () => {
  assert.deepEqual(buildPostQuery({ metaKey: "gia", metaCompare: ">=", metaValue: "100" }, {}).metaQuery?.clauses, [{ key: "gia", compare: ">=", value: 100 }]);
  assert.deepEqual(buildPostQuery({ metaKey: "mau", metaCompare: "EXISTS" }, {}).metaQuery?.clauses, [{ key: "mau", compare: "EXISTS" }]);
});
test("khoảng ngày, bài con, bỏ N bài đầu, cùng tác giả", () => {
  const now = new Date("2026-11-17T00:00:00Z");
  const q = buildPostQuery({ dateRange: "30", parent: 12, offset: 2, authorCurrent: true }, { now, post: post() });
  assert.equal((q.after as Date).toISOString(), "2026-10-18T00:00:00.000Z");
  assert.deepEqual([q.parentId, q.offset, q.authorId], [12, 2, 3]);
});
test("bộ lọc trên URL chỉ có tác dụng khi bật; sắp xếp lạ bị bỏ", () => {
  const data = { query: { fq_s: " áo ", fq_sort: "title_asc", fq_product_cat: "giay" }, postType: "product", term: null } as never;
  const on = buildPostQuery({ urlFilters: true, taxonomy: "product_cat" }, { data, fromContext: true });
  assert.deepEqual([on.search, on.orderBy, on.order, on.type], ["áo", "title", "asc", "product"]);
  assert.deepEqual(on.taxQuery, [{ taxonomy: "product_cat", terms: ["giay"] }]);
  const off = buildPostQuery({ taxonomy: "product_cat" }, { data });
  assert.equal(off.search, undefined);
  assert.equal(buildPostQuery({ urlFilters: true }, { data: { query: { fq_sort: "hack" } } as never }).orderBy, "date");
});
test("trang mục: lấy phân loại của trang rồi lọc thêm", () => {
  const data = { postType: "product", term: { taxonomy: "product_cat", slug: "cong-nghe" }, query: {} } as never;
  assert.deepEqual(buildPostQuery({ urlFilters: true }, { data, fromContext: true }).taxQuery, [{ taxonomy: "product_cat", terms: ["cong-nghe"] }]);
});
test("?fq_… còn lại chuyển cho plugin (extra), khoá lạ bị bỏ", () => {
  const data = { query: { fq_price_min: "100000", fq_sale: "1", fq_s: "áo", other: "x" } } as never;
  assert.deepEqual(buildPostQuery({ urlFilters: true }, { data }).extra, { fq_price_min: "100000", fq_sale: "1" });
  assert.equal(buildPostQuery({}, { data }).extra, undefined);
});
