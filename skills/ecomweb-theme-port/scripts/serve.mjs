#!/usr/bin/env node
// Phục vụ một thư mục tĩnh (bản HTTrack, bản HTML tải về) qua http để chụp bằng snapshot.mjs.
// Không mở bằng file:// vì font, CORS và AJAX sẽ hỏng và ảnh chụp lệch giả.
//
//   node serve.mjs <thư-mục> [--port 8899]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { args, die } from "./lib.mjs";

const a = args();
const root = path.resolve(a._[0] ?? die("cách dùng: node serve.mjs <thư-mục> [--port 8899]"));
const port = Number(a.port) || 8899;
const TYPES = { html: "text/html; charset=utf-8", htm: "text/html; charset=utf-8", css: "text/css", js: "text/javascript", mjs: "text/javascript",
  json: "application/json", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
  avif: "image/avif", ico: "image/x-icon", woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf", eot: "application/vnd.ms-fontobject",
  mp4: "video/mp4", webm: "video/webm", txt: "text/plain; charset=utf-8", xml: "application/xml" };

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let f = path.join(root, p);
  if (!f.startsWith(root)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!fs.existsSync(f)) { res.writeHead(404).end("404"); return; }
  res.writeHead(200, { "content-type": TYPES[path.extname(f).slice(1).toLowerCase()] ?? "application/octet-stream", "access-control-allow-origin": "*" });
  fs.createReadStream(f).pipe(res);
}).listen(port, () => console.log(`đang phục vụ ${root} tại http://127.0.0.1:${port}/ (Ctrl+C để dừng)`));
