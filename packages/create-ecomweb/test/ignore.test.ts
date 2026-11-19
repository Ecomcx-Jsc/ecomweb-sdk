import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
// @ts-expect-error — mã nguồn CLI là .mjs không có .d.ts
import { ignoreMatcher } from "../lib/pack.mjs";

test(".ecomwebignore: tên, thư mục, mẫu *, đường dẫn từ gốc, bỏ qua dòng chú thích và mẫu chưa hỗ trợ", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ign-"));
  fs.writeFileSync(path.join(dir, ".ecomwebignore"), "# nháp\n.vscode/\n*.psd\ndesign/*.png\nnotes.md\n!keep.psd\n**/x\n");
  const m = ignoreMatcher(dir);
  assert.ok(m(".vscode", true));
  assert.ok(m(".vscode/settings.json", false));      // file trong thư mục bị bỏ (copyFiltered không đi vào thư mục đã bỏ)
  assert.ok(m("a/b/logo.psd", false));
  assert.ok(m("design/hero.png", false));
  assert.ok(!m("other/hero.png", false));
  assert.ok(m("notes.md", false) && m("sub/notes.md", false));
  assert.ok(!m("keep.txt", false) && !m("styles.css", false));
  assert.ok(!m("x", false), "mẫu ** bị bỏ qua");
  assert.equal(ignoreMatcher(fs.mkdtempSync(path.join(os.tmpdir(), "ign-")))("anything", false), false);
});
