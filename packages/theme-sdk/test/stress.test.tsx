import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CORE_NODES, normalizeContent } from "@ecomcx/ecomweb-content";
import { renderContent, type RenderContext } from "../src/rich";
import { configureRuntime } from "../src/runtime";

/**
 * Thử tải SDK bằng website "khó": tài liệu ngẫu nhiên có hạt giống (lồng sâu, thuộc tính cực đoan, chữ đặc biệt) và tài liệu bệnh lý
 * (lồng 60 cấp, hàng chục nghìn khối, bảng lớn, nghìn tiêu đề). Mỗi tài liệu: chuẩn hoá → vẽ không lỗi → HTML hợp lệ về lồng thẻ
 * (không <p> chứa khối, không <a> trong <a>…) → không `undefined` / `[object Object]` / NaN → vẽ hai lần giống nhau → trong ngân sách thời gian.
 * Tái hiện một ca: STRESS_SEED=<số>. Số ca: STRESS_RUNS (mặc định 60).
 */
const site = { name: "Test", url: "https://example.com", locale: "vi" } as never;
const ctx = (): RenderContext => ({ site, resolve: { shortcode: async () => null, block: async () => null } });
const html = async (content: unknown) => renderToStaticMarkup(<>{await renderContent(content, ctx())}</>);

function rng(seed: number) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1_000_000) / 1_000_000; }; }
type N = Record<string, unknown>;

