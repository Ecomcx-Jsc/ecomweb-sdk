#!/usr/bin/env node
// Đo CHUYỂN ĐỘNG của một trang (thứ mà ảnh chụp tĩnh không thấy) rồi so bản gốc với bản theme.
//
//   node motion.mjs record <url> <ra.json> [--width 1440] [--seconds 12]
//   node motion.mjs compare <gốc.json> <theme.json> [--out report.md] [--tolerance 0.15]
//
// record ghi lại, theo từng "khối" (khoá = class gốc ổn định của phần tử, nên bản theme PHẢI giữ class gốc):
//   - class được JS thêm/gỡ trong 4 pha: load (gồm rê chuột đầu tiên), idle (đứng yên N giây: autoplay), scroll (cuộn hết trang), hover
//   - chu kỳ autoplay: khoảng thời gian giữa các lần một slide mới nhận class active/current
//   - animation / transition đang chạy: tên keyframes, thời lượng, easing, số lần lặp, số bản chạy cùng lúc (dải chữ chạy)
//   - header dính, nút lên đầu: class nào thêm ở scrollY bao nhiêu
//   - rê chuột lên thẻ sản phẩm, nút, menu, ảnh: class thêm, style đổi, animation chạy
// compare: liệt kê thứ bản theme thiếu/sai. Mã thoát 0 = đạt, 1 = chưa đạt.
import fs from "node:fs";
import path from "node:path";
import { args, browser, die, interact, readJson, writeJson } from "./lib.mjs";

const a = args();
const mode = a._[0];

// Class trạng thái (đổi theo thời gian) — không dùng làm khoá.
const STATE = /^(active|current|cloned|center|animated|show|showing|open|opened|in|out|visible|hidden|hover|focus|selected|disabled|loading|loaded|initialized|init|ready|done|sticky|fixed|is-.+|has-.+|js-.+|owl-(item|animated-in|animated-out|grab|refresh|loading|drag|loaded)|slick-(active|current|cloned|center|slide|initialized)|swiper-slide-.+|aos-(init|animate)|elementor-invisible|e-lazyloaded|lazyloaded|lazyload|.+--(active|open|opened|sticky|visible|hidden|init|ready|transition|loaded|show|fixed|hover|current|disabled|animate|animated)|.+-(in|out)|[a-z]+(In|Out)[A-Za-z]*)$/;
// Khung của bản theme / trình duyệt — bỏ qua.
const NOISE = /nextjs|__next|cms-admin|admin-bar|ecx-admin|data-nextjs|grecaptcha|cf-turnstile|ym-|yandex|tawk|fb_|intercom|^e--ua-|^ecx-js$|^js$|^no-js$/;

if (mode === "record") await record();
else if (mode === "compare") compare();
else die("cách dùng: node motion.mjs record <url> <ra.json> [--width 1440] [--seconds 12]  |  node motion.mjs compare <gốc.json> <theme.json>");

