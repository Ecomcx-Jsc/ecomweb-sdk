#!/usr/bin/env node
// Kiểm tĩnh một theme Ecomweb vừa chuyển: bắt các lỗi lặp lại nhiều nhất khi chuyển từ WP/HTML sang.
// Mỗi dòng LỖI phải sửa hết trước khi chạy compare.mjs; CẢNH BÁO thì đọc và quyết định.
//
//   node audit.mjs <thư-mục-theme> [--source-host demo.example.com]
//
// Mã thoát: 0 = không có LỖI, 1 = còn LỖI.
import fs from "node:fs";
import path from "node:path";
import { args, die } from "./lib.mjs";

const a = args();
const root = path.resolve(a._[0] ?? die("cách dùng: node audit.mjs <thư-mục-theme> [--source-host demo.example.com]"));
const host = typeof a["source-host"] === "string" ? a["source-host"] : "";
const errors = [], warns = [];
const err = (f, msg) => errors.push(`${f}: ${msg}`);
const warn = (f, msg) => warns.push(`${f}: ${msg}`);

function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (["node_modules", "dist", ".git", ".next"].includes(e.name)) continue;
    const p = path.join(d, e.name);
    e.isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}
const rel = (p) => path.relative(root, p);

// --- theme.json
const tj = path.join(root, "theme.json");
if (!fs.existsSync(tj)) die(`không thấy theme.json trong ${root}`);
let theme;
try { theme = JSON.parse(fs.readFileSync(tj, "utf8")); } catch (e) { die(`theme.json hỏng: ${e.message}`); }
for (const k of ["name", "slug", "version"]) if (!theme[k]) err("theme.json", `thiếu "${k}"`);
const colors = theme.styles?.colors ?? {}, fonts = theme.styles?.fonts ?? {};
for (const k of ["primary", "accent", "text", "background", "surface", "muted", "border"]) if (!colors[k]) warn("theme.json", `styles.colors thiếu "${k}" (token bắt buộc; bỏ qua nếu CSS đã khai --ecx-color-<tên>)`);
for (const k of ["body", "heading"]) if (!fonts[k]) warn("theme.json", `styles.fonts thiếu "${k}"`);
if (!theme.menuLocations) warn("theme.json", "chưa khai menuLocations (menu gốc phải lấy từ getMenu, không gõ cứng)");

// --- templates phẳng + index
const tdir = path.join(root, "templates");
if (!fs.existsSync(tdir)) err("templates/", "không có thư mục templates");
else {
  for (const e of fs.readdirSync(tdir, { withFileTypes: true })) if (e.isDirectory()) err(`templates/${e.name}/`, "templates/ phải phẳng: core chỉ đọc file ở cấp trên cùng; chuyển code vào components/");
  if (!theme.parent && !fs.existsSync(path.join(tdir, "index.tsx"))) err("templates/index.tsx", "bắt buộc có (template cuối cùng của thứ bậc)");
  for (const k of Object.keys(theme.pageTemplates ?? {})) if (!fs.existsSync(path.join(tdir, `${k}.tsx`))) err("theme.json", `pageTemplates "${k}" không có templates/${k}.tsx`);
  for (const p of theme.pages ?? []) if (p.template && !fs.existsSync(path.join(tdir, `${p.template}.tsx`))) err("theme.json", `pages "${p.slug}" trỏ template "${p.template}" không tồn tại`);
}
if (!fs.existsSync(path.join(root, "layout.tsx")) && !theme.parent) err("layout.tsx", "thiếu khung trang");

const files = walk(root);
const code = files.filter((f) => /\.(tsx?|jsx?)$/.test(f));
const css = files.filter((f) => f.endsWith(".css"));

