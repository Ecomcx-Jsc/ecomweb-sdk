"use client";
/**
 * Hiệu ứng xuất hiện khi cuộn tới, theo đúng class mà JS gốc gắn. Đặt MỘT lần trong layout.tsx: <Reveal />.
 * Hỗ trợ cùng lúc:
 *   - Elementor:  .elementor-invisible + data-settings {"_animation"|"animation", "_animation_tablet", "_animation_mobile", "_animation_delay"}
 *                 → gỡ elementor-invisible, thêm "animated <tên>"
 *   - AOS:        [data-aos] → "aos-init" ngay, "aos-animate" khi tới (data-aos-delay, data-aos-once)
 *   - WOW.js:     .wow (data-wow-delay, data-wow-duration) → "animated", style visibility/animation-name
 *   - Tuỳ biến:   [data-reveal='{"animation":"fadeInUp","delay":200}'] + class .ecx-reveal (kiểu kidstore)
 * Chạy lại khi chuyển trang (theo pathname) và khi DOM thêm phần tử mới. Tôn trọng prefers-reduced-motion.
 * Breakpoint Elementor mặc định: mobile ≤ 767, tablet ≤ 1024 (đổi bằng prop nếu kit của site khác).
 */
import { useEffect } from "react";
import { usePathname } from "next/navigation";

type Props = { mobile?: number; tablet?: number; rootMargin?: string };

export default function Reveal({ mobile = 767, tablet = 1024, rootMargin = "0px 0px -10% 0px" }: Props) {
  const pathname = usePathname();
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const device = () => (innerWidth <= mobile ? "_mobile" : innerWidth <= tablet ? "_tablet" : "");
    const pick = (o: Record<string, unknown>, key: string) => {
      const d = device();
      const order = d === "_mobile" ? ["_mobile", "_tablet", ""] : d === "_tablet" ? ["_tablet", ""] : [""];
      for (const suf of order) { const v = o[key + suf]; if (v) return String(v); }
      return "";
    };
    const json = (s?: string | null) => { try { return JSON.parse(s || "{}") as Record<string, unknown>; } catch { return {}; } };
    const show = (el: HTMLElement) => {
      if (el.classList.contains("elementor-invisible") || el.dataset.settings) {
        const st = json(el.dataset.settings);
        const name = pick(st, "_animation") || pick(st, "animation");
        const delay = Number(st._animation_delay ?? st.animation_delay ?? 0);
        const run = () => { el.classList.remove("elementor-invisible"); if (name && name !== "none" && !reduce) el.classList.add("animated", name); };
        delay ? setTimeout(run, delay) : run();
      } else if (el.hasAttribute("data-aos")) {
        const delay = Number(el.dataset.aosDelay || 0);
        setTimeout(() => el.classList.add("aos-animate"), reduce ? 0 : delay);
      } else if (el.classList.contains("wow")) {
        const name = [...el.classList].find((c) => c !== "wow" && c !== "animated" && /^[a-z]+[A-Z]/.test(c)) || "";
        el.style.visibility = "visible";
        if (el.dataset.wowDelay) el.style.animationDelay = el.dataset.wowDelay;
        if (el.dataset.wowDuration) el.style.animationDuration = el.dataset.wowDuration;
        if (!reduce) { el.style.animationName = name; el.classList.add("animated"); }
      } else if (el.dataset.reveal) {
        const st = json(el.dataset.reveal);
        const name = pick(st, "animation");
        setTimeout(() => { el.classList.remove("ecx-reveal"); if (name && !reduce) el.classList.add("animated", name); }, Number(st.delay) || 0);
      }
    };
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); show(e.target as HTMLElement); }
    }, { rootMargin, threshold: 0 });
    const seen = new WeakSet<Element>();
    const scan = () => {
      document.querySelectorAll<HTMLElement>(".elementor-invisible, [data-aos]:not(.aos-animate), .wow:not(.animated), .ecx-reveal[data-reveal]").forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        if (el.hasAttribute("data-aos")) el.classList.add("aos-init");
        if (el.classList.contains("wow")) el.style.visibility = "hidden";
        io.observe(el);
      });
    };
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, [pathname, mobile, tablet, rootMargin]);
  return null;
}
