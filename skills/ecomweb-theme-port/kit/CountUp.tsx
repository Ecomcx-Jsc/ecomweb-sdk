"use client";
/**
 * Bộ đếm số (Elementor counter, jQuery countTo, odometer…): đếm từ `from` tới `to` khi cuộn tới.
 * Giữ class/thẻ gốc bên ngoài; component này chỉ là phần số. Thời lượng lấy từ data-duration của bản gốc.
 *   <span className="elementor-counter-number" ><CountUp to={250} duration={2000} /></span>
 */
import { useEffect, useRef, useState } from "react";

export default function CountUp({ to, from = 0, duration = 2000, delimiter = "", decimals = 0 }: { to: number | string; from?: number; duration?: number; delimiter?: string; decimals?: number }) {
  const target = typeof to === "number" ? to : Number(String(to).replace(/[^\d.-]/g, "")) || 0;
  const [v, setV] = useState(from);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(target); return; }
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / duration);
        setV(from + (target - from) * (1 - Math.pow(1 - k, 3)));
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [target, from, duration]);
  const text = v.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, delimiter);
  return <span ref={ref}>{text}</span>;
}