// --- layout
const layout = path.join(root, "layout.tsx");
if (fs.existsSync(layout)) {
  const s = fs.readFileSync(layout, "utf8");
  if (!/EditableRegion[^>]*name=["']header["']/.test(s)) warn("layout.tsx", 'header chưa bọc <EditableRegion name="header">');
  if (!/EditableRegion[^>]*name=["']footer["']/.test(s)) warn("layout.tsx", 'footer chưa bọc <EditableRegion name="footer">');
  if (!/import\s+["'][^"']+\.css["']/.test(s)) warn("layout.tsx", "không import file CSS nào");
}

// --- mã nguồn
const SHOP_PATHS = /["'`]\/(cart|checkout|gio-hang|thanh-toan|my-account|shop|product|products)\/?["'`]/;
for (const f of code) {
  const s = fs.readFileSync(f, "utf8");
  const r = rel(f);
  const lines = s.split("\n");
  lines.forEach((ln, i) => {
    const at = `${r}:${i + 1}`;
    if (/\bfrom\s+["']jquery["']|\$\(document\)|jQuery\(/.test(ln)) err(at, "dùng jQuery: viết lại hành vi bằng React/DOM trong component \"use client\"");
    if (/document\.body\.classList\.(add|toggle)|document\.documentElement\.className\s*=/.test(ln)) warn(at, "gắn class lên body/html bằng JS. Class trạng thái (modal-open, menu-open) thì được; class trang/bố cục của bản gốc phải đặt trên khung bao ở layout.tsx (render từ server) để không nháy sai kiểu");
    if (/localStorage\.(get|set)Item\(\s*["']ecomcx_cart/.test(ln)) err(at, "đọc/ghi thẳng localStorage giỏ: dùng window.ecomcx.cart.*");
    if (SHOP_PATHS.test(ln) && /href|push|location/.test(ln)) warn(at, "đường dẫn cửa hàng gõ cứng: dùng post.link / term.link / window.ecomcx.paths / getPlugin().getUrls()");
    if (/["'`]\/products?\/["'`]\s*\+|`\/products?\/\$\{/.test(ln)) err(at, "tự ghép URL sản phẩm: dùng post.link");
    if (/dangerouslySetInnerHTML/.test(ln) && !/content|html|excerpt|svg/i.test(ln)) warn(at, "dangerouslySetInnerHTML: chỉ dùng cho nội dung từ CMS, không nhét HTML gốc vào");
    if (/wp-content\/|wp-includes\/|admin-ajax|["'`(]\/?[^"'`\s:]*\.php\b/.test(ln)) err(at, "còn đường dẫn WordPress (wp-content, .php, admin-ajax): asset phải nằm trong theme, dữ liệu lấy qua SDK");
    if (host && ln.includes(host)) err(at, `còn trỏ về site gốc ${host}`);
    if (/\bfile:\/\//.test(ln)) err(at, "đường dẫn file://");
    if (/<img\b[^>]*\bdata-(lazy-)?src=/.test(ln) && !/\bsrc=/.test(ln.replace(/data-(lazy-)?src=/g, ""))) err(at, "ảnh chỉ có data-src: lazyload của bản gốc không chạy trong theme, dùng src (+ loading=\"lazy\")");
    if (/(^|[\s(>])<[a-z][\w-]*\s[^>]*\bclass=["']/.test(ln) && !/HTML|["'`]</.test(ln)) warn(at, "JSX dùng class= thay vì className=");
    if (/>\s*(Add to cart|Read more|Shop now|Thêm vào giỏ|Xem thêm|Mua ngay)\s*</i.test(ln)) warn(at, "chữ giao diện gõ cứng: đưa vào locales/*.json và dùng getT()/useT()");
  });
}

// --- CSS: url() phải trỏ tới file có thật
for (const f of css) {
  const s = fs.readFileSync(f, "utf8");
  const r = rel(f);
  for (const m of s.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
    const u = m[1].trim();
    if (/^(data:|#|https?:|\/\/|var\()/.test(u)) { if (/^(https?:)?\/\//.test(u)) warn(r, `url() ngoài theme: ${u} (cần khai csp trong theme.json hoặc tải về assets/)`); continue; }
    const target = path.resolve(path.dirname(f), u.split(/[?#]/)[0]);
    if (!fs.existsSync(target)) err(r, `url() trỏ tới file không có: ${u}`);
  }
  if (host && s.includes(host)) err(r, `còn trỏ về site gốc ${host}`);
  if (/@tailwind|@apply/.test(s) && !/tailwind/i.test(fs.readFileSync(path.join(root, "package.json"), "utf8") || "")) warn(r, "có @tailwind/@apply nhưng theme không cài tailwind");
  const ext = [...s.matchAll(/@import\s+(?:url\()?["']?(https?:\/\/[^"')]+)/g)].map((m) => new URL(m[1]).origin);
  const allowed = [...(theme.csp?.["style-src"] ?? [])];
  for (const o of ext) if (!allowed.some((x) => o.startsWith(x.replace(/\/$/, "")))) err(r, `@import ${o} chưa khai trong theme.json › csp.style-src`);
}

// --- locales
const loc = path.join(root, "locales");
if (!fs.existsSync(loc)) warn("locales/", "không có thư mục dịch; chữ giao diện nên nằm ở locales/en.json + vi.json");

console.log(`audit ${root}`);
for (const e of errors) console.log(`LỖI     ${e}`);
for (const w of warns) console.log(`CẢNH BÁO ${w}`);
console.log(`\n${errors.length} lỗi, ${warns.length} cảnh báo`);
process.exit(errors.length ? 1 : 0);
