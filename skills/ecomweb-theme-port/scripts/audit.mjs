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
    if (["node_modules", "dist", ".git", ".next", "port", "tools"].includes(e.name) && d === root) continue;
    if (["node_modules", ".git", ".next"].includes(e.name)) continue;
    const p = path.join(d, e.name);
    e.isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}
const rel = (p) => path.relative(root, p);

// --- file làm việc không được lọt vào gói theme
const ign = fs.existsSync(path.join(root, ".ecomwebignore")) ? fs.readFileSync(path.join(root, ".ecomwebignore"), "utf8") : "";
for (const d of ["port", "tools"]) if (fs.existsSync(path.join(root, d)) && !new RegExp(`^/?${d}/?\\s*$`, "m").test(ign)) err(".ecomwebignore", `thư mục ${d}/ (ảnh chụp, báo cáo, script) sẽ bị đóng gói vào theme: thêm dòng "${d}/" vào .ecomwebignore`);

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
  // Thứ tự cascade: CSS gốc (assets/css/…) trước, styles.css (phần bổ sung) sau cùng
  const imps = [...s.matchAll(/import\s+["']([^"']+\.css)["']/g)].map((m) => m[1]);
  const iStyles = imps.findIndex((x) => /(^|\/)styles\.css$/.test(x));
  const lastSrc = imps.map((x, i) => (/assets\/css\//.test(x) ? i : -1)).filter((i) => i >= 0).pop() ?? -1;
  if (iStyles >= 0 && lastSrc > iStyles) err("layout.tsx", `styles.css import TRƯỚC CSS gốc (${imps[lastSrc]}): CSS gốc sẽ đè phần bổ sung. Đặt styles.css sau cùng`);
  if (/dangerouslySetInnerHTML[^]*?classList|classList[^]*?dangerouslySetInnerHTML/.test(s) || /<script[^>]*>[^<]*classList/.test(s))
    err("layout.tsx", "gắn class trang bằng script inline: trang nháy sai kiểu. Class cố định → filters[\"body.class\"] trong extend.tsx; class theo trang → className của khung bao trong layout.tsx (render server), CSS gốc đã được css-port đổi body.x → .body-wrapper.x");
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

// --- Hành vi tự chế thay vì kit, chữ gõ cứng, dấu KIT chưa xử lý
const kitDir = fs.existsSync(path.join(root, "components", "kit")) ? "components/kit" : null;
for (const f of code) {
  const s = fs.readFileSync(f, "utf8");
  const r = rel(f);
  if (r.startsWith("components/kit/")) continue;
  if (/\{\/\* KIT:/.test(s)) err(r, "còn dấu {/* KIT: … */} của html2jsx: bọc khối đó bằng <OwlCarousel>/<SlickCarousel> của kit");
  const timers = /set(Interval|Timeout)\s*\(/.test(s), moves = /translate(3d|X)\(|scrollLeft|scrollTo\(|\.scrollBy\(/.test(s);
  if (timers && moves && !/from\s+["'][^"']*kit\/Carousel["']/.test(s)) warn(r, "tự viết carousel/slider (timer + translate). Dùng kit/Carousel (OwlCarousel/SlickCarousel) để giữ đúng cây thẻ + class + thời gian của bản gốc");
  if (/className=\{?["'`][^"'`]*\becx-(carousel|slider|slide|fade|active|track|item)\b/.test(s)) warn(r, "class tự chế ecx-carousel/ecx-slide…: CSS gốc không biết class này; dùng class gốc + kit");
  for (const m of s.matchAll(/const\s+([A-Z][A-Z0-9_]*)\s*(?::[^=]+)?=\s*\[\s*(["'`][^\]]{0,400})\]/g)) {
    // chỉ tính chuỗi giống chữ hiển thị (≥ 2 từ), bỏ hằng kỹ thuật (khoá, selector, tên tham số)
    const n = (m[2].match(/["'`][^"'`]{3,}["'`]/g) || []).filter((x) => /[\p{L}]{2,}\s+[\p{L}]{2,}/u.test(x) && !/[.#\[\]>=]/.test(x)).length;
    if (n >= 3) warn(`${r}`, `mảng chữ gõ cứng ${m[1]} (${n} mục): nội dung chủ shop phải sửa được → ACF repeater, mặc định = chữ gốc`);
  }
}
if (!kitDir && code.some((f) => /from\s+["'][^"']*\/kit\/[A-Z]/.test(fs.readFileSync(f, "utf8")))) warn("components/kit/", "dùng kit nhưng chưa chép kit vào components/kit/");

// --- CSS tự viết hiệu ứng (keyframes) ngoài CSS gốc
for (const f of css) {
  const r = rel(f);
  if (/assets\/css\/(source|page-|vendor)/.test(r)) continue;
  const s = fs.readFileSync(f, "utf8");
  const kf = [...s.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]);
  if (kf.length) warn(r, `tự viết @keyframes ${kf.slice(0, 5).join(", ")}: hiệu ứng phải là CSS gốc (đã có trong source.css). Chỉ viết khi motion.json của bản gốc có animation đó mà CSS gốc không có`);
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
