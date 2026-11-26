// Hàm dùng chung cho các script của skill.
import fs from "node:fs";
import path from "node:path";

export const WIDTHS = [1920, 1440, 390];

/** Đọc tham số dạng `--key value` / `--flag`; phần còn lại là tham số vị trí. */
export function args(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[k] = true;
      else { out[k] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

export function widths(v) {
  return typeof v === "string" ? v.split(",").map(Number).filter((n) => n > 0) : WIDTHS;
}

export function die(msg) {
  console.error(`LỖI: ${msg}`);
  process.exit(2);
}

export const mkdir = (d) => fs.mkdirSync(d, { recursive: true });
export const writeJson = (f, v) => { mkdir(path.dirname(f)); fs.writeFileSync(f, JSON.stringify(v, null, 2)); };
export const readJson = (f) => JSON.parse(fs.readFileSync(f, "utf8"));

/** Mở Chromium của Playwright; báo cách cài nếu thiếu. */
export async function browser() {
  let pw;
  try { pw = await import("playwright"); } catch { die("chưa cài Playwright. Chạy: cd <thư mục scripts> && npm install && npm run setup"); }
  try { return await pw.chromium.launch(); } catch (e) { die(`không mở được Chromium (${e.message.split("\n")[0]}). Chạy: npm run setup`); }
}

/** Cuộn hết trang từng đoạn để lazyload, hiệu ứng cuộn, ảnh nền chạy; rồi quay lên đầu. */
export async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = Math.max(200, Math.floor(window.innerHeight * 0.7));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((r) => setTimeout(r, 400));
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 300));
  });
}

/**
 * Thao tác thật như người dùng: rê chuột, lăn chuột, chạm, nhấn phím. Nhiều theme (WP Rocket, Perfmatters, theme bán sẵn)
 * HOÃN toàn bộ JS tới lần thao tác đầu tiên; thiếu bước này thì bản chụp gốc là trạng thái slider/menu CHƯA khởi tạo.
 */
export async function interact(page) {
  const vp = page.viewportSize() ?? { width: 1280, height: 800 };
  await page.mouse.move(vp.width / 3, vp.height / 3);
  await page.mouse.move(vp.width / 2, vp.height / 2, { steps: 5 });
  await page.mouse.wheel(0, 120);
  await page.keyboard.press("Shift").catch(() => {});
  await page.evaluate(() => { for (const t of ["touchstart", "mousemove", "keydown", "scroll"]) window.dispatchEvent(new Event(t)); });
  await page.waitForTimeout(800);
  await page.mouse.wheel(0, -120);
  await page.waitForTimeout(400);
}

/** Đợi các carousel phổ biến khởi tạo xong (tối đa ms). Trả số carousel thấy được. */
export async function waitCarousels(page, ms = 4000) {
  const sel = ".owl-carousel, .slick-slider, .swiper, .swiper-container, .flexslider, .splide, .glide, .flickity-enabled, .owl-loaded, .slick-initialized";
  const t0 = Date.now();
  let last = -1;
  while (Date.now() - t0 < ms) {
    const n = await page.evaluate((s) => ({ all: document.querySelectorAll(s).length, ready: document.querySelectorAll(".owl-loaded, .slick-initialized, .swiper-initialized, .flexslider .flex-viewport, .splide.is-initialized, .flickity-enabled").length }), sel);
    if (n.all === 0 || (n.ready > 0 && n.ready === last)) return n.ready;
    last = n.ready;
    await page.waitForTimeout(500);
  }
  return last;
}

/**
 * Đưa mọi carousel về slide đầu và dừng autoplay, ở cả bản gốc (Owl/Slick/Swiper/Flexslider) lẫn bản theme (kit phát "ecx:freeze").
 * Nhờ vậy hai ảnh chụp so được với nhau; chuyển động thật được đo riêng bằng motion.mjs.
 */
export async function freezeCarousels(page) {
  await page.evaluate(() => {
    const $ = window.jQuery;
    try { if ($?.fn?.owlCarousel) $(".owl-carousel").each(function () { $(this).trigger("stop.owl.autoplay").trigger("to.owl.carousel", [0, 0]); }); } catch {}
    try { if ($?.fn?.slick) $(".slick-initialized").each(function () { $(this).slick("slickPause"); $(this).slick("slickGoTo", 0, true); }); } catch {}
    try { if ($?.fn?.flexslider) $(".flexslider").each(function () { const f = $(this).data("flexslider"); f?.pause(); f?.flexAnimate(0, true); }); } catch {}
    document.querySelectorAll(".swiper, .swiper-container").forEach((el) => { const sw = el.swiper; try { sw?.autoplay?.stop(); sw?.slideTo(sw.params?.loop ? sw.loopedSlides ?? 0 : 0, 0); } catch {} });
    window.dispatchEvent(new Event("ecx:freeze"));
  });
  await page.waitForTimeout(700);
}

/** Tắt animation/transition và con trỏ nháy để ảnh chụp ổn định giữa 2 lần. */
export const FREEZE_CSS = `*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important;caret-color:transparent!important}`;

/** Tên file an toàn từ đường dẫn URL: "/san-pham/ao" -> "san-pham__ao", "/" -> "home". */
export function slugOf(u) {
  const p = new URL(u).pathname.replace(/\/+$/, "");
  return (p.replace(/^\/+/, "").replace(/[^a-z0-9._-]+/gi, "__") || "home").slice(0, 80);
}
