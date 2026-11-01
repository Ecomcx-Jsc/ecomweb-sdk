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

test("SEO: template khối không có H1, hoặc nhiều H1 (header có tên website là H1) → cảnh báo; khung mới tạo đạt chuẩn", async () => {
  const { seoStructure } = await import("../lib/validate.mjs");
  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "seo-"));
  mkdirSync(join(dir, "templates")); mkdirSync(join(dir, "parts"));
  const doc = (...content: unknown[]) => JSON.stringify({ version: 1, blocks: [{ type: "richtext", data: { type: "doc", content } }] });
  writeFileSync(join(dir, "parts", "header.json"), doc({ type: "siteTitle", attrs: { level: 1 } }));
  writeFileSync(join(dir, "templates", "single.json"), doc({ type: "templatePart", attrs: { slug: "header" } }, { type: "postTitle" }));
  writeFileSync(join(dir, "templates", "index.json"), doc({ type: "query", content: [{ type: "postTemplate", content: [{ type: "postTitle", attrs: { level: 1 } }] }] }));
  writeFileSync(join(dir, "templates", "page.json"), doc({ type: "postTitle" }, { type: "postContent" }));
  const w = seoStructure(dir);
  assert.ok(w.some((x: string) => x.includes("single.json có 2 thẻ H1")));
  assert.ok(w.some((x: string) => x.includes("index.json không có thẻ H1")), "tiêu đề trong vòng lặp bài không tính là H1 của trang");
  assert.ok(!w.some((x: string) => x.includes("page.json")));
});
