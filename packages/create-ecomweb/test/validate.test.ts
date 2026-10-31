import assert from "node:assert/strict";
import { test } from "node:test";
// @ts-expect-error — mã nguồn CLI là .mjs không có .d.ts
import { narrowCmsUpperBound } from "../lib/validate.mjs";

// requires.cms: core chỉ chặn cài khi core quá cũ / khác major; giới hạn trên hẹp trong cùng major làm core cũ (< 1.20) từ chối cài
// gói vẫn tương thích → CLI nhắc tác giả để mở tới major kế tiếp.
test("cảnh báo giới hạn trên hẹp hơn hết major", () => {
  for (const r of [">=1.6.0 <1.9.1", ">=1.6.0 <=1.9.0", "~1.6.0"]) assert.match(narrowCmsUpperBound(r), />=1\.6\.0 <2\.0\.0/, r);
});

test("không cảnh báo khoảng mở tới major kế tiếp", () => {
  for (const r of [">=1.6.0 <2.0.0", "^1.6.0", ">=1.8.0", "*"]) assert.equal(narrowCmsUpperBound(r), null, r);
});
