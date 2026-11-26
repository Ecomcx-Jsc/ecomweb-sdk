#!/usr/bin/env node
// Dò tính năng của site gốc từ các bản chụp, đối chiếu Store Ecomweb (+ CMS đang chạy) và ghi đề xuất plugin
// cho người dùng QUYẾT ĐỊNH. Agent phải hỏi người dùng các câu ở cuối FEATURES.md và DỪNG chờ trả lời.
//
//   node features.mjs <port/orig> [--out port/FEATURES.md] [--cms http://localhost:5120] [--store https://store.ecomcx.com]
//
// <port/orig> là thư mục chứa các thư mục snapshot (mỗi trang một thư mục có meta.json + dom-*.html).
import fs from "node:fs";
import path from "node:path";
import { args, die, readJson, writeJson } from "./lib.mjs";

const a = args();
const root = path.resolve(a._[0] ?? die("cách dùng: node features.mjs <port/orig> [--out port/FEATURES.md] [--cms <url API CMS>]"));
const out = path.resolve(typeof a.out === "string" ? a.out : path.join(path.dirname(root), "FEATURES.md"));
const store = (typeof a.store === "string" ? a.store : "https://store.ecomcx.com").replace(/\/$/, "");
const map = readJson(path.join(path.dirname(new URL(import.meta.url).pathname), "feature-map.json"));

const pages = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory() && fs.existsSync(path.join(root, d.name, "meta.json"))).map((d) => d.name);
if (!pages.length) die(`không có snapshot nào trong ${root} (chạy snapshot.mjs trước)`);

// Gom "bằng chứng": giá trị class/id/src/href/action/data-*, URL script/CSS, nội dung script inline — theo trang.
const corpus = {};
for (const p of pages) {
  const dir = path.join(root, p);
  const meta = readJson(path.join(dir, "meta.json"));
  const dom = fs.readdirSync(dir).filter((f) => /^dom-\d+\.html$/.test(f)).sort((x, y) => parseInt(y.slice(4)) - parseInt(x.slice(4)))[0];
  const html = dom ? fs.readFileSync(path.join(dir, dom), "utf8") : "";
  const attrs = [...html.matchAll(/\s(class|id|src|href|action|name|for|data-[\w-]+)=["']([^"']{0,400})["']/gi)].map((m) => `${m[1]}=${m[2]}`);
  const inline = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1].slice(0, 3000));
  corpus[p] = [...attrs, ...(meta.scripts ?? []), ...(meta.sheets ?? []).map((s) => s.href ?? s.id ?? ""), ...inline, `body=${meta.body?.class ?? ""}`].join("\n");
}

const found = [];
for (const f of map.features) {
  const hits = {};
  for (const re of f.detect) {
    const r = new RegExp(re, "i");
    for (const [p, text] of Object.entries(corpus)) {
      const m = r.exec(text);
      if (m) { const line = text.slice(Math.max(0, text.lastIndexOf("\n", m.index) + 1), text.indexOf("\n", m.index) > 0 ? text.indexOf("\n", m.index) : undefined); (hits[p] ??= []).push(line.slice(0, 120)); }
    }
  }
  const where = Object.keys(hits);
  if (where.length) found.push({ ...f, pages: where, evidence: [...new Set(Object.values(hits).flat())].slice(0, 3) });
}

