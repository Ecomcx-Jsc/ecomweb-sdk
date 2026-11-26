#!/usr/bin/env node
// So bản gốc với bản đã chuyển (2 thư mục do snapshot.mjs tạo). Đây là CỬA QUA cuối: chưa đạt thì chưa được báo xong.
//
//   node compare.mjs <snapshot-gốc> <snapshot-theme> [--out <thư-mục>] [--max-diff 5] [--tolerance 2]
//
// So từng độ rộng có ở cả hai bên:
//   - ảnh: % điểm ảnh khác (bỏ qua chênh màu nhỏ), dải dọc lệch nhiều nhất (để biết sửa ở đâu), ảnh diff-<w>.png
//   - chiều cao trang, thanh cuộn ngang
//   - hộp (vị trí/kích thước) và style tính toán của phần tử chính đo được ở cả hai bên
//   - font gốc đã nạp mà bản theme thiếu, request lỗi và lỗi console của bản theme
// Ghi report.md + report.json. Mã thoát: 0 = đạt, 1 = chưa đạt.
import fs from "node:fs";
import path from "node:path";
import { args, browser, die, readJson, writeJson } from "./lib.mjs";

const a = args();
const [origDir, cloneDir] = a._;
if (!origDir || !cloneDir) die("cách dùng: node compare.mjs <snapshot-gốc> <snapshot-theme> [--out dir] [--max-diff 5]");
const out = path.resolve(typeof a.out === "string" ? a.out : path.join(cloneDir, "compare"));
const maxDiff = Number(a["max-diff"] ?? 5);
const tol = Number(a.tolerance ?? 2);
fs.mkdirSync(out, { recursive: true });
const A = readJson(path.join(origDir, "meta.json")), B = readJson(path.join(cloneDir, "meta.json"));
const ws = Object.keys(A.widths).filter((w) => B.widths[w]).map(Number);
if (!ws.length) die("hai bản không có độ rộng chung; chụp cả hai bằng cùng --widths");

const b = await browser();
const page = await b.newPage();
const rows = [], problems = [];

