#!/usr/bin/env node
// Chụp một trang đã render (sau khi JS chạy) ở nhiều độ rộng và ghi mọi thứ cần để chuyển theme và để so sánh.
//
//   node snapshot.mjs <url> <thư-mục-ra> [--widths 1920,1440,390] [--select ".hero,.product-item"] [--wait 1500]
//
// Ghi ra <thư-mục-ra>:
//   shot-<w>.png      ảnh cả trang (đã tắt animation)
//   dom-<w>.html      DOM sau khi render (dùng làm mẫu markup, KHÔNG phải mã PHP)
//   css/NN-*.css      từng stylesheet theo đúng thứ tự trên trang + css/order.json
//   meta.json         class/thuộc tính của <html>/<body>, loại nguồn (Elementor, Woo, Next…), font đã nạp,
//                     request lỗi, lỗi console, script, link nội bộ, hộp + style của phần tử chính theo từng độ rộng
import fs from "node:fs";
import path from "node:path";
import { args, browser, die, FREEZE_CSS, mkdir, scrollThrough, widths, writeJson } from "./lib.mjs";

const a = args();
const [url, out] = a._;
if (!url || !out) die("cách dùng: node snapshot.mjs <url> <thư-mục-ra> [--widths 1920,1440,390] [--select \"sel1,sel2\"]");
if (url.startsWith("file:")) die("không mở bằng file:// (font, CORS, AJAX hỏng). Phục vụ thư mục bằng: node serve.mjs <thư-mục>");

// Phần tử chính luôn đo; thêm của riêng site bằng --select.
const SELECTORS = [
  "header", "nav", "main", "footer", "h1", "h2",
  ".site-header", "#header", ".header", ".elementor-location-header", ".breadcrumb", ".breadcrumbs",
  ".products .product", ".product", ".woocommerce-loop-product__title", ".price", ".button", "button",
  ".elementor-section", ".wp-block-cover", ".hero", "[class*=slider]", "[class*=banner]",
  ...(typeof a.select === "string" ? a.select.split(",").map((s) => s.trim()).filter(Boolean) : []),
];
const STYLE_KEYS = ["display", "position", "width", "height", "margin", "padding", "font-family", "font-size", "font-weight",
  "line-height", "letter-spacing", "text-transform", "color", "background-color", "background-image", "border", "border-radius", "box-shadow", "gap", "justify-content", "align-items"];

mkdir(path.join(out, "css"));
const b = await browser();
const meta = { url, takenAt: new Date().toISOString(), widths: {}, failed: [], console: [] };