async function record() {
  const [, url, out] = a._;
  if (!url || !out) die("thiếu <url> hoặc <ra.json>");
  const width = Number(a.width) || 1440, seconds = Number(a.seconds) || 12;
  const b = await browser();
  const page = await b.newPage({ viewport: { width, height: 900 } });
  await page.addInitScript(({ stateSrc, noiseSrc }) => {
    const STATE = new RegExp(stateSrc), NOISE = new RegExp(noiseSrc);
    const ROOT = /carousel|slider|swiper|slick|owl-carousel|running-line|marquee|ticker|tabs|accordion|toggle|header|menu|nav|popup|modal|drawer|countdown|counter|banner|hero|sticky|to-top|back-to-top|product|card|gallery|lookbook/i;
    // Class gốc dùng làm khoá: bỏ class trạng thái, class của kit (ecx-*), id Elementor, và class vừa đổi trong lần thay đổi này.
    const stable = (el, skip = []) => [...(el.classList || [])].filter((c) => !skip.includes(c) && !STATE.test(c) && !/^(ecx-|elementor-element-[0-9a-f]+$|elementor-repeater-item)/.test(c));
    const keyOf = (el, skip = []) => {
      if (!el || !el.tagName) return "?";
      let comp = el, own = stable(el, skip)[0] ?? "";
      for (let p = el; p && p !== document.body; p = p.parentElement) { const st = stable(p); if (st.some((c) => ROOT.test(c))) { comp = p; break; } }
      const compKey = stable(comp).find((c) => ROOT.test(c)) ?? stable(comp)[0] ?? comp.tagName.toLowerCase();
      return comp === el ? `${el.tagName.toLowerCase()}.${compKey}` : `.${compKey} ${el.tagName.toLowerCase()}${own ? "." + own : ""}`;
    };
    window.__motion = { t0: performance.now(), phase: "load", events: [], keyOf };
    const start = () => new MutationObserver((ms) => {
      for (const m of ms) {
        const el = m.target;
        if (m.attributeName !== "class" || !el.classList) continue;
        if (NOISE.test(el.className?.toString?.() ?? "") || el.closest?.("nextjs-portal")) continue;
        const o = (m.oldValue || "").split(/\s+/).filter(Boolean), n = [...el.classList];
        const add = n.filter((c) => !o.includes(c) && !NOISE.test(c)), rm = o.filter((c) => !n.includes(c) && !NOISE.test(c));
        if (!add.length && !rm.length) continue;
        const idx = el.parentElement ? [...el.parentElement.children].indexOf(el) : 0;
        window.__motion.events.push({ t: Math.round(performance.now() - window.__motion.t0), phase: window.__motion.phase, key: keyOf(el, [...add, ...rm]), idx, add, rm, y: Math.round(scrollY) });
      }
    }).observe(document.documentElement, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ["class"] });
    document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start) : start();
  }, { stateSrc: STATE.source, noiseSrc: NOISE.source });

  try { await page.goto(url, { waitUntil: "networkidle", timeout: 60000 }); } catch { await page.goto(url, { waitUntil: "load", timeout: 60000 }); }
  await page.waitForTimeout(1200);
  await interact(page);
  // Chuột ra mép phải để không đè lên slider (nhiều slider dừng autoplay khi rê chuột)
  await page.mouse.move(width - 3, 450);
  const anims = new Map();
  const sample = async (phase) => {
    const list = await page.evaluate((noiseSrc) => {
      const NOISE = new RegExp(noiseSrc);
      return document.getAnimations().map((an) => {
        const el = an.effect?.target;
        if (!el || !el.tagName || NOISE.test(el.className?.baseVal ?? el.className ?? "")) return null;
        const tm = an.effect.getTiming();
        return { key: window.__motion.keyOf(el), name: an.animationName || (an.transitionProperty ? `transition:${an.transitionProperty}` : an.constructor.name), dur: Math.round(Number(tm.duration) || 0), easing: tm.easing, iter: tm.iterations === Infinity ? "infinite" : tm.iterations, delay: Math.round(tm.delay || 0) };
      }).filter(Boolean);
    }, NOISE.source);
    const counts = {};
    for (const x of list) {
      const k = `${x.key}|${x.name}`;
      counts[k] = (counts[k] || 0) + 1;
      const prev = anims.get(k);
      anims.set(k, { ...x, phases: [...new Set([...(prev?.phases ?? []), phase])], copies: Math.max(prev?.copies ?? 0, counts[k]) });
    }
  };
  const phase = (p) => page.evaluate((x) => { window.__motion.phase = x; }, p);

  await phase("idle");
  for (let t = 0; t < seconds * 1000; t += 500) { await sample("idle"); await page.waitForTimeout(500); }

  await phase("scroll");
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H; y += 250) { await page.mouse.wheel(0, 250); await page.waitForTimeout(120); if (y % 1000 === 0) await sample("scroll"); }
  await page.waitForTimeout(800);
  await sample("scroll");
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(800);

  await phase("hover");
  const HOVER = [
    ["thẻ sản phẩm", ".product, .c-product-grid__item, [class*=product-item], [class*=product-card], .card"],
    ["ảnh sản phẩm", ".product img, [class*=product] img, .card img"],
    ["nút", ".button, .btn, .c-button, button[type=submit], [class*=btn-]"],
    ["menu có menu con", ".menu-item-has-children, li.dropdown, [class*=has-children], [class*=has-submenu]"],
    ["link menu", "nav a, .menu a, [class*=menu] a"],
    ["icon giỏ/yêu thích", "[class*=cart] a, [class*=wishlist] a, [class*=header] [class*=icon]"],
  ];
  const hovers = [];
  for (const [label, sel] of HOVER) {
    const target = await page.evaluateHandle((s) => [...document.querySelectorAll(s)].find((el) => { const r = el.getBoundingClientRect(); return r.width > 20 && r.height > 10 && getComputedStyle(el).visibility !== "hidden"; }) ?? null, sel);
    const el = target.asElement();
    if (!el) continue;
    await el.scrollIntoViewIfNeeded().catch(() => {});
    await page.mouse.move(2, 2);
    await page.waitForTimeout(300);
    const before = await el.evaluate((n) => { const cs = getComputedStyle(n); const img = n.querySelector("img"); const ci = img ? getComputedStyle(img) : null;
      return { key: window.__motion.keyOf(n), s: { transform: cs.transform, opacity: cs.opacity, color: cs.color, bg: cs.backgroundColor, shadow: cs.boxShadow, border: cs.borderColor, imgTransform: ci?.transform, imgOpacity: ci?.opacity }, n: window.__motion.events.length }; });
    const box = await el.boundingBox();
    if (!box) continue;
    await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 60), { steps: 4 });
    await page.waitForTimeout(700);
    const after = await el.evaluate((n, from) => { const cs = getComputedStyle(n); const img = n.querySelector("img"); const ci = img ? getComputedStyle(img) : null;
      return { s: { transform: cs.transform, opacity: cs.opacity, color: cs.color, bg: cs.backgroundColor, shadow: cs.boxShadow, border: cs.borderColor, imgTransform: ci?.transform, imgOpacity: ci?.opacity },
        classes: window.__motion.events.slice(from).flatMap((e) => e.add.map((c) => `${e.key} +${c}`)), transition: cs.transition.slice(0, 160) }; }, before.n);
    const changed = Object.keys(before.s).filter((k) => before.s[k] !== after.s[k]);
    hovers.push({ label, key: before.key, changed, classes: [...new Set(after.classes)].slice(0, 20), transition: after.transition });
    await sample("hover");
  }
  await page.mouse.move(2, 2);

  const events = await page.evaluate(() => window.__motion.events);
  // Class đang có trên trang lúc cuối, theo khoá (bản theme render sẵn class từ server thì không có "sự kiện thêm class")
  const present = await page.evaluate(() => {
    const out = {};
    for (const el of document.body.querySelectorAll("*")) {
      if (!el.classList?.length) continue;
      const k = window.__motion.keyOf(el);
      (out[k] ??= new Set());
      el.classList.forEach((c) => out[k].add(c));
    }
    return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v]]));
  });
  await b.close();

  // Tổng hợp theo khoá
  const blocks = {};
  for (const e of events) {
    const bl = (blocks[e.key] ??= { added: {}, removed: {}, phases: [] });
    for (const c of e.add) (bl.added[c] ??= []).push(e.phase);
    for (const c of e.rm) (bl.removed[c] ??= []).push(e.phase);
    if (!bl.phases.includes(e.phase)) bl.phases.push(e.phase);
  }
  for (const bl of Object.values(blocks)) {
    for (const m of [bl.added, bl.removed]) for (const c of Object.keys(m)) m[c] = [...new Set(m[c])];
  }
  // Chu kỳ autoplay: trong pha idle, các lần một phần tử mới nhận class active|current (gộp theo khoá cha)
  const cycles = {};
  const acts = events.filter((e) => e.phase === "idle" && e.add.some((c) => /^(active|slick-current|swiper-slide-active|.+--active|is-active|current)$/.test(c)));
  const byKey = {};
  for (const e of acts) (byKey[e.key] ??= []).push(e.t);
  for (const [k, ts] of Object.entries(byKey)) {
    const uniq = [...new Set(ts.map((t) => Math.round(t / 50) * 50))].sort((x, y) => x - y);
    const gaps = uniq.slice(1).map((t, i) => t - uniq[i]).filter((g) => g > 400);
    if (gaps.length >= 1) cycles[k] = { intervalMs: gaps.sort((x, y) => x - y)[Math.floor(gaps.length / 2)], changes: uniq.length };
  }
  // Theo cuộn: class nào thêm ở scrollY nào (bỏ những thay đổi đã xảy ra khi đứng yên: đó là autoplay, không phải do cuộn)
  const idleSet = new Set(events.filter((x) => x.phase === "idle").flatMap((e) => e.add.map((c) => `${e.key} +${c}`)));
  const scroll = {};
  for (const e of events.filter((x) => x.phase === "scroll")) for (const c of e.add) { const k = `${e.key} +${c}`; if (!(k in scroll) && !idleSet.has(k)) scroll[k] = e.y; }
  for (const h of hovers) h.classes = h.classes.filter((c) => !idleSet.has(c));
  const result = { url, width, seconds, recordedAt: new Date().toISOString(), blocks, present, cycles, animations: [...anims.values()], scroll, hovers, eventCount: events.length };
  writeJson(out, result);
  console.log(`đã ghi ${out}: ${Object.keys(blocks).length} khối có đổi class, ${Object.keys(cycles).length} chu kỳ autoplay, ${result.animations.length} animation/transition, ${Object.keys(scroll).length} hiệu ứng theo cuộn, ${hovers.length} phép thử rê chuột`);
  for (const [k, c] of Object.entries(cycles)) console.log(`  autoplay ${k}: ${c.intervalMs}ms`);
}

