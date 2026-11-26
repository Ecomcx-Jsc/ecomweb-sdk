#!/usr/bin/env node
// Đổi một đoạn DOM đã render (dom-<w>.html của snapshot.mjs) thành component TSX, MÁY MÓC, không sáng tạo.
// Giữ nguyên thẻ, class, id, data-*, aria-*, style; bỏ script/noscript/link/meta/on*; tải ảnh về theme.
//
//   node html2jsx.mjs <dom.html> --select "<css selector>" --out <theme>/components/home/Hero.tsx
//        [--name Hero] [--all] [--base <URL trang gốc>] [--media <theme>/assets/media] [--keep-srcset] [--no-unwrap]
//
// Carousel Owl/Slick đã khởi tạo trong DOM được GỠ khung thư viện (owl-stage, owl-item, slide nhân bản, nút, chấm) và đánh dấu
// {/* KIT: … */} để bọc lại bằng kit/Carousel — kit sinh lại đúng khung đó kèm hành vi. --no-unwrap để giữ nguyên.
//
//   --select   phần tử ngoài cùng của khối (lấy cái đầu tiên; --all = mọi phần tử khớp, theo thứ tự trong trang)
//   --base     URL gốc của trang (để tải ảnh có đường dẫn tương đối). Mặc định: lấy từ meta.json cạnh dom.html
//   --media    nơi lưu ảnh (mặc định <thư mục theme>/assets/media, theme = thư mục cha gần nhất có theme.json)
//
// Ghi ra: <Name>.tsx (component) + <Name>.media.ts (import tĩnh của ảnh, Next trả URL có hash) + báo cáo ngắn.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { args, browser, die, mkdir } from "./lib.mjs";

const a = args();
const [domFile] = a._;
if (!domFile || typeof a.select !== "string" || typeof a.out !== "string") die('cách dùng: node html2jsx.mjs <dom.html> --select ".hero" --out components/home/Hero.tsx [--name Hero] [--all]');
const out = path.resolve(a.out);
const name = typeof a.name === "string" ? a.name : path.basename(out).replace(/\.tsx$/, "");
let themeDir = path.dirname(out);
while (themeDir !== path.dirname(themeDir) && !fs.existsSync(path.join(themeDir, "theme.json"))) themeDir = path.dirname(themeDir);
if (!fs.existsSync(path.join(themeDir, "theme.json"))) die(`--out phải nằm trong thư mục theme (có theme.json): ${out}`);
const mediaDir = path.resolve(typeof a.media === "string" ? a.media : path.join(themeDir, "assets", "media"));
let base = typeof a.base === "string" ? a.base : "";
const metaFile = path.join(path.dirname(path.resolve(domFile)), "meta.json");
if (!base && fs.existsSync(metaFile)) base = JSON.parse(fs.readFileSync(metaFile, "utf8")).url;