for (const w of ws) {
  const img = (d) => `data:image/png;base64,${fs.readFileSync(path.join(d, `shot-${w}.png`)).toString("base64")}`;
  const r = await page.evaluate(async ({ x, y, band }) => {
    const load = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
    const [ia, ib] = await Promise.all([load(x), load(y)]);
    const W = Math.min(ia.width, ib.width), H = Math.min(ia.height, ib.height, 30000);
    const px = (i) => { const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d"); g.drawImage(i, 0, 0); return g.getImageData(0, 0, W, H).data; };
    const da = px(ia), db = px(ib);
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d"); g.drawImage(ib, 0, 0);
    const over = g.getImageData(0, 0, W, H), o = over.data;
    let diff = 0;
    const bands = new Array(Math.ceil(H / band)).fill(0);
    for (let p = 0; p < da.length; p += 4) {
      const d = Math.max(Math.abs(da[p] - db[p]), Math.abs(da[p + 1] - db[p + 1]), Math.abs(da[p + 2] - db[p + 2]));
      if (d > 24) { diff++; bands[Math.floor(p / 4 / W / band)]++; o[p] = 255; o[p + 1] = 0; o[p + 2] = 60; o[p + 3] = 255; }
      else { o[p + 3] = 70; }
    }
    g.putImageData(over, 0, 0);
    return { W, H, ha: ia.height, hb: ib.height, pct: (diff / (W * H)) * 100,
      bands: bands.map((n, i) => ({ y: i * band, pct: (n / (W * band)) * 100 })).sort((p, q) => q.pct - p.pct).slice(0, 5).filter((x) => x.pct > 1),
      png: c.toDataURL("image/png").split(",")[1] };
  }, { x: img(origDir), y: img(cloneDir), band: 200 });
  fs.writeFileSync(path.join(out, `diff-${w}.png`), Buffer.from(r.png, "base64"));

  const ea = A.widths[w].elements, eb = B.widths[w].elements;
  const el = [];
  for (const sel of Object.keys(ea)) {
    if (!ea[sel].box.w || !ea[sel].box.h) continue; // ẩn ở bản gốc: không so
    if (!eb[sel]) { el.push(`\`${sel}\` có ở bản gốc, KHÔNG có ở bản theme`); continue; }
    const p = ea[sel], q = eb[sel];
    const box = ["x", "y", "w", "h"].filter((k) => Math.abs(p.box[k] - q.box[k]) > tol).map((k) => `${k} ${p.box[k]}→${q.box[k]}`);
    const st = Object.keys(p.style).filter((k) => p.style[k] !== q.style[k]).map((k) => `${k}: \`${p.style[k]}\` → \`${q.style[k]}\``);
    if (box.length || st.length) el.push(`\`${sel}\`${box.length ? ` hộp lệch (${box.join(", ")})` : ""}${st.length ? `\n    - ${st.slice(0, 8).join("\n    - ")}` : ""}`);
  }
  const hd = B.widths[w].height - A.widths[w].height;
  const ok = r.pct <= maxDiff && !B.widths[w].overflowX;
  if (!ok) problems.push(`${w}px: ${r.pct.toFixed(2)}% khác${B.widths[w].overflowX ? ", có thanh cuộn ngang" : ""}`);
  rows.push({ w, pct: r.pct, heightA: A.widths[w].height, heightB: B.widths[w].height, heightDiff: hd, overflowX: B.widths[w].overflowX, bands: r.bands, elements: el, ok });
}
await b.close();

const missingFonts = [...new Set(A.fonts)].filter((f) => !B.fonts.includes(f));
const failed = B.failed.filter((f) => !/google-analytics|googletagmanager|facebook|doubleclick|hotjar/.test(f.url));
if (missingFonts.length) problems.push(`thiếu ${missingFonts.length} font`);
if (failed.length) problems.push(`${failed.length} request lỗi`);
if (B.console.length) problems.push(`${B.console.length} lỗi console`);
const pass = problems.length === 0;

let md = `# So sánh: ${pass ? "ĐẠT" : "CHƯA ĐẠT"}\n\nGốc: ${A.url}\nTheme: ${B.url}\nNgưỡng: ≤ ${maxDiff}% điểm ảnh khác mỗi độ rộng, không cuộn ngang, đủ font, không request lỗi, không lỗi console.\n\n`;
if (!pass) md += `## Phải sửa\n${problems.map((p) => `- ${p}`).join("\n")}\n\n`;
for (const r of rows) {
  md += `## ${r.w}px — ${r.pct.toFixed(2)}% khác ${r.ok ? "(đạt)" : "(CHƯA ĐẠT)"}\n`;
  md += `- Chiều cao: gốc ${r.heightA}px, theme ${r.heightB}px (${r.heightDiff >= 0 ? "+" : ""}${r.heightDiff}px)${Math.abs(r.heightDiff) > 50 ? " — lệch cao thường do thiếu khối, sai margin/padding hoặc ảnh chưa có kích thước" : ""}\n`;
  if (r.overflowX) md += `- CÓ THANH CUỘN NGANG: tìm phần tử rộng hơn màn hình\n`;
  if (r.bands.length) md += `- Vùng lệch nhiều nhất (từ đầu trang): ${r.bands.map((x) => `y=${x.y}–${x.y + 200}px ${x.pct.toFixed(0)}%`).join(", ")}. Xem diff-${r.w}.png (đỏ = khác)\n`;
  if (r.elements.length) md += `- Phần tử lệch:\n  - ${r.elements.join("\n  - ")}\n`;
  md += "\n";
}
if (missingFonts.length) md += `## Font gốc có mà theme thiếu\n- ${missingFonts.join("\n- ")}\n\n`;
if (failed.length) md += `## Request lỗi ở bản theme\n- ${failed.slice(0, 30).map((f) => `${f.status} ${f.url}`).join("\n- ")}\n\n`;
if (B.console.length) md += `## Lỗi console ở bản theme\n- ${B.console.slice(0, 20).join("\n- ")}\n\n`;
md += `Lưu ý: nội dung khác nhau (sản phẩm, bài viết, ảnh demo khác) cũng làm tăng %. Khi đó so các vùng khung (header, footer, banner, lưới) và danh sách phần tử lệch, không đuổi theo nội dung.\n`;
fs.writeFileSync(path.join(out, "report.md"), md);
writeJson(path.join(out, "report.json"), { pass, problems, rows, missingFonts, failed, console: B.console });
console.log(md);
console.log(`báo cáo: ${path.join(out, "report.md")}`);
process.exit(pass ? 0 : 1);