function compare() {
  const [, fa, fb] = a._;
  if (!fa || !fb) die("thiếu <gốc.json> <theme.json>");
  const A = readJson(fa), B = readJson(fb);
  const tol = Number(a.tolerance ?? 0.15);
  const errs = [], warns = [];
  const near = (x, y) => Math.abs(x - y) <= Math.max(60, x * tol);

  // 1. Vòng đời class
  for (const [k, bl] of Object.entries(A.blocks)) {
    const other = B.blocks[k];
    const has = (c) => (other && c in other.added) || (B.present?.[k] ?? []).includes(c);
    const gained = Object.keys(bl.added);
    if (!other && gained.every(has)) continue;
    if (!other) {
      if (gained.length) errs.push(`[thiếu hành vi] \`${k}\`: bản gốc JS gắn ${fmt(gained)} (${bl.phases.join(", ")}), bản theme không đổi class nào ở khối này (khối thiếu, đổi class gốc, hoặc hành vi chưa làm)`);
      continue;
    }
    const miss = gained.filter((c) => !has(c));
    if (miss.length) errs.push(`[thiếu class] \`${k}\`: bản gốc gắn ${fmt(miss)} lúc ${[...new Set(miss.flatMap((c) => bl.added[c]))].join("/")}, bản theme không gắn`);
  }
  for (const [k, bl] of Object.entries(B.blocks)) {
    const invented = Object.keys(bl.added).filter((c) => !A.blocks[k]?.added[c] && !Object.values(A.blocks).some((x) => c in x.added));
    if (invented.length) warns.push(`[class tự chế] \`${k}\`: bản theme gắn ${fmt(invented)} mà bản gốc không có. CSS gốc không biết class này; dùng class gốc`);
  }
  // 2. Autoplay
  for (const [k, c] of Object.entries(A.cycles)) {
    const o = B.cycles[k];
    if (!o) errs.push(`[autoplay] \`${k}\`: bản gốc tự chuyển mỗi ${c.intervalMs}ms, bản theme không tự chuyển`);
    else if (!near(c.intervalMs, o.intervalMs)) errs.push(`[autoplay] \`${k}\`: gốc ${c.intervalMs}ms, theme ${o.intervalMs}ms`);
  }
  // 3. Animation / transition
  const idx = (list) => Object.fromEntries(list.map((x) => [`${x.key}|${x.name}`, x]));
  const IA = idx(A.animations), IB = idx(B.animations);
  for (const [k, x] of Object.entries(IA)) {
    const y = IB[k] ?? B.animations.find((z) => z.name === x.name);
    if (!y) { (x.name.startsWith("transition:") ? warns : errs).push(`[animation] \`${x.key}\` chạy \`${x.name}\` ${x.dur}ms (${x.phases.join(", ")}), bản theme không có`); continue; }
    if (!near(x.dur, y.dur)) errs.push(`[thời lượng] \`${x.key}\` \`${x.name}\`: gốc ${x.dur}ms, theme ${y.dur}ms`);
    if (x.easing !== y.easing && !x.name.startsWith("transition:")) warns.push(`[easing] \`${x.key}\` \`${x.name}\`: gốc ${x.easing}, theme ${y.easing}`);
    if (x.iter === "infinite" && x.copies !== y.copies) errs.push(`[số bản] \`${x.key}\` \`${x.name}\`: gốc ${x.copies} bản chạy cùng lúc, theme ${y.copies} (dải chữ chạy phải nhân đủ bản như JS gốc: dùng kit/RunningLine)`);
  }
  for (const [k, y] of Object.entries(IB)) if (!IA[k] && !A.animations.some((z) => z.name === y.name) && !y.name.startsWith("transition:")) warns.push(`[animation tự chế] \`${y.key}\` chạy \`${y.name}\` mà bản gốc không có`);
  // 4. Theo cuộn
  for (const [k, y] of Object.entries(A.scroll)) {
    if (!(k in B.scroll)) errs.push(`[cuộn] ${k} ở scrollY≈${y}px: bản theme không có`);
    else if (Math.abs(B.scroll[k] - y) > 150) warns.push(`[cuộn] ${k}: gốc ở ${y}px, theme ở ${B.scroll[k]}px`);
  }
  // 5. Rê chuột
  for (const h of A.hovers) {
    const o = B.hovers.find((x) => x.label === h.label);
    if (!o) { if (h.changed.length || h.classes.length) warns.push(`[rê chuột] ${h.label} (\`${h.key}\`): bản theme không tìm thấy phần tử tương ứng`); continue; }
    const missStyle = h.changed.filter((s) => !o.changed.includes(s));
    const missCls = h.classes.filter((c) => !o.classes.includes(c));
    if (missStyle.length) errs.push(`[rê chuột] ${h.label} (\`${h.key}\`): bản gốc đổi ${missStyle.join(", ")}, bản theme không đổi (transition gốc: ${h.transition})`);
    if (missCls.length) errs.push(`[rê chuột] ${h.label}: bản gốc gắn ${missCls.slice(0, 6).join(", ")}, bản theme không gắn`);
  }
  const pass = errs.length === 0;
  let md = `# Chuyển động: ${pass ? "ĐẠT" : "CHƯA ĐẠT"}\n\nGốc: ${A.url}\nTheme: ${B.url}\nĐộ rộng: ${A.width}px, đứng yên ${A.seconds}s. Sai số thời gian cho phép: ${Math.round(tol * 100)}% (tối thiểu 60ms).\n\n`;
  md += errs.length ? `## Phải sửa (${errs.length})\n${errs.map((e) => `- ${e}`).join("\n")}\n\n` : "";
  md += warns.length ? `## Cần xem (${warns.length})\n${warns.map((e) => `- ${e}`).join("\n")}\n\n` : "";
  md += `## Thông số bản gốc (dùng làm props cho kit)\n`;
  for (const [k, c] of Object.entries(A.cycles)) md += `- autoplay \`${k}\`: ${c.intervalMs}ms\n`;
  for (const x of A.animations.filter((x) => !x.name.startsWith("transition:"))) md += `- animation \`${x.key}\` \`${x.name}\` ${x.dur}ms ${x.easing} lặp ${x.iter}${x.copies > 1 ? `, ${x.copies} bản` : ""}\n`;
  for (const [k, y] of Object.entries(A.scroll)) md += `- cuộn ${k} ở ${y}px\n`;
  const out = typeof a.out === "string" ? a.out : path.join(path.dirname(fb), "motion-report.md");
  fs.writeFileSync(out, md);
  console.log(md);
  console.log(`báo cáo: ${out}`);
  process.exit(pass ? 0 : 1);
}

function fmt(list) { return list.slice(0, 8).map((c) => `\`${c}\``).join(", ") + (list.length > 8 ? ` …(+${list.length - 8})` : ""); }
