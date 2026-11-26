#!/usr/bin/env node
// Gộp CSS gốc (theo đúng thứ tự trên trang) vào theme, tải mọi file mà CSS tham chiếu (font, ảnh, icon) về theme.
// KHÔNG viết lại luật CSS: chỉ sửa đường dẫn url(), inline @import, bọc @media của thẻ <link media>,
// và đổi selector `body.<class>` / `html.<class>` sang class của khung bao (vì theme không gắn class lên <body>).
//
//   node css-port.mjs <thư-mục-snapshot> <thư-mục-theme> [--wrapper body-wrapper] [--name source] [--skip "admin-bar,dashicons"]
//
// Ghi ra: <theme>/assets/css/<name>.css, <theme>/assets/files/<hash6>-<tên>, <theme>/assets/css/<name>.report.json
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { args, die, mkdir, readJson, writeJson } from "./lib.mjs";

const a = args();
const [snap, theme] = a._;
if (!snap || !theme) die("cách dùng: node css-port.mjs <thư-mục-snapshot> <thư-mục-theme> [--wrapper body-wrapper] [--name source]");
const wrapper = typeof a.wrapper === "string" ? a.wrapper : "body-wrapper";
const name = typeof a.name === "string" ? a.name : "source";
// Stylesheet của WP admin bar / dashicons / customizer không thuộc giao diện site.
const skip = (typeof a.skip === "string" ? a.skip : "admin-bar,dashicons,customize-,query-monitor,wp-admin").split(",").filter(Boolean);
const order = readJson(path.join(snap, "css", "order.json"));
const cssDir = path.join(theme, "assets", "css");
const fileDir = path.join(theme, "assets", "files");
mkdir(cssDir); mkdir(fileDir);

const report = { files: [], skipped: [], missing: [], imports: [], bodySelectors: 0, external: [] };
const saved = new Map(); // URL tuyệt đối -> tên file đã lưu

async function fetchBuf(u) {
  try {
    const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0 ecomweb-theme-port" } });
    return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
  } catch { return null; }
}

/** Tải một file CSS tham chiếu về assets/files, trả đường dẫn tương đối từ assets/css. */
async function asset(raw, base) {
  if (/^(data:|#|about:|var\()/i.test(raw)) return null;
  let abs;
  try { abs = new URL(raw, base).href; } catch { return null; }
  const key = abs.split("#")[0];
  if (!saved.has(key)) {
    const buf = await fetchBuf(key);
    if (!buf) { report.missing.push(key); saved.set(key, null); }
    else {
      const base = path.basename(new URL(key).pathname) || "file";
      const file = `${crypto.createHash("sha1").update(key).digest("hex").slice(0, 6)}-${base.replace(/[^a-z0-9._-]+/gi, "_")}`;
      fs.writeFileSync(path.join(fileDir, file), buf);
      saved.set(key, file);
    }
  }
  const file = saved.get(key);
  const hash = abs.includes("#") ? abs.slice(abs.indexOf("#")) : "";
  return file ? `../files/${file}${hash}` : null;
}

async function port(text, base, depth = 0) {
  // @import: chèn nội dung thẳng vào chỗ đó (giữ thứ tự cascade).
  const imp = /@import\s+(?:url\()?\s*["']?([^"')\s;]+)["']?\s*\)?\s*([^;]*);/g;
  let out = "", last = 0, m;
  while ((m = imp.exec(text))) {
    out += text.slice(last, m.index);
    last = imp.lastIndex;
    const abs = new URL(m[1], base).href;
    const buf = depth < 4 ? await fetchBuf(abs) : null;
    report.imports.push(abs);
    if (!buf) { report.missing.push(abs); out += `/* @import thiếu: ${abs} */`; continue; }
    const inner = await port(buf.toString("utf8"), abs, depth + 1);
    out += m[2].trim() ? `@media ${m[2].trim()} {\n${inner}\n}` : inner;
  }
  text = out + text.slice(last);
  // url(...)
  const parts = [];
  last = 0;
  const re = /url\(\s*(["']?)([^"')]+)\1\s*\)/g;
  while ((m = re.exec(text))) {
    parts.push(text.slice(last, m.index));
    const local = await asset(m[2].trim(), base);
    parts.push(local ? `url("${local}")` : m[0]);
    last = re.lastIndex;
  }
  parts.push(text.slice(last));
  text = parts.join("");
  // body.x / html.x / body:not(...) -> .wrapper.x  (class của <body> gốc được đặt lên khung bao ở layout.tsx)
  text = text.replace(/(^|[\s,>+~(}])(?:html\s+)?body(?=[.:\[#][^{}]*\{)/g, (all, pre) => { report.bodySelectors++; return `${pre}.${wrapper}`; });
  return text;
}

let css = `/* Gộp tự động bởi css-port.mjs từ ${readJson(path.join(snap, "meta.json")).url}. Không viết lại luật CSS ở file này; phần bổ sung đặt ở styles.css. */\n`;
for (const s of order) {
  const id = s.href ?? s.file;
  if (skip.some((k) => id.includes(k))) { report.skipped.push(id); continue; }
  const raw = fs.readFileSync(path.join(snap, "css", s.file), "utf8");
  if (raw.startsWith("/* KHÔNG TẢI ĐƯỢC")) { report.missing.push(s.href); continue; }
  let body = await port(raw, s.base);
  if (s.media && s.media !== "all" && s.media !== "screen") body = `@media ${s.media} {\n${body}\n}`;
  css += `\n/* ==== ${id} ==== */\n${body}\n`;
  report.files.push(id);
}
for (const k of saved.keys()) { const h = new URL(k).host; if (!report.external.includes(h)) report.external.push(h); }
const outCss = path.join(cssDir, `${name}.css`);
fs.writeFileSync(outCss, css);
writeJson(path.join(cssDir, `${name}.report.json`), report);
console.log(`đã gộp ${report.files.length} stylesheet -> ${outCss} (${(css.length / 1024).toFixed(0)} KB)`);
console.log(`file tải về assets/files: ${[...saved.values()].filter(Boolean).length}; thiếu: ${report.missing.length}; bỏ qua: ${report.skipped.length}`);
console.log(`selector body/html đã đổi sang .${wrapper}: ${report.bodySelectors}`);
if (report.missing.length) console.log(`THIẾU (xem ${name}.report.json):\n  ${report.missing.slice(0, 15).join("\n  ")}`);
