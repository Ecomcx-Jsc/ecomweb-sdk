#!/usr/bin/env node
// Chứng minh kit/Carousel giống Owl Carousel THẬT: cùng một cấu hình chạy bằng owl.carousel 2.3.4 (jQuery) và bằng kit,
// rồi motion.mjs so hai trang. Phải ĐẠT (không có dòng "Phải sửa").
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { build } from "esbuild";

const here = path.dirname(new URL(import.meta.url).pathname);
const nm = path.join(here, "node_modules");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "motion-test-"));
const CSS = fs.readFileSync(path.join(nm, "owl.carousel/dist/assets/owl.carousel.css"), "utf8") +
  "@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes fadeOut{from{opacity:1}to{opacity:0}}.fadeIn{animation-name:fadeIn}.fadeOut{animation-name:fadeOut}" +
  ".slide{height:200px;background:#eee}.card{height:120px;background:#ddd}body{margin:0}.wrap{width:900px}";
const SLIDES = [1, 2, 3].map((i) => `<div class="slide">S${i}</div>`).join("");
const CARDS = [1, 2, 3, 4, 5, 6].map((i) => `<div class="card">C${i}</div>`).join("");
fs.writeFileSync(path.join(dir, "orig.html"), `<!doctype html><html><head><style>${CSS}</style></head><body><div class="wrap">
<div class="hero-slider owl-carousel">${SLIDES}</div><div class="product-carousel owl-carousel">${CARDS}</div></div>
<script>${fs.readFileSync(path.join(nm, "jquery/dist/jquery.min.js"), "utf8")}</script>
<script>${fs.readFileSync(path.join(nm, "owl.carousel/dist/owl.carousel.min.js"), "utf8")}</script>
<script>$(".hero-slider").owlCarousel({items:1,loop:true,autoplay:true,autoplayTimeout:2000,animateIn:"fadeIn",animateOut:"fadeOut",dots:true,nav:false});
$(".product-carousel").owlCarousel({items:4,margin:20,loop:false,nav:true,dots:false});</script></body></html>`);
const entry = `import { createRoot } from "react-dom/client"; import { OwlCarousel } from "./Carousel";
const S = [1,2,3].map((i) => <div key={i} className="slide">S{i}</div>);
const C = [1,2,3,4,5,6].map((i) => <div key={i} className="card">C{i}</div>);
createRoot(document.getElementById("root")).render(<div className="wrap">
  <OwlCarousel className="hero-slider" items={1} loop autoplay autoplayTimeout={2000} animateIn="fadeIn" animateOut="fadeOut" dots nav={false}>{S}</OwlCarousel>
  <OwlCarousel className="product-carousel" items={4} margin={20} nav dots={false}>{C}</OwlCarousel>
</div>);`;
const js = await build({ stdin: { contents: entry, resolveDir: path.join(here, "..", "kit"), loader: "tsx" }, bundle: true, write: false, format: "iife", jsx: "automatic",
  nodePaths: [nm], define: { "process.env.NODE_ENV": '"production"' }, logLevel: "error",
  plugins: [{ name: "nav", setup(b) { b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "n", namespace: "s" })); b.onLoad({ filter: /.*/, namespace: "s" }, () => ({ contents: "export const usePathname=()=>'/'", loader: "js" })); } }] });
fs.writeFileSync(path.join(dir, "clone.html"), `<!doctype html><html><head><style>${CSS}</style></head><body><div id="root"></div><script>${js.outputFiles[0].text}</script></body></html>`);
const port = 19000 + Math.floor(Math.random() * 900);
const srv = spawn(process.execPath, [path.join(here, "serve.mjs"), dir, "--port", String(port)], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 500));
const run = (...a) => execFileSync(process.execPath, [path.join(here, "motion.mjs"), ...a], { encoding: "utf8" });
try {
  run("record", `http://127.0.0.1:${port}/orig.html`, path.join(dir, "a.json"), "--seconds", "7", "--width", "1200");
  run("record", `http://127.0.0.1:${port}/clone.html`, path.join(dir, "b.json"), "--seconds", "7", "--width", "1200");
  let out = "";
  try { out = run("compare", path.join(dir, "a.json"), path.join(dir, "b.json"), "--out", path.join(dir, "r.md")); }
  catch (e) { console.log(e.stdout); throw new Error("motion-test: kit lệch so với Owl thật"); }
  if (!/Chuyển động: ĐẠT/.test(out)) { console.log(out); throw new Error("motion-test: chưa đạt"); }
  console.log("motion-test: ĐẠT (kit/Carousel khớp Owl Carousel 2.3.4)");
} finally { srv.kill(); fs.rmSync(dir, { recursive: true, force: true }); }
