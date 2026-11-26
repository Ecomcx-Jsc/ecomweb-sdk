#!/usr/bin/env node
// Kiểm kit/ trong trình duyệt thật: carousel sinh đúng cây thẻ + class của Owl/Slick, autoplay, animateIn/Out, loop, dải chữ chạy.
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";
import { chromium } from "playwright";

const here = path.dirname(new URL(import.meta.url).pathname);
const kit = path.join(here, "..", "kit");
execFileSync(path.join(here, "node_modules", ".bin", "tsc"), ["-p", kit], { stdio: "inherit" });

const entry = `
import { createRoot } from "react-dom/client";
import { OwlCarousel, SlickCarousel } from "./Carousel";
import RunningLine from "./RunningLine";
const css = ".owl-item{float:left;position:relative}.owl-stage-outer{overflow:hidden}.slick-slide{float:left}.slick-list{overflow:hidden}.word{display:inline-block;width:150px}.content{display:inline-block}.line{width:1000px;white-space:nowrap;overflow:hidden}";
function App() {
  return (<div style={{ width: 600 }}>
    <style>{css}</style>
    <OwlCarousel className="hero h-carousel" items={1} loop autoplay autoplayTimeout={600} animateIn="fade-in" animateOut="fade-out" dotsData>
      {[1, 2, 3].map((i) => <div key={i} className="slide" data-dot={"<b>" + i + "</b>"}>S{i}</div>)}
    </OwlCarousel>
    <OwlCarousel className="grid" items={3} margin={10} nav dots={false}>
      {[1, 2, 3, 4, 5].map((i) => <div key={i} className="card">C{i}</div>)}
    </OwlCarousel>
    <SlickCarousel className="sk" items={2} loop autoplay autoplayTimeout={500}>
      {[1, 2, 3, 4].map((i) => <div key={i} className="sl">K{i}</div>)}
    </SlickCarousel>
    <RunningLine className="line" activeClass="line--active" contentClassName="content"><span className="word">A</span></RunningLine>
  </div>);
}
createRoot(document.getElementById("root")).render(<App />);
`;
const out = await build({
  stdin: { contents: entry, resolveDir: kit, loader: "tsx" }, bundle: true, write: false, format: "iife", jsx: "automatic",
  nodePaths: [path.join(here, "node_modules")], define: { "process.env.NODE_ENV": '"production"' }, logLevel: "error",
  plugins: [{ name: "next-nav", setup(b) { b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "nav", namespace: "stub" })); b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "export const usePathname = () => '/';", loader: "js" })); } }],
});
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
await p.setContent(`<!doctype html><div id="root"></div><script>${out.outputFiles[0].text}</script>`);
await p.waitForTimeout(300);
try {
  const s1 = await p.evaluate(() => {
    const hero = document.querySelector(".hero");
    return {
      cls: hero.className, stage: !!hero.querySelector(":scope > .owl-stage-outer > .owl-stage"),
      items: hero.querySelectorAll(".owl-item").length, cloned: hero.querySelectorAll(".owl-item.cloned").length,
      active: hero.querySelector(".owl-item.active")?.textContent, dots: hero.querySelectorAll(".owl-dots > div.owl-dot").length,
      dotHtml: hero.querySelector(".owl-dot")?.innerHTML,
      grid: { active: document.querySelectorAll(".grid .owl-item.active").length, w: Math.round(document.querySelector(".grid .owl-item").getBoundingClientRect().width), prevDisabled: document.querySelector(".grid .owl-prev").classList.contains("disabled") },
      slick: { dbg: [...document.querySelectorAll(".sk .slick-slide")].map((x) => x.className + "#" + x.dataset.slickIndex).join(" , "), cls: document.querySelector(".sk").className, track: !!document.querySelector(".sk .slick-list > .slick-track"), cloned: document.querySelectorAll(".sk .slick-cloned").length, active: document.querySelectorAll(".sk .slick-slide.slick-active").length },
      line: { cls: document.querySelector(".line").className, copies: document.querySelectorAll(".line .content").length },
    };
  });
  assert.match(s1.cls, /\bhero h-carousel owl-carousel owl-loaded owl-drag owl-dotted\b/);
  assert.ok(s1.stage, "thiếu owl-stage-outer > owl-stage");
  assert.equal(s1.items, 3 + s1.cloned);
  assert.equal(s1.cloned, 4, "loop items=1 của Owl có 2 bản nhân mỗi đầu");
  assert.equal(s1.active, "S1");
  assert.equal(s1.dots, 3);
  assert.equal(s1.dotHtml, "<b>1</b>");
  assert.equal(s1.grid.active, 3);
  assert.equal(s1.grid.w, Math.round((600 - 20) / 3));
  assert.ok(s1.grid.prevDisabled);
  assert.match(s1.slick.cls, /\bsk slick-initialized slick-slider slick-dotted\b/);
  assert.ok(s1.slick.track);
  assert.equal(s1.slick.cloned, 4);
  assert.equal(s1.slick.active, 2, s1.slick.dbg);
  assert.match(s1.line.cls, /line--active/);
  assert.ok(s1.line.copies >= Math.ceil(1000 / 150) + 2, `dải chữ chạy phải nhân đủ bản, có ${s1.line.copies}`);
  // autoplay + animateIn/Out của Owl
  await p.waitForFunction(() => document.querySelector(".hero .owl-animated-in"), null, { timeout: 2000 });
  const s2 = await p.evaluate(() => ({ inCls: document.querySelector(".hero .owl-animated-in").className, outCls: document.querySelector(".hero .owl-animated-out")?.className }));
  assert.match(s2.inCls, /owl-item.*animated owl-animated-in fade-in/);
  assert.match(s2.outCls ?? "", /animated owl-animated-out fade-out/);
  await p.waitForTimeout(700);
  const s3 = await p.evaluate(() => ({ active: document.querySelector(".hero .owl-item.active").textContent, dot: [...document.querySelectorAll(".hero .owl-dot")].findIndex((d) => d.classList.contains("active")) }));
  assert.notEqual(s3.active, "S1", "autoplay không chuyển slide");
  assert.equal(s3.dot, Number(s3.active.slice(1)) - 1);
  // ecx:freeze đưa về slide đầu và dừng
  await p.evaluate(() => dispatchEvent(new Event("ecx:freeze")));
  await p.waitForTimeout(900);
  assert.equal(await p.evaluate(() => document.querySelector(".hero .owl-item.active").textContent), "S1");
  assert.deepEqual(errors, []);
  console.log("kit-test: ĐẠT");
} finally {
  await b.close();
}
