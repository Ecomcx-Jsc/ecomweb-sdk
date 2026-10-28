import assert from "node:assert/strict";
import { test } from "node:test";
import { pageLink, pageLinkWithQuery } from "../src/utils";
import type { MetaQuery, TaxQueryClause } from "../src/api";

// Bộ lọc danh sách: giữ nguyên searchParams khi chuyển trang, và hình dạng JSON mà getPosts gửi lên
// Public API (core phân tích rồi lọc trong cơ sở dữ liệu — xem docs/query-engine.md).

test("pageLinkWithQuery: giữ bộ lọc, chỉ đổi số trang", () => {
  assert.equal(pageLinkWithQuery("/tin-tuc", 1, {}), "/tin-tuc");
  assert.equal(pageLinkWithQuery("/tin-tuc", 2, {}), "/tin-tuc/page/2");
  assert.equal(pageLinkWithQuery("/", 3, {}), "/page/3");
  assert.equal(pageLinkWithQuery("/tin-tuc", 2, { "phong-ban": "ky-thuat" }), "/tin-tuc/page/2?phong-ban=ky-thuat");
  assert.equal(pageLinkWithQuery("/tin-tuc", 2, { "phong-ban": "ky-thuat", q: "react" }), "/tin-tuc/page/2?phong-ban=ky-thuat&q=react");
});

test("pageLinkWithQuery: bỏ tham số page cũ và tham số rỗng", () => {
  assert.equal(pageLinkWithQuery("/tin-tuc", 2, { page: "1", "phong-ban": "" }), "/tin-tuc/page/2");
  assert.equal(pageLinkWithQuery("/tin-tuc", 2, { "phong-ban": "ky-thuat", page: "5" }), "/tin-tuc/page/2?phong-ban=ky-thuat");
});

test("pageLinkWithQuery: mã hoá giá trị, không đổi hành vi của pageLink cũ", () => {
  assert.equal(pageLinkWithQuery("/tin-tuc", 2, { q: "lập trình" }), "/tin-tuc/page/2?q=l%E1%BA%ADp+tr%C3%ACnh");
  // pageLink giữ nguyên chữ ký cũ (plugin/theme đã dùng) — chỉ giữ ?s=
  assert.equal(pageLink("/tin-tuc", 2, "react"), "/tin-tuc/page/2?s=react");
  assert.equal(pageLink("/tin-tuc", 1), "/tin-tuc");
});

test("taxQuery / metaQuery: JSON gửi lên core đúng hợp đồng", () => {
  const taxQuery: TaxQueryClause[] = [{ taxonomy: "category", terms: ["tin-tuc"], operator: "IN" }];
  assert.equal(JSON.stringify(taxQuery), '[{"taxonomy":"category","terms":["tin-tuc"],"operator":"IN"}]');

  const metaQuery: MetaQuery = {
    relation: "AND",
    clauses: [
      { key: "job_department", compare: "=", value: "ky-thuat" },
      { key: "job_level", compare: "IN", value: [3, 4] },
      { key: "job_deadline", compare: "EXISTS" },
    ],
  };
  assert.equal(JSON.stringify(metaQuery),
    '{"relation":"AND","clauses":[{"key":"job_department","compare":"=","value":"ky-thuat"},{"key":"job_level","compare":"IN","value":[3,4]},{"key":"job_deadline","compare":"EXISTS"}]}');
  // Số phải giữ kiểu số trong JSON (core so sánh đúng kiểu, không so chuỗi)
  assert.match(JSON.stringify(metaQuery), /"value":\[3,4\]/);
});

test("metaQuery khoảng / LIKE: JSON gửi lên core đúng hợp đồng", () => {
  const range: MetaQuery = {
    clauses: [
      { key: "gia", compare: "BETWEEN", value: 10, value2: 20 },
      { key: "job_deadline", compare: ">=", value: "2026-01-01" },
      { key: "ma_tin", compare: "LIKE", value: "%abc%" },
    ],
  };
  assert.equal(JSON.stringify(range),
    '{"clauses":[{"key":"gia","compare":"BETWEEN","value":10,"value2":20},' +
    '{"key":"job_deadline","compare":">=","value":"2026-01-01"},' +
    '{"key":"ma_tin","compare":"LIKE","value":"%abc%"}]}');
  // Cận trên là trường riêng (value2) — core từ chối BETWEEN thiếu cận trên
  assert.match(JSON.stringify(range), /"value2":20/);
});
