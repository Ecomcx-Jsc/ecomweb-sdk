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

test("theme.json › blocks: tên phải bắt đầu bằng slug của theme, không trùng, content hợp lệ", async () => {
  const { validate } = await import("../lib/validate.mjs");
  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const make = (blocks: unknown) => {
    const dir = mkdtempSync(join(tmpdir(), "tb-"));
    mkdirSync(join(dir, "templates"));
    writeFileSync(join(dir, "templates", "index.tsx"), "export default () => null;");
    writeFileSync(join(dir, "theme.json"), JSON.stringify({ name: "T", slug: "demo", version: "1.0.0", requires: { cms: ">=1.0.0" }, editing: "blocks", blocks }));
    return validate(dir).errors as string[];
  };
  assert.ok(!make([{ name: "demo/mega-menu", title: "Mega", content: "none" }]).some((e) => e.startsWith("blocks")));
  assert.ok(make([{ name: "other/mega", title: "x" }]).some((e) => e.includes('phải có dạng "demo/ten-khoi"')));
  assert.ok(make([{ name: "demo/a" }, { name: "demo/a" }]).some((e) => e.includes("trùng tên")));
  assert.ok(make([{ name: "demo/a", content: "html" }]).some((e) => e.includes("không hợp lệ")));
  assert.ok(make("x").some((e) => e.includes("phải là mảng")));
});

test("settings[].preset chỉ cho ô color, tên màu hợp lệ", async () => {
  const { validate } = await import("../lib/validate.mjs");
  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const make = (settings: unknown) => {
    const dir = mkdtempSync(join(tmpdir(), "ps-"));
    mkdirSync(join(dir, "templates"));
    writeFileSync(join(dir, "templates", "index.tsx"), "export default () => null;");
    writeFileSync(join(dir, "theme.json"), JSON.stringify({ name: "T", slug: "demo", version: "1.0.0", requires: { cms: ">=1.0.0" }, settings }));
    return validate(dir).errors as string[];
  };
  assert.ok(!make([{ key: "brand", type: "color", label: "Màu", preset: "primary" }]).some((e) => e.includes("preset")));
  assert.ok(make([{ key: "brand", type: "text", label: "Màu", preset: "primary" }]).some((e) => e.includes("preset")));
  assert.ok(make([{ key: "brand", type: "color", label: "Màu", preset: "Primary Colour" }]).some((e) => e.includes("preset")));
});

test("quyền \"ai\" trong plugin.json hợp lệ; quyền lạ vẫn bị báo", async () => {
  const { validate } = await import("../lib/validate.mjs");
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const check = (permissions: string[]) => {
    const dir = mkdtempSync(join(tmpdir(), "perm-"));
    writeFileSync(join(dir, "plugin.json"), JSON.stringify({ name: "Demo", slug: "demo", version: "1.0.0", permissions }));
    return validate(dir).errors.filter((e: string) => e.startsWith("Quyền không hợp lệ"));
  };
  assert.deepEqual(check(["ai", "network"]), []);
  assert.equal(check(["ai", "hack"]).length, 1);
});

test('plugin.json › "ai": thiếu → nhắc (Store bắt buộc), sai kiểu → lỗi, đủ → không nhắc', async () => {
  const { validate } = await import("../lib/validate.mjs");
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const run = (ai: unknown) => {
    const dir = mkdtempSync(join(tmpdir(), "ai-"));
    writeFileSync(join(dir, "plugin.json"), JSON.stringify({ name: "P", slug: "p-ai", version: "1.0.0", requires: { cms: ">=1.7.0 <2.0.0" }, settings: { g: { title: "G", fields: [{ key: "a", type: "text", label: "A" }] } }, ...(ai === undefined ? {} : { ai }) }));
    return validate(dir);
  };
  assert.ok(run(undefined).warnings.some((w: string) => w.includes('Thiếu mục "ai"')));
  assert.ok(run(5).errors.some((e: string) => e.includes('"ai" phải là object')));
  assert.ok(run({ summary: "x", keywords: "shop" }).errors.some((e: string) => e.includes("ai.keywords")));
  const ok = run({ summary: "Cửa hàng: sản phẩm, giỏ hàng, thanh toán", useWhen: ["web bán hàng"], provides: "block productGrid" });
  assert.ok(!ok.warnings.some((w: string) => w.includes("ai")), ok.warnings.join("\n"));
});
