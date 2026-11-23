import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { createRequire } from "node:module";
// @ts-expect-error — mã nguồn CLI là .mjs không có .d.ts
import { requireTypecheck, typecheck } from "../lib/typecheck.mjs";

const make = (ts: boolean, code: string) => {
  const dir = mkdtempSync(join(tmpdir(), "tc-"));
  writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true, noEmit: true, target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext" }, include: ["lib/**/*.ts"] }));
  mkdirSync(join(dir, "lib")); writeFileSync(join(dir, "lib", "a.ts"), code);
  if (ts) { // typescript của CLI (devDependency) giả làm bản cài trong thư mục tác giả
    const tsDir = dirname(createRequire(import.meta.url).resolve("typescript/package.json"));
    mkdirSync(join(dir, "node_modules")); symlinkSync(tsDir, join(dir, "node_modules", "typescript"));
  }
  return dir;
};

test("không có tsconfig / mã TS → bỏ qua", () => {
  assert.equal(typecheck(mkdtempSync(join(tmpdir(), "tc-"))).status, "none");
});

test("chưa cài typescript → missing, và push/deploy dừng (trừ --skip-check)", () => {
  const dir = make(false, "export const a: number = 1;");
  assert.equal(typecheck(dir).status, "missing");
  assert.throws(() => requireTypecheck(dir, { log: () => {} }), /npm install/);
  assert.doesNotThrow(() => requireTypecheck(dir, { skip: true, log: () => {} }));
});

test("mã đúng kiểu → ok; sai kiểu → failed, có dòng lỗi, push/deploy dừng", () => {
  assert.equal(typecheck(make(true, "export const a: number = 1;")).status, "ok");
  const bad = make(true, 'export const a: number = "x";');
  const r = typecheck(bad);
  assert.equal(r.status, "failed");
  assert.match(r.output, /a\.ts\(1,14\).*TS2322/);
  assert.throws(() => requireTypecheck(bad, { log: () => {} }), /Lỗi TypeScript/);
  assert.doesNotThrow(() => requireTypecheck(bad, { skip: true, log: () => {} }));
});
