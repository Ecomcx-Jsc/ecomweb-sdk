#!/usr/bin/env node
// Kiểm html2jsx.mjs: HTML khó (SVG, style có biến CSS + url(), lazyload, bảng, input, thuộc tính lạ, chữ có {}),
// đổi sang TSX, kiểm kiểu bằng tsc, render bằng react-dom/server, so cây thẻ + class + chữ với bản gốc.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { build } from "esbuild";
import { chromium } from "playwright";

const here = path.dirname(new URL(import.meta.url).pathname);
const nm = path.join(here, "node_modules");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "h2j-"));
const site = path.join(dir, "site"), theme = path.join(dir, "theme");
fs.mkdirSync(site); fs.mkdirSync(theme);
fs.writeFileSync(path.join(theme, "theme.json"), '{"name":"t","slug":"t","version":"1.0.0"}');
fs.writeFileSync(path.join(site, "a.png"), Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000", "hex"));
fs.writeFileSync(path.join(site, "bg.jpg"), "x");
const HTML = `<!doctype html><html><body>
<section class="hero  elementor-element-1a2b" data-settings='{"_animation":"fadeIn"}' style="--gap: 10px; background-image: url('bg.jpg'); margin-top:5px">
  <h2 class="title">Price {from} &lt;b&gt; <span class="x">10</span> <em>sale</em></h2>
  <img class="lazyload pic" data-src="a.png" src="data:image/gif;base64,R0lGOD" width="100" height="50" alt="A" srcset="a.png 1x">
  <svg class="icon" viewBox="0 0 24 24" xmlns:xlink="http://www.w3.org/1999/xlink"><path fill-rule="evenodd" stroke-width="2" d="M0 0h24"/><use xlink:href="#i"/></svg>
  <table class="t"><tbody>
    <tr><td colspan="2" valign="top">a</td></tr>
  </tbody></table>
  <form class="f" novalidate><label for="q">Q</label><input id="q" type="text" value="hi" maxlength="20" readonly><textarea name="m">msg</textarea>
  <select name="s"><option value="1">1</option><option value="2" selected>2</option></select><button type="submit" onclick="alert(1)">Go</button></form>
  <script>alert(1)</script><!-- comment -->
  <a href="/x" target="_blank" rel="noopener" itemprop="url">Link</a>
</section></body></html>`;
fs.writeFileSync(path.join(site, "dom.html"), HTML);
const port = 19500 + Math.floor(Math.random() * 400);
const srv = spawn(process.execPath, [path.join(here, "serve.mjs"), site, "--port", String(port)], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 400));
try {
  const out = path.join(theme, "components", "Hero.tsx");
  execFileSync(process.execPath, [path.join(here, "html2jsx.mjs"), path.join(site, "dom.html"), "--select", ".hero", "--out", out, "--base", `http://127.0.0.1:${port}/`], { stdio: "pipe" });
  const tsx = fs.readFileSync(out, "utf8");
  assert.match(tsx, /className="lazyload pic"|className="pic"/);
  assert.ok(!/onclick|alert\(1\)|<script/.test(tsx), "phải bỏ script và on*");
  assert.match(tsx, /src=\{M\.m\d\}/, "ảnh lazyload phải dùng nguồn thật");
  assert.ok(fs.readdirSync(path.join(theme, "assets", "media")).length === 2, "phải tải 2 ảnh");
  // kiểm kiểu
  fs.writeFileSync(path.join(theme, "tsconfig.json"), JSON.stringify({ compilerOptions: { jsx: "react-jsx", strict: true, noEmit: true, skipLibCheck: true, module: "ESNext", moduleResolution: "Bundler", target: "ES2022", lib: ["DOM", "ES2022"], typeRoots: [path.join(nm, "@types")], paths: { react: [path.join(nm, "@types/react")], "react/jsx-runtime": [path.join(nm, "@types/react/jsx-runtime")] } }, include: ["components/*.tsx"] }));
  execFileSync(path.join(nm, ".bin", "tsc"), ["-p", theme], { stdio: "inherit" });
  // render server rồi so cấu trúc
  const js = await build({ stdin: { contents: `import H from ${JSON.stringify(out)}; import { renderToStaticMarkup } from "react-dom/server"; globalThis.__html = renderToStaticMarkup(<H />);`, resolveDir: theme, loader: "tsx" },
    bundle: true, write: false, format: "esm", platform: "node", jsx: "automatic", packages: "external", logLevel: "error", loader: { ".png": "dataurl", ".jpg": "dataurl" } });
  const f = path.join(here, `.h2j-render-${port}.mjs`); fs.writeFileSync(f, js.outputFiles[0].text);
  try { await import(f); } finally { fs.rmSync(f, { force: true }); }
  const b = await chromium.launch(); const p = await b.newPage();
  const shape = (html) => p.evaluate((h) => {
    const d = new DOMParser().parseFromString(h, "text/html"); const root = d.querySelector(".hero");
    const walk = (el) => [el.tagName.toLowerCase() + "." + [...el.classList].filter((c) => !/^lazy/.test(c)).join("."), ...[...el.children].filter((c) => !["SCRIPT"].includes(c.tagName)).flatMap(walk)];
    return { tags: walk(root), text: root.textContent.replace(/alert\(1\)/, "").replace(/\s+/g, " ").trim(), style: root.getAttribute("style"), td: d.querySelector("td").getAttribute("valign"), sel: d.querySelector("select")?.value };
  }, html);
  const A = await shape(HTML), B = await shape(globalThis.__html);
  await b.close();
  assert.deepEqual(B.tags, A.tags, "cây thẻ + class phải giống bản gốc");
  assert.equal(B.text, A.text, "chữ phải giống bản gốc");
  assert.match(B.style, /--gap: ?10px/);
  assert.match(B.style, /background-image: ?url\(/);
  assert.equal(B.td, "top", "thuộc tính lạ (valign) phải giữ");
  console.log("html2jsx-test: ĐẠT");
} finally { srv.kill(); fs.rmSync(dir, { recursive: true, force: true }); }