const b = await browser();
const ctx = await b.newContext({ javaScriptEnabled: false });
const page = await ctx.newPage();
await page.setContent(fs.readFileSync(domFile, "utf8"), { waitUntil: "domcontentloaded" });
const res = await page.evaluate(({ sel, all, base, keepSrcset, noUnwrap }) => {
  const SKIP = new Set(["script", "noscript", "link", "meta", "base", "title", "template"]);
  const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  const NO_WS = new Set(["table", "thead", "tbody", "tfoot", "tr", "colgroup", "select", "optgroup", "html", "head"]);
  const MAP = { class: "className", for: "htmlFor", tabindex: "tabIndex", readonly: "readOnly", maxlength: "maxLength", minlength: "minLength", colspan: "colSpan",
    rowspan: "rowSpan", autocomplete: "autoComplete", autofocus: "autoFocus", crossorigin: "crossOrigin", srcset: "srcSet", frameborder: "frameBorder",
    allowfullscreen: "allowFullScreen", enctype: "encType", novalidate: "noValidate", "accept-charset": "acceptCharset", "http-equiv": "httpEquiv",
    datetime: "dateTime", contenteditable: "contentEditable", spellcheck: "spellCheck", playsinline: "playsInline", autoplay: "autoPlay",
    referrerpolicy: "referrerPolicy", fetchpriority: "fetchPriority", itemprop: "itemProp", itemscope: "itemScope", itemtype: "itemType", itemid: "itemID",
    usemap: "useMap", formaction: "formAction", formmethod: "formMethod", formnovalidate: "formNoValidate", inputmode: "inputMode", enterkeyhint: "enterKeyHint",
    cellpadding: "cellPadding", cellspacing: "cellSpacing", marginwidth: "marginWidth", marginheight: "marginHeight", accesskey: "accessKey",
    "xlink:href": "xlinkHref", "xml:space": "xmlSpace", "xml:lang": "xmlLang", "xmlns:xlink": "xmlnsXlink", srclang: "srcLang", hreflang: "hrefLang",
    allowtransparency: "allowTransparency", controlslist: "controlsList", disablepictureinpicture: "disablePictureInPicture", nomodule: "noModule" };
  const BOOL = new Set(["allowfullscreen", "async", "autofocus", "autoplay", "checked", "controls", "default", "defer", "disabled", "formnovalidate", "hidden",
    "inert", "itemscope", "loop", "multiple", "muted", "nomodule", "novalidate", "open", "playsinline", "readonly", "required", "reversed", "selected"]);
  const NUM = new Set(["colspan", "rowspan", "tabindex", "maxlength", "minlength", "size", "cols", "rows", "span", "start"]);
  // Thuộc tính HTML hợp lệ của React (chữ thường) — những cái lạ đưa vào spread để TypeScript không báo lỗi.
  const KNOWN = new Set(["id", "title", "lang", "dir", "role", "href", "target", "rel", "src", "alt", "width", "height", "type", "name", "value", "placeholder",
    "action", "method", "loading", "decoding", "sizes", "media", "poster", "preload", "download", "label", "list", "max", "min", "step", "pattern", "accept",
    "form", "headers", "scope", "summary", "wrap", "draggable", "translate", "cite", "coords", "shape", "kind", "nonce", "integrity", "sandbox", "allow",
    "srcdoc", "content", "charset", "async", "defer", "high", "low", "optimum", "abbr", "dirname", "slot", "is", "popover", "hidden", "open", "checked",
    "disabled", "multiple", "muted", "loop", "controls", "required", "reversed", "selected", "default", "inert", "style", "class"]);
  const urls = new Map(); // URL tuyệt đối -> khoá
  const asset = (raw) => {
    if (!raw || /^(data:|#|blob:|javascript:)/i.test(raw.trim())) return null;
    let u; try { u = new URL(raw.trim(), base || document.baseURI).href; } catch { return null; }
    if (!/\.(png|jpe?g|gif|webp|avif|svg|ico|bmp|mp4|webm|ogg|mp3)(\?|#|$)/i.test(u)) return null;
    if (!urls.has(u)) urls.set(u, `m${urls.size}`);
    return urls.get(u);
  };
  const q = (s) => JSON.stringify(s);
  // Giá trị thuộc tính: chuỗi JSX không hiểu ký tự thoát, nên giá trị có " \\ hoặc xuống dòng phải là biểu thức {"…"}.
  const av = (s) => (/["\\\n\r]/.test(s) ? `{${q(s)}}` : `"${s}"`);
  const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const styleObj = (css) => {
    const parts = []; let depth = 0, cur = "";
    for (const ch of css) { if (ch === "(") depth++; if (ch === ")") depth--; if (ch === ";" && depth === 0) { parts.push(cur); cur = ""; } else cur += ch; }
    parts.push(cur);
    const props = [];
    let custom = false;
    for (const p of parts) {
      const i = p.indexOf(":"); if (i < 0) continue;
      const k = p.slice(0, i).trim(), v0 = p.slice(i + 1).trim(); if (!k || !v0) continue;
      let v = q(v0);
      const m = /url\(\s*["']?([^"')]+)["']?\s*\)/.exec(v0);
      if (m) { const key = asset(m[1]); if (key) v = "`" + v0.slice(0, m.index).replace(/[`$\\]/g, "\\$&") + "url(${M." + key + "})" + v0.slice(m.index + m[0].length).replace(/[`$\\]/g, "\\$&") + "`"; }
      if (k.startsWith("--")) { custom = true; props.push(`${q(k)}: ${v}`); }
      else props.push(`${camel(k.replace(/^-ms-/, "ms-").replace(/^-(webkit|moz|o)-/, (_, x) => x[0].toUpperCase() + x.slice(1) + "-"))}: ${v}`);
    }
    if (!props.length) return null;
    return `{{ ${props.join(", ")} }${custom ? " as CSSProperties" : ""}}`;
  };
  const isSvg = (el) => el.namespaceURI === "http://www.w3.org/2000/svg";
  const text = (t, parent) => {
    if (!/\S/.test(t)) return NO_WS.has(parent) ? "" : (/\n/.test(t) || t.length ? '{" "}' : "");
    const s = t.replace(/\s+/g, " ");
    return /[{}<>]/.test(s) || /^\s|\s$/.test(s) ? `{${q(s)}}` : s;
  };
  let unknownAttrs = 0;
  const conv = (el, depth) => {
    const pad = "  ".repeat(depth);
    if (el.nodeType === 3) { const t = text(el.textContent, el.parentElement?.tagName.toLowerCase()); return t ? pad + t : ""; }
    if (el.nodeType !== 1) return "";
    const tag = isSvg(el) ? el.tagName : el.tagName.toLowerCase();
    if (SKIP.has(tag.toLowerCase())) return "";
    const attrs = [], extra = [];
    const A = Object.fromEntries([...el.attributes].map((x) => [x.name, x.value]));
    // Ảnh lazyload: lấy nguồn thật
    if (tag === "img" || tag === "source" || tag === "iframe" || tag === "video") {
      const real = A["data-src"] || A["data-lazy-src"] || A["data-original"] || A["data-lazy"];
      if (real && (!A.src || /^data:|placeholder|blank\.gif|lazy/i.test(A.src))) A.src = real;
      const rs = A["data-srcset"] || A["data-lazy-srcset"];
      if (rs) A.srcset = rs;
      for (const k of ["data-src", "data-lazy-src", "data-original", "data-lazy", "data-srcset", "data-lazy-srcset"]) delete A[k];
      if (tag === "img") A.class = (A.class || "").split(/\s+/).filter((c) => !/^(lazyload|lazyloading|lazyloaded|lazy)$/.test(c)).join(" ");
    }
    if (!keepSrcset) { if (tag === "img" || tag === "source") { if (tag === "source" && A.srcset && !A.src) { A.srcset = A.srcset.split(",")[0].trim().split(/\s+/)[0]; } else { delete A.srcset; delete A.sizes; } } }
    for (const [k0, v] of Object.entries(A)) {
      const k = k0.toLowerCase();
      if (k.startsWith("on")) continue;
      if (k === "class" && !v.trim()) continue;
      if (k === "style") { const so = styleObj(v); if (so) attrs.push(`style=${so}`); continue; }
      if ((k === "src" || k === "poster" || (k === "href" && (tag === "image" || tag === "use") ) || k === "xlink:href") && asset(v)) { if (!(tag === "use" && v.startsWith("#"))) { attrs.push(`${MAP[k] ?? k}={M.${asset(v)}}`); continue; } }
      if (k === "srcset" && keepSrcset) { attrs.push(`srcSet=${av(v)}`); continue; }
      if (k === "srcset" && asset(v)) { attrs.push(`srcSet={M.${asset(v)}}`); continue; } // <source> chỉ còn 1 ảnh: tải về như src
      if ((tag === "input" || tag === "textarea" || tag === "select") && k === "value") { attrs.push(`defaultValue=${av(v)}`); continue; }
      if (tag === "input" && k === "checked") { attrs.push("defaultChecked"); continue; }
      if (tag === "option" && k === "selected") continue;
      if (k.startsWith("data-") || k.startsWith("aria-")) { attrs.push(`${k}=${av(v)}`); continue; }
      if (isSvg(el)) { const n = MAP[k] ?? (k.includes("-") ? camel(k) : k0); attrs.push(`${n}=${av(v)}`); continue; }
      if (BOOL.has(k)) { attrs.push(`${MAP[k] ?? k}`); continue; }
      if (NUM.has(k) && /^-?\d+$/.test(v)) { attrs.push(`${MAP[k] ?? k}={${v}}`); continue; }
      if (MAP[k] || KNOWN.has(k)) { attrs.push(`${MAP[k] ?? k}=${av(v)}`); continue; }
      extra.push(`${q(k0)}: ${q(v)}`); unknownAttrs++;
    }
    if (extra.length) attrs.push(`{...{ ${extra.join(", ")} }}`);
    if (tag === "style") return `${pad}<style dangerouslySetInnerHTML={{ __html: ${q(el.textContent)} }} />`;
    if (tag === "textarea") { if (el.textContent) attrs.push(`defaultValue={${q(el.textContent)}}`); return `${pad}<textarea${attrs.length ? " " + attrs.join(" ") : ""} />`; }
    const kit = A["data-kit"];
    if (kit) { const i = attrs.findIndex((x) => x.startsWith("data-kit=")); if (i >= 0) attrs.splice(i, 1); }
    const open = `<${tag}${attrs.length ? " " + attrs.join(" ") : ""}`;
    if (kit) {
      const kids = [...el.childNodes].map((c) => conv(c, depth + 1)).filter(Boolean);
      return `${pad}{/* KIT: thay thẻ ${tag} này bằng <${kit} as="${tag}" className=… + thông số lấy từ motion.json / data-* / JS gốc (xem reference/kit.md). Mỗi con trực tiếp = một slide. */}\n${pad}${open}>\n${kids.join("\n")}\n${pad}</${tag}>`;
    }
    const kids = [...el.childNodes].map((c) => conv(c, depth + 1)).filter(Boolean);
    if (VOID.has(tag) || !kids.length) return `${pad}${open} />`;
    return `${pad}${open}>\n${kids.join("\n")}\n${pad}</${tag}>`;
  };
  // Gỡ khung do thư viện carousel sinh ra sau khi khởi tạo (kit/Carousel sẽ sinh lại đúng như vậy), đánh dấu chỗ cần bọc kit.
  const kits = [];
  const LIB_CLS = /^(owl-carousel|owl-loaded|owl-drag|owl-dotted|owl-grab|owl-hidden|owl-rtl|owl-refresh|slick-initialized|slick-slider|slick-dotted|swiper-initialized|swiper-horizontal|swiper-backface-hidden)$/;
  if (!noUnwrap) {
    document.querySelectorAll(".owl-item.cloned, .slick-cloned, .swiper-slide-duplicate").forEach((n) => n.remove());
    document.querySelectorAll(".owl-loaded, .owl-carousel").forEach((root) => {
      const outer = root.querySelector(":scope > .owl-stage-outer");
      if (!outer) return;
      const items = [...outer.querySelectorAll(":scope > .owl-stage > .owl-item")].flatMap((it) => [...it.childNodes]);
      root.querySelectorAll(":scope > .owl-nav, :scope > .owl-dots").forEach((n) => n.remove());
      outer.replaceWith(...items);
      root.setAttribute("data-kit", "OwlCarousel");
      kits.push({ el: root, kit: "OwlCarousel", items: items.filter((x) => x.nodeType === 1).length });
    });
    document.querySelectorAll(".slick-initialized").forEach((root) => {
      const list = root.querySelector(":scope > .slick-list");
      if (!list) return;
      const slides = [...list.querySelectorAll(":scope > .slick-track > .slick-slide")].map((sl) => {
        const inner = sl.children.length === 1 && sl.firstElementChild.children.length === 1 && /inline-block/.test(sl.firstElementChild.getAttribute("style") || "") ? sl.firstElementChild.firstElementChild : sl;
        if (inner === sl) { sl.classList.remove("slick-slide", "slick-active", "slick-current", "slick-center"); ["data-slick-index", "aria-hidden", "tabindex", "style", "role", "aria-describedby", "id"].forEach((x) => sl.removeAttribute(x)); }
        return inner;
      });
      root.querySelectorAll(":scope > .slick-arrow, :scope > .slick-dots").forEach((n) => n.remove());
      list.replaceWith(...slides);
      root.setAttribute("data-kit", "SlickCarousel");
      kits.push({ el: root, kit: "SlickCarousel", items: slides.length });
    });
    document.querySelectorAll("[data-kit]").forEach((root) => { root.className = [...root.classList].filter((c) => !LIB_CLS.test(c)).join(" "); root.removeAttribute("style"); });
  }
  const nodes = all ? [...document.querySelectorAll(sel)] : [document.querySelector(sel)].filter(Boolean);
  // --all: bỏ phần tử nằm trong phần tử khác cũng khớp
  const top = nodes.filter((n) => !nodes.some((m) => m !== n && m.contains(n)));
  return { kits: kits.filter((k) => top.some((t) => t.contains(k.el))).map((k) => ({ kit: k.kit, items: k.items, cls: [...k.el.classList].slice(0, 2).join(".") })), count: top.length, jsx: top.map((n) => conv(n, 3)).join("\n"), urls: [...urls.entries()], unknownAttrs, classes: top.flatMap((n) => [...n.querySelectorAll("[class]"), n]).length };
}, { sel: a.select, all: !!a.all, base, keepSrcset: !!a["keep-srcset"], noUnwrap: !!a["no-unwrap"] });
await b.close();
if (!res.count) die(`không có phần tử khớp "${a.select}" trong ${domFile}`);

// Tải ảnh
mkdir(mediaDir);
const imports = [], failed = [];
for (const [u, key] of res.urls) {
  const base0 = (path.basename(new URL(u).pathname) || "file").replace(/[^a-z0-9._-]+/gi, "_");
  const file = `${crypto.createHash("sha1").update(u).digest("hex").slice(0, 6)}-${base0}`;
  const dest = path.join(mediaDir, file);
  if (!fs.existsSync(dest)) {
    const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0 ecomweb-theme-port" } }).catch(() => null);
    if (!r || !r.ok) { failed.push(u); imports.push({ key, url: u, file: null }); continue; }
    fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
  }
  imports.push({ key, url: u, file: dest });
}
mkdir(path.dirname(out));
const relMedia = (f) => { let r = path.relative(path.dirname(out), f).split(path.sep).join("/"); return r.startsWith(".") ? r : "./" + r; };
const mediaTs = `// @ts-nocheck — import tĩnh ảnh: Next trả { src } có hash. Theme không khai kiểu *.jpg (trùng khai báo của Next khi build).
// Sinh tự động bởi html2jsx.mjs. Ảnh không tải được giữ URL gốc (xem báo cáo) — phải thay trước khi phát hành.
${imports.filter((x) => x.file).map((x) => `import ${x.key} from ${JSON.stringify(relMedia(x.file))};`).join("\n")}

export const M: Record<string, string> = {
${imports.map((x) => `  ${x.key}: ${x.file ? `${x.key}.src ?? ${x.key}` : JSON.stringify(x.url)}, // ${x.url}`).join("\n")}
};
`;
const needsCss = res.jsx.includes("as CSSProperties");
const tsx = `// Sinh tự động bởi html2jsx.mjs từ ${path.basename(domFile)} (${a.select}${a.all ? ", --all" : ""}).
// Giữ NGUYÊN thẻ + class của bản gốc. Bước sau: thay chữ/ảnh demo bằng ACF/dữ liệu, thay hành vi bằng kit/.
${needsCss ? 'import type { CSSProperties } from "react";\n' : ""}${res.urls.length ? `import { M } from "./${name}.media";\n` : ""}
export default function ${name}() {
  return (
    <>
${res.jsx}
    </>
  );
}
`;
fs.writeFileSync(out, tsx);
if (res.urls.length) fs.writeFileSync(out.replace(/\.tsx$/, ".media.ts"), mediaTs);
console.log(`đã ghi ${out} (${res.count} khối, ${(tsx.length / 1024).toFixed(0)} KB)${res.urls.length ? ` + ${name}.media.ts (${imports.length - failed.length}/${imports.length} ảnh)` : ""}`);
for (const k of res.kits) console.log(`  gỡ khung ${k.kit === "OwlCarousel" ? "Owl" : "Slick"} ở .${k.cls} (${k.items} slide): bọc lại bằng <${k.kit}> của kit/Carousel tại chỗ đánh dấu KIT`);
if (res.unknownAttrs) console.log(`  ${res.unknownAttrs} thuộc tính lạ đưa vào {...{}} (giữ nguyên trong HTML)`);
if (failed.length) console.log(`  ẢNH KHÔNG TẢI ĐƯỢC (còn URL gốc):\n    ${failed.slice(0, 10).join("\n    ")}`);