for (const [i, w] of widths(a.widths).entries()) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  if (i === 0) {
    page.on("response", (r) => { if (r.status() >= 400) meta.failed.push({ status: r.status(), url: r.url() }); });
    page.on("requestfailed", (r) => meta.failed.push({ status: 0, url: r.url(), error: r.failure()?.errorText }));
    page.on("console", (m) => { if (m.type() === "error") meta.console.push(m.text().slice(0, 300)); });
    page.on("pageerror", (e) => meta.console.push(`pageerror: ${String(e.message).slice(0, 300)}`));
  }
  try { await page.goto(url, { waitUntil: "networkidle", timeout: 60000 }); }
  catch { await page.goto(url, { waitUntil: "load", timeout: 60000 }).catch((e) => die(`không mở được ${url}: ${e.message}`)); }
  await scrollThrough(page);
  await page.waitForTimeout(Number(a.wait) || 1500);
  await page.evaluate(() => document.fonts?.ready);

  if (i === 0) {
    // Thông tin chung của trang: chỉ lấy một lần.
    Object.assign(meta, await page.evaluate(() => {
      const attrs = (el) => Object.fromEntries([...el.attributes].map((x) => [x.name, x.value]));
      const html = document.documentElement.outerHTML;
      const has = (re) => re.test(html);
      const gen = document.querySelector('meta[name="generator"]')?.getAttribute("content") || "";
      const source = {
        generator: gen,
        wordpress: has(/wp-content\/|wp-includes\//),
        elementor: has(/class="[^"]*elementor/),
        wpbakery: has(/class="[^"]*(vc_row|wpb_)/),
        divi: has(/class="[^"]*et_pb_/),
        gutenberg: has(/class="[^"]*wp-block-/),
        woocommerce: has(/woocommerce/),
        wooBlocks: has(/wp-block-woocommerce-(cart|checkout)/),
        revslider: has(/rev_slider|rs-module/),
        next: has(/__next|_next\/static/),
        react: has(/data-reactroot|__REACT_DEVTOOLS|_reactListening/),
        nuxt: has(/__nuxt|_nuxt\//),
        shopify: has(/cdn\.shopify\.com|Shopify\.theme/),
        webflow: has(/data-wf-page|webflow\.js/),
        tailwind: has(/class="[^"]*\b(sm|md|lg|xl):[a-z-]+\d/),
        jquery: typeof window.jQuery === "function",
      };
      const sheets = [...document.querySelectorAll('link[rel~="stylesheet"], style')].map((el) =>
        el.tagName === "STYLE" ? { type: "inline", media: el.media || "", id: el.id || "", text: el.textContent || "" }
          : { type: "link", href: el.href, media: el.media || "", id: el.id || "" });
      const scripts = [...document.scripts].map((s) => s.src || `inline:${(s.textContent || "").slice(0, 80).replace(/\s+/g, " ")}`);
      const fonts = [...(document.fonts || [])].filter((f) => f.status === "loaded").map((f) => `${f.family} ${f.weight} ${f.style}`);
      const links = [...new Set([...document.querySelectorAll("a[href]")].map((x) => x.href.split("#")[0]).filter((h) => h.startsWith(location.origin)))];
      const lazy = document.querySelectorAll("img[data-src]:not([src]), img[data-lazy-src], img[src^='data:image']").length;
      return { html: attrs(document.documentElement), body: attrs(document.body), source, sheets, scripts, fonts, links, lazyImagesLeft: lazy, title: document.title };
    }));
    // Lưu nội dung từng stylesheet theo thứ tự trên trang.
    const order = [];
    for (const [n, s] of meta.sheets.entries()) {
      const name = `${String(n).padStart(2, "0")}-${s.type === "inline" ? `inline${s.id ? "-" + s.id : ""}` : path.basename(new URL(s.href).pathname).replace(/\.css$/, "") || "sheet"}.css`.replace(/[^a-z0-9._-]+/gi, "_");
      let text = s.text ?? "";
      if (s.type === "link") {
        const r = await ctx.request.get(s.href).catch(() => null);
        text = r && r.ok() ? await r.text() : `/* KHÔNG TẢI ĐƯỢC: ${s.href} */`;
      }
      fs.writeFileSync(path.join(out, "css", name), text);
      order.push({ file: name, type: s.type, href: s.href ?? null, base: s.href ?? url, media: s.media });
      delete s.text;
    }
    writeJson(path.join(out, "css", "order.json"), order);
  }

  fs.writeFileSync(path.join(out, `dom-${w}.html`), await page.content());
  await page.addStyleTag({ content: FREEZE_CSS });
  await page.waitForTimeout(200);
  meta.widths[w] = await page.evaluate(({ selectors, keys }) => {
    const res = { height: document.documentElement.scrollHeight, overflowX: document.documentElement.scrollWidth > window.innerWidth, elements: {} };
    for (const sel of selectors) {
      let el;
      try { el = document.querySelector(sel); } catch { continue; }
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      res.elements[sel] = {
        tag: el.tagName.toLowerCase(), cls: (el.getAttribute("class") || "").slice(0, 200),
        box: { x: Math.round(r.x), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height) },
        style: Object.fromEntries(keys.map((k) => [k, cs.getPropertyValue(k)])),
      };
    }
    return res;
  }, { selectors: SELECTORS, keys: STYLE_KEYS });
  await page.screenshot({ path: path.join(out, `shot-${w}.png`), fullPage: true });
  await ctx.close();
  console.log(`đã chụp ${w}px: cao ${meta.widths[w].height}px${meta.widths[w].overflowX ? ", CÓ THANH CUỘN NGANG" : ""}`);
}
await b.close();
writeJson(path.join(out, "meta.json"), meta);

const src = Object.entries(meta.source).filter(([, v]) => v === true).map(([k]) => k);
console.log(`nguồn: ${src.join(", ") || "HTML thường"}${meta.source.generator ? ` (generator: ${meta.source.generator})` : ""}`);
console.log(`class <body>: ${meta.body.class || "(không có)"}`);
console.log(`stylesheet: ${meta.sheets.length}, font đã nạp: ${meta.fonts.length}, request lỗi: ${meta.failed.length}, lỗi console: ${meta.console.length}`);
if (meta.lazyImagesLeft) console.log(`CẢNH BÁO: còn ${meta.lazyImagesLeft} ảnh lazyload chưa có src thật`);
console.log(`xong: ${path.resolve(out)}`);