// --------------------------------------------------------------------- sinh tài liệu
const WORDS = ["xin", "chào", "Việt Nam", "đẹp", "web", "builder", "<script>x</script>", "a & b", `"quote"`, "'single'", "😀", "مرحبا", "ẞ", "z̷a̷l̷g̷o̷", "a".repeat(120), "https://example.com/a?b=c&d=e", "{{x}}", "${y}", "%s", "\u0000", "‮"];
function gen(seed: number, maxDepth: number) {
  const r = rng(seed);
  const pick = <T,>(a: readonly T[]): T => a[Math.floor(r() * a.length)];
  const word = () => pick(WORDS);
  const text = (n = 1 + Math.floor(r() * 6)) => Array.from({ length: n }, word).join(" ");
  const inline = (): N[] => {
    const parts: N[] = [];
    for (let i = 0, n = 1 + Math.floor(r() * 3); i < n; i++) {
      const marks = r() < 0.4 ? [pick([{ type: "bold" }, { type: "italic" }, { type: "underline" }, { type: "code" }, { type: "strike" }, { type: "link", attrs: { href: pick(["https://example.com", "/trang", "#neo", "javascript:alert(1)", "mailto:a@b.vn", "data:text/html,x"]) } }])] : undefined;
      parts.push({ type: "text", text: text(), ...(marks ? { marks } : {}) });
    }
    return parts;
  };
  const colour = () => pick(["primary", "accent", "muted", "surface", "white", "text", "primary/40", "#ff0000", "rgb(0,0,0)", "nonsense!!", "var(--x)"]);
  const len = () => pick(["0", "1px", "12px", "4rem", "50%", "calc(100% - 2rem)", "9999px", "-5px", "abc", "xs", "xl", "100vw"]);
  const style = (): N => {
    const st: N = {};
    if (r() < 0.5) st.padding = { base: r() < 0.5 ? len() : { top: len(), right: len(), bottom: len(), left: len() }, tablet: len(), mobile: len() };
    if (r() < 0.4) st.margin = { base: { top: len(), bottom: len() } };
    if (r() < 0.4) st.color = { text: colour(), background: colour() };
    if (r() < 0.3) st.radius = len();
    if (r() < 0.3) st.border = { width: len(), style: pick(["solid", "dashed", "double", "bogus"]), color: colour() };
    if (r() < 0.25) st.shadow = pick(["none", "sm", "md", "lg", "xl", "weird"]);
    if (r() < 0.25) st.gradient = pick(["linear-gradient(90deg, #1a597b 0%, #f26251 100%)", "linear-gradient(0deg, red, blue)", "radial-gradient(red, blue)", "url(javascript:alert(1))"]);
    if (r() < 0.2) st.hide = [pick(["desktop", "tablet", "mobile"])];
    if (r() < 0.25) st.layout = r() < 0.5 ? { type: "flex", direction: { base: pick(["row", "column", "row-reverse"]) }, justify: { base: pick(["start", "center", "between"]) }, wrap: r() < 0.5 } : { type: "grid", columns: { base: 1 + Math.floor(r() * 6), tablet: 2, mobile: 1 } };
    if (r() < 0.2) st.motion = { in: pick(["fade", "slide-up", "zoom", "bogus"]), hover: pick(["lift", "grow", "none"]), repeat: r() < 0.5 };
    if (r() < 0.2) st.background = { image: { base: pick(["/uploads/a.jpg", "https://example.com/b.png", "javascript:alert(1)"]) }, size: { base: pick(["cover", "contain"]) }, fixed: r() < 0.5, overlay: colour(), overlayOpacity: Math.floor(r() * 140) - 20, overlayBlend: pick(["multiply", "screen", "bogus"]) };
    if (r() < 0.15) st.divider = { top: { shape: pick(["wave", "tilt", "zigzag", "bogus"]), color: colour(), height: Math.floor(r() * 400) }, bottom: { shape: "curve", color: colour() } };
    if (r() < 0.15) st.textShadow = { x: Math.floor(r() * 120) - 60, y: 2, blur: 4, color: colour() };
    if (r() < 0.1) st.writingMode = "vertical";
    if (r() < 0.1) st.position = { type: "sticky", top: len() };
    if (r() < 0.15) st.zIndex = Math.floor(r() * 20000) - 100;
    return st;
  };
  const randAttrs = (type: string): N => {
    const spec = (CORE_NODES as Record<string, { attrs?: Record<string, { type: string; enum?: readonly unknown[]; min?: number; max?: number }> }>)[type]?.attrs ?? {};
    const out: N = {};
    for (const [k, a] of Object.entries(spec)) {
      if (r() < 0.35) continue;
      if (a.enum) out[k] = r() < 0.9 ? pick(a.enum) : "bogus-value";
      else if (a.type === "string") out[k] = r() < 0.1 ? text(20) : text(1);
      else if (a.type === "url") out[k] = pick(["https://example.com/x", "/uploads/y.png", "javascript:alert(1)", "data:text/html,boo", "//evil.com", "vbscript:x", ""]);
      else if (a.type === "boolean") out[k] = r() < 0.5;
      else if (a.type === "integer" || a.type === "number") out[k] = r() < 0.1 ? pick([-1, 0, 1e9, NaN, 2 ** 31]) : Math.floor((a.min ?? 0) + r() * ((a.max ?? 100) - (a.min ?? 0)));
    }
    if (r() < 0.8) out.style = style();
    if (r() < 0.2) out.anchor = pick(["a", "same", "x y", "a".repeat(80), "1abc"]);
    if (r() < 0.2) out.className = pick(["x", "a b", "<bad>", "ecx-s-fake"]);
    return out;
  };
  const para = (): N => ({ type: "paragraph", attrs: randAttrs("paragraph"), content: inline() });
  const leaf = (): N => {
    const t = pick(["paragraph", "paragraph", "heading", "blockquote", "bulletList", "orderedList", "taskList", "codeBlock", "horizontalRule", "table", "callout", "spacer", "buttons", "iconBox", "imageBox", "iconList", "counter", "testimonial", "progressBar", "map", "rating", "countdown", "socialLinks", "tableOfContents", "gallery", "image", "youtube", "pullquote", "icon"]);
    switch (t) {
      case "paragraph": return para();
      case "heading": return { type: "heading", attrs: randAttrs("heading"), content: inline() };
      case "blockquote": return { type: "blockquote", attrs: randAttrs("blockquote"), content: [para()] };
      case "bulletList": case "orderedList": return { type: t, attrs: t === "orderedList" ? randAttrs("orderedList") : undefined, content: Array.from({ length: 1 + Math.floor(r() * 4) }, () => ({ type: "listItem", content: [para()] })) };
      case "taskList": return { type: "taskList", content: Array.from({ length: 1 + Math.floor(r() * 3) }, () => ({ type: "taskItem", attrs: { checked: r() < 0.5 }, content: [para()] })) };
      case "codeBlock": return { type: "codeBlock", attrs: randAttrs("codeBlock"), content: [{ type: "text", text: text(8) }] };
      case "table": return { type: "table", attrs: randAttrs("table"), content: Array.from({ length: 1 + Math.floor(r() * 4) }, (_, ri) => ({ type: "tableRow", content: Array.from({ length: 1 + Math.floor(r() * 4) }, () => ({ type: ri === 0 ? "tableHeader" : "tableCell", attrs: r() < 0.2 ? { colspan: 1 + Math.floor(r() * 3) } : undefined, content: [para()] })) })) };
      case "callout": return { type: "callout", attrs: randAttrs("callout"), content: [para()] };
      case "buttons": return { type: "buttons", attrs: randAttrs("buttons"), content: Array.from({ length: 1 + Math.floor(r() * 3) }, () => ({ type: "button", attrs: randAttrs("button") })) };
      case "iconList": return { type: "iconList", attrs: { ...randAttrs("iconList"), items: Array.from({ length: 1 + Math.floor(r() * 4) }, () => ({ text: text(2), icon: pick(["check", "star", "bogus"]) })) } };
      case "gallery": return { type: "gallery", attrs: { ...randAttrs("gallery"), images: Array.from({ length: Math.floor(r() * 9) }, () => ({ src: pick(["/uploads/a.jpg", "https://example.com/b.jpg", "javascript:x"]), alt: text(2) })) } };
      case "socialLinks": return { type: "socialLinks", attrs: { ...randAttrs("socialLinks"), links: Array.from({ length: 1 + Math.floor(r() * 4) }, () => ({ service: pick(["facebook", "x", "bogus"]), url: pick(["https://fb.com/a", "javascript:x"]) })) } };
      default: return { type: t, attrs: randAttrs(t) };
    }
  };
  const container = (depth: number): N => {
    const t = pick(["group", "group", "columns", "accordion", "tabs", "cover", "mediaText", "carousel"]);
    const kids = (n = 1 + Math.floor(r() * 3)) => Array.from({ length: n }, () => node(depth - 1));
    switch (t) {
      case "group": return { type: "group", attrs: randAttrs("group"), content: kids() };
      case "columns": return { type: "columns", attrs: randAttrs("columns"), content: Array.from({ length: 1 + Math.floor(r() * 4) }, () => ({ type: "column", attrs: randAttrs("column"), content: kids() })) };
      case "accordion": return { type: "accordion", attrs: randAttrs("accordion"), content: Array.from({ length: 1 + Math.floor(r() * 4) }, () => ({ type: "details", attrs: { summary: text(2), open: r() < 0.3 }, content: kids() })) };
      case "tabs": return { type: "tabs", attrs: randAttrs("tabs"), content: Array.from({ length: 1 + Math.floor(r() * 4) }, () => ({ type: "tab", attrs: { title: text(1), icon: pick(["star", "bogus"]) }, content: kids() })) };
      case "cover": return { type: "cover", attrs: randAttrs("cover"), content: kids() };
      case "mediaText": return { type: "mediaText", attrs: randAttrs("mediaText"), content: kids() };
      default: return { type: "carousel", attrs: randAttrs("carousel"), content: Array.from({ length: 1 + Math.floor(r() * 3) }, () => ({ type: "group", content: kids() })) };
    }
  };
  // Ngân sách nút: cây ngẫu nhiên ở độ sâu lớn nở theo cấp số nhân (hàng triệu nút) — chặn ở ~1.500 nút mỗi tài liệu để ca nào cũng vẽ trong vài trăm ms
  let budget = 1500;
  const node = (depth: number): N => (depth > 0 && budget-- > 0 && r() < 0.55 ? container(depth) : leaf());
  return { version: 1, blocks: [{ id: "main", type: "richtext", data: { type: "doc", content: Array.from({ length: 6 + Math.floor(r() * 18) }, () => node(maxDepth)) } }] };
}

