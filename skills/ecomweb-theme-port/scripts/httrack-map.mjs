#!/usr/bin/env node
// Đọc nhật ký của HTTrack (hts-cache/new.txt) để biết file trên máy ứng với URL gốc nào và file nào bị thiếu.
// HTTrack đổi tên file có query (style.css?ver=6.1 -> style6a3f.css), nên phải tra bảng này mới biết nguồn thật.
//
//   node httrack-map.mjs <thư-mục-httrack> [--out map.json]
//
// Ghi map.json: { pages: [{url, file}], files: {"<đường dẫn tương đối>": "<URL gốc>"}, missing: [{status, url}] }
import fs from "node:fs";
import path from "node:path";
import { args, die, writeJson } from "./lib.mjs";

const a = args();
const root = path.resolve(a._[0] ?? die("cách dùng: node httrack-map.mjs <thư-mục-httrack> [--out map.json]"));
const log = path.join(root, "hts-cache", "new.txt");
if (!fs.existsSync(log)) die(`không thấy ${log}. HTTrack chạy với cache tắt (-C0) thì không có bảng này; chạy lại HTTrack có cache, hoặc chụp thẳng site gốc bằng snapshot.mjs.`);

const files = {}, pages = [], missing = [];
for (const line of fs.readFileSync(log, "utf8").split("\n").slice(1)) {
  const c = line.split("\t");
  if (c.length < 9) continue;
  const status = Number(c[3]), mime = c[5], url = c[7], local = c[8];
  if (status >= 400 || (status === 0 && !local)) { missing.push({ status, url }); continue; }
  if (!local || status >= 300) continue;
  const rel = path.relative(root, local);
  files[rel] = url;
  if (mime.startsWith("text/html")) pages.push({ url, file: rel });
}
const out = a.out ? path.resolve(a.out) : path.join(root, "map.json");
writeJson(out, { root, pages, files, missing });
console.log(`trang: ${pages.length}, file: ${Object.keys(files).length}, thiếu/lỗi: ${missing.length}`);
console.log(`trang đầu: ${pages[0]?.url ?? "(không có)"} -> ${pages[0]?.file ?? ""}`);
for (const m of missing.filter((m) => /\.(css|js|woff2?|ttf|svg|png|jpe?g|webp)(\?|$)/i.test(m.url)).slice(0, 20)) console.log(`  thiếu ${m.status} ${m.url}`);
console.log(`đã ghi ${out}`);
