import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
// @ts-expect-error — mã nguồn CLI là .mjs không có .d.ts
import { extraDeps } from "../lib/site.mjs";

test("extraDeps: bỏ gói có sẵn của website (react, next, SDK) và gói đã cài; giữ gói theme thêm", () => {
  const theme = fs.mkdtempSync(path.join(os.tmpdir(), "th-")), fe = fs.mkdtempSync(path.join(os.tmpdir(), "fe-"));
  fs.writeFileSync(path.join(theme, "package.json"), JSON.stringify({ dependencies: {
    react: "19.0.0", next: "16.0.0", "@ecomcx/ecomweb-theme-sdk": "2.2.0", "@cms/x": "1.0.0", swiper: "11.2.6", clsx: "2.1.1" } }));
  fs.mkdirSync(path.join(fe, "node_modules", "clsx"), { recursive: true });
  fs.writeFileSync(path.join(fe, "node_modules", "clsx", "package.json"), "{}");
  assert.deepEqual(extraDeps(theme, fe), { swiper: "11.2.6" });
  assert.deepEqual(extraDeps(fs.mkdtempSync(path.join(os.tmpdir(), "th-")), fe), {}, "không có package.json");
});