// --------------------------------------------------------------------- kiểm HTML
const BLOCK = new Set(["address", "article", "aside", "blockquote", "details", "div", "dl", "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "main", "menu", "nav", "ol", "p", "pre", "section", "table", "ul"]);
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
/** Lồng thẻ mà trình duyệt sẽ tự sửa (gây lệch hydration): <p> chứa khối, <a> / <button> / <form> lồng nhau, <li> ngoài danh sách… */
function nesting(htmlText: string): string[] {
  const bad: string[] = [];
  const stack: string[] = [];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g;
  const stripped = htmlText.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<!--[\s\S]*?-->/g, "");
  for (let m = re.exec(stripped); m; m = re.exec(stripped)) {
    const [, close, tagRaw, selfClose] = m;
    const tag = tagRaw.toLowerCase();
    if (close) { const i = stack.lastIndexOf(tag); if (i >= 0) stack.length = i; continue; }
    const inP = stack.includes("p") && !stack.slice(stack.lastIndexOf("p")).some((t) => ["button", "td", "th", "li", "dd", "figure", "blockquote", "details", "div", "section"].includes(t) && t !== "p");
    if (BLOCK.has(tag) && stack.at(-1) === "p") bad.push(`<${tag}> nằm trực tiếp trong <p>`);
    if (tag === "a" && stack.includes("a")) bad.push("<a> trong <a>");
    if (tag === "button" && stack.includes("button")) bad.push("<button> trong <button>");
    if (tag === "form" && stack.includes("form")) bad.push("<form> trong <form>");
    if (["a", "button"].includes(stack.at(-1) ?? "") && ["button", "a", "input", "select", "textarea"].includes(tag) && stack.at(-1) !== tag) bad.push(`<${tag}> trong <${stack.at(-1)}> (nội dung tương tác lồng nhau)`);
    if (tag === "li" && !["ul", "ol", "menu"].includes(stack.at(-1) ?? "")) bad.push("<li> ngoài danh sách");
    if (["tr"].includes(tag) && !["table", "thead", "tbody", "tfoot"].includes(stack.at(-1) ?? "")) bad.push("<tr> sai chỗ");
    if (["td", "th"].includes(tag) && stack.at(-1) !== "tr") bad.push(`<${tag}> ngoài <tr>`);
    if (tag === "summary" && stack.at(-1) !== "details") bad.push("<summary> ngoài <details>");
    void inP;
    if (!VOID.has(tag) && !selfClose) stack.push(tag);
  }
  return [...new Set(bad)];
}
const FORBIDDEN = /\[object Object\]|>undefined<|="undefined"|>NaN<|="NaN"|>null<|=\"null\"/;

async function render(name: string, content: unknown, budgetMs: number) {
  const norm = normalizeContent(content).doc;
  await html(norm); // vẽ khởi động: lần đầu khối cần ngôn ngữ site (getT) phải tải /site nên các khối anh em xong lệch thứ tự so với lần sau (đã có cache) — chỉ đổi thứ tự <style>
  const t0 = Date.now();
  const a = await html(norm);
  const ms = Date.now() - t0;
  assert.ok(ms < budgetMs, `${name}: vẽ mất ${ms}ms (ngân sách ${budgetMs}ms; ${JSON.stringify(norm).match(/"type":/g)?.length ?? 0} nút, ${Math.round(a.length / 1024)}KB HTML)`);
  const again = await html(norm);
  if (again !== a) { const k = [...a].findIndex((c, i) => c !== again[i]); assert.fail(`${name}: vẽ hai lần ra HTML khác nhau tại ${k}: «${a.slice(Math.max(0, k - 120), k + 80)}» ≠ «${again.slice(Math.max(0, k - 120), k + 80)}»`); }
  const n = nesting(a);
  assert.deepEqual(n, [], `${name}: lồng thẻ sai: ${n.join("; ")}`);
  assert.ok(!FORBIDDEN.test(a), `${name}: có giá trị rỗng / lỗi lọt ra HTML (${FORBIDDEN.exec(a)?.[0]})`);
  assert.ok(!/<script[\s>]/i.test(a.replace(/<script[^>]*ld\+json[\s\S]*?<\/script>/g, "")), `${name}: có thẻ <script>`);
  assert.ok(!/\s(?:href|src|action)="\s*javascript:/i.test(a), `${name}: có javascript: trong href / src / action`);
  return { ms, bytes: a.length };
}

test("tài liệu ngẫu nhiên khó (lồng sâu, thuộc tính cực đoan): vẽ ổn định, HTML hợp lệ, an toàn", async () => {
  configureRuntime({ themes: {}, plugins: {} });
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (u: RequestInfo | URL) => new Response(JSON.stringify(/\/site\b/.test(String(u)) ? { title: "Test", language: "vi", locale: "vi", url: "https://example.com" } : { items: [], total: 0 }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
  try {
    const runs = Number(process.env.STRESS_RUNS ?? 60), base = Number(process.env.STRESS_SEED ?? 1);
    let maxMs = 0, totalBytes = 0;
    for (let k = 0; k < runs; k++) {
      const seed = base + k;
      try { const s = await render(`seed ${seed}`, gen(seed, 3 + (seed % 12)), 8000); maxMs = Math.max(maxMs, s.ms); totalBytes += s.bytes; }
      catch (e) { throw new Error(`STRESS_SEED=${seed}: ${(e as Error).message} ${((e as Error).stack ?? "").split("\n").slice(1, 4).map((l) => l.trim().replace(/file:\/\/.*\//, "")).join(" | ")}`); }
    }
    console.log(`# stress ngẫu nhiên: ${runs} tài liệu, chậm nhất ${maxMs}ms, tổng ${Math.round(totalBytes / 1024)}KB HTML`);
  } finally { globalThis.fetch = realFetch; }
});

// --------------------------------------------------------------------- tài liệu bệnh lý
const P = (t: string): N => ({ type: "paragraph", content: [{ type: "text", text: t }] });
const doc = (content: N[]) => ({ version: 1, blocks: [{ id: "main", type: "richtext", data: { type: "doc", content } }] });
const nestedGroups = (n: number): N => { let cur: N = P("lõi"); for (let i = 0; i < n; i++) cur = { type: i % 3 === 0 ? "group" : i % 3 === 1 ? "columns" : "group", ...(i % 3 === 1 ? { content: [{ type: "column", content: [cur] }] } : { attrs: { style: { padding: { base: "4px" } } }, content: [cur] }) }; return cur; };

const HEAVY: Array<[string, () => unknown, number]> = [
  ["lồng 60 cấp nhóm / cột", () => doc([nestedGroups(60)]), 3000],
  ["20.000 đoạn văn", () => doc(Array.from({ length: 20000 }, (_, i) => P(`Đoạn số ${i} — nội dung`))), 15000],
  ["bảng 100 × 100", () => doc([{ type: "table", content: Array.from({ length: 100 }, (_, r) => ({ type: "tableRow", content: Array.from({ length: 100 }, (_, c) => ({ type: r === 0 ? "tableHeader" : "tableCell", content: [P(`${r}.${c}`)] })) })) }]), 10000],
  ["1.000 tiêu đề + mục lục", () => doc([{ type: "tableOfContents", attrs: { maxLevel: 4 } }, ...Array.from({ length: 1000 }, (_, i) => ({ type: "heading", attrs: { level: 2 + (i % 3) }, content: [{ type: "text", text: i % 7 === 0 ? "Trùng lặp" : `Tiêu đề ${i}` }] }))]), 10000],
  ["accordion 500 mục lồng trong tabs 50 tab", () => doc([{ type: "tabs", content: Array.from({ length: 50 }, (_, t) => ({ type: "tab", attrs: { title: `Tab ${t}` }, content: [{ type: "accordion", content: Array.from({ length: 10 }, (_, a) => ({ type: "details", attrs: { summary: `Mục ${t}.${a}` }, content: [P("nội dung")] })) }] })) }]), 8000],
  ["thư viện 500 ảnh + 200 cột", () => doc([{ type: "gallery", attrs: { columns: 6, images: Array.from({ length: 500 }, (_, i) => ({ src: `/uploads/${i}.jpg`, alt: `ảnh ${i}` })) } }, { type: "columns", content: Array.from({ length: 200 }, (_, i) => ({ type: "column", content: [P(`cột ${i}`)] })) }]), 8000],
  ["văn bản 2 MB một đoạn + ký tự đặc biệt", () => doc([P("Việt Nam ".repeat(220000)), P("<script>alert(1)</script>".repeat(1000)), P("\u0000‮﻿".repeat(1000))]), 8000],
  ["định dạng chồng 40 lớp (đậm / nghiêng / gạch chân / link)", () => doc([{ type: "paragraph", content: [{ type: "text", text: "chữ", marks: Array.from({ length: 40 }, (_, i) => ({ type: ["bold", "italic", "underline", "strike", "code", "link"][i % 6], ...(i % 6 === 5 ? { attrs: { href: "https://example.com" } } : {}) })) }] }]), 3000],
  ["500 khối widget lẫn lộn", () => doc(Array.from({ length: 500 }, (_, i) => ({ type: ["iconBox", "counter", "testimonial", "progressBar", "rating", "icon", "imageBox"][i % 7], attrs: { title: `T${i}`, text: `x${i}`, quote: "q", name: "n", end: i, value: i % 100, name_: "x" } }))), 10000],
];
for (const [name, build, budget] of HEAVY) {
  test(`bệnh lý: ${name}`, async () => {
    configureRuntime({ themes: {}, plugins: {} });
    const s = await render(name, build(), budget);
    console.log(`# ${name}: ${s.ms}ms, ${Math.round(s.bytes / 1024)}KB`);
  });
}
