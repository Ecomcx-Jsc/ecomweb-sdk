#!/usr/bin/env node
// Tự kiểm các script: dựng một trang mẫu, chụp 2 lần, so phải ĐẠT; css-port phải đổi body.x và tải url() về theme.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "theme-port-"));
const site = path.join(dir, "site");
fs.mkdirSync(site);
fs.writeFileSync(path.join(site, "dot.svg"), '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><circle cx="4" cy="4" r="4"/></svg>');
fs.writeFileSync(path.join(site, "a.css"), "body.home .hero{background:url(dot.svg) repeat;height:300px}\nbody{margin:0}\n");
fs.writeFileSync(path.join(site, "index.html"), '<!doctype html><html><head><link rel="stylesheet" href="a.css"></head><body class="home"><header>Hi</header><div class="hero"></div></body></html>');
const port = 18000 + Math.floor(Math.random() * 1000);
const here = path.dirname(new URL(import.meta.url).pathname);
const srv = spawn(process.execPath, [path.join(here, "serve.mjs"), site, "--port", String(port)], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 500));
const run = (f, ...a) => execFileSync(process.execPath, [path.join(here, f), ...a], { encoding: "utf8" });
try {
  const url = `http://127.0.0.1:${port}/`;
  run("snapshot.mjs", url, path.join(dir, "a"), "--widths", "800", "--wait", "100");
  run("snapshot.mjs", url, path.join(dir, "b"), "--widths", "800", "--wait", "100");
  const meta = JSON.parse(fs.readFileSync(path.join(dir, "a", "meta.json"), "utf8"));
  assert.equal(meta.body.class, "home");
  run("compare.mjs", path.join(dir, "a"), path.join(dir, "b")); // ném lỗi nếu mã thoát khác 0
  run("css-port.mjs", path.join(dir, "a"), path.join(dir, "theme"));
  const css = fs.readFileSync(path.join(dir, "theme", "assets", "css", "source.css"), "utf8");
  assert.match(css, /\.body-wrapper\.home \.hero/);
  assert.match(css, /url\("\.\.\/files\/[0-9a-f]{6}-dot\.svg"\)/);
  assert.match(css, /body\{margin:0\}/);
  assert.equal(fs.readdirSync(path.join(dir, "theme", "assets", "files")).length, 1);
  console.log("selftest: ĐẠT");
} finally {
  srv.kill();
  fs.rmSync(dir, { recursive: true, force: true });
}