// Store + CMS
let catalog = null, active = null;
try {
  catalog = [];
  for (let pg = 1; pg < 20; pg++) {
    const r = await fetch(`${store}/api/catalog?kind=plugin&page=${pg}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    catalog.push(...j.items);
    if (pg >= (j.totalPages ?? 1)) break;
  }
} catch (e) { catalog = null; console.log(`CẢNH BÁO: không đọc được Store (${e.message}); dùng bảng tra có sẵn`); }
if (typeof a.cms === "string") {
  try { active = (await (await fetch(`${a.cms.replace(/\/$/, "")}/api/public/site`)).json()).activePlugins ?? null; }
  catch (e) { console.log(`CẢNH BÁO: không đọc được CMS ${a.cms} (${e.message})`); }
}
const onStore = (slug) => catalog?.find((x) => x.slug === slug);
const state = (slug) => !slug ? "" : active ? (active.includes(slug) ? "đã bật" : "chưa bật") : "?";

const need = [...map.always.map((x) => ({ ...x, pages: ["(mọi trang)"], evidence: [] })), ...found];
const byStatus = (s) => need.filter((x) => x.status === s);
const pluginRows = need.filter((x) => x.plugin && (x.status === "du" || x.status === "mot-phan"));
const uniqPlugins = [...new Map(pluginRows.map((x) => [x.plugin, x])).keys()];
const gaps = need.filter((x) => x.status === "khong-co" || x.status === "chua-co" || (x.status === "mot-phan" && x.propose));

let md = `# Tính năng của site gốc và đề xuất plugin\n\nNguồn: ${pages.length} trang đã chụp (${pages.join(", ")}). Store: ${catalog ? `${catalog.length} plugin (${store})` : "không đọc được"}. CMS: ${active ? `${active.length} plugin đang bật` : typeof a.cms === "string" ? "không đọc được" : "không kiểm (thêm --cms)"}.\n\n`;
md += `## 1. Plugin đề xuất cài (có trên Store)\n\n| Plugin | Phiên bản Store | Trên CMS | Dùng cho | Mức đáp ứng |\n|---|---|---|---|---|\n`;
for (const slug of uniqPlugins) {
  const rows = pluginRows.filter((x) => x.plugin === slug);
  const st = onStore(slug);
  md += `| \`${slug}\` | ${st ? st.version : catalog ? "**không thấy trên Store**" : "?"} | ${state(slug)} | ${rows.map((x) => x.label).join("; ")} | ${rows.map((x) => (x.status === "du" ? "đủ" : `một phần: ${x.note}`)).join("; ")} |\n`;
}
md += `\n## 2. Làm bằng core hoặc trong theme (không cần plugin)\n\n| Tính năng | Cách làm | Trang |\n|---|---|---|\n`;
for (const x of need.filter((x) => !x.plugin && x.status === "du")) md += `| ${x.label} | ${x.core ? "core" : ""}${x.core && x.theme ? " + " : ""}${x.theme ?? ""}${x.note ? ` — ${x.note}` : ""} | ${x.pages.slice(0, 3).join(", ")} |\n`;
md += `\n## 3. Chưa có plugin hoặc chỉ làm được một phần — cần bạn quyết định\n\n`;
if (!gaps.length) md += `Không có.\n`;
gaps.forEach((x, i) => {
  md += `### 3.${i + 1}. ${x.label}\n- Thấy ở: ${x.pages.slice(0, 4).join(", ")}${x.evidence.length ? ` (bằng chứng: \`${x.evidence[0].replace(/`/g, "'")}\`)` : ""}\n`;
  md += `- Hiện trạng: ${x.status === "chua-co" ? `plugin \`${x.plugin}\` có công tắc nhưng chưa có chức năng. ` : x.status === "mot-phan" ? `\`${x.plugin ?? "core"}\` làm được một phần. ` : "Store chưa có plugin. "}${x.note}\n`;
  md += `- Lựa chọn: **(a)** bỏ tính năng này (theme không vẽ phần đó) · **(b)** làm trong theme, chỉ phần giao diện${x.id === "quickview" ? " (đủ dùng)" : " (không có dữ liệu/admin thật)"} · **(c)** viết plugin mới${x.propose ? `: ${x.propose}` : ""}\n\n`;
});
md += `## 4. Câu hỏi cho bạn (agent DỪNG ở đây chờ trả lời)\n\n`;
md += `1. Cài các plugin ở mục 1? (trả lời: "cài hết", hoặc liệt kê plugin bỏ)\n`;
gaps.forEach((x, i) => { md += `${i + 2}. ${x.label}: chọn (a) bỏ, (b) làm trong theme, hay (c) viết plugin mới?\n`; });
md += `\nChưa có câu trả lời thì không làm phần phụ thuộc plugin. Chọn (c) thì agent viết bản đặc tả plugin (port/PLUGIN-<tên>.md) để bạn duyệt trước, chưa viết mã.\n`;
fs.writeFileSync(out, md);
writeJson(out.replace(/\.md$/, ".json"), { pages, plugins: uniqPlugins, found: need.map(({ detect, ...x }) => x), gaps: gaps.map((x) => x.id) });
console.log(md);
console.log(`đã ghi ${out}`);
