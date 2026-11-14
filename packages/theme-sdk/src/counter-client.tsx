"use client";

import { useEffect, useRef } from "react";
import { formatCounter } from "@ecomcx/ecomweb-content";

type Data = Record<string, string | number | boolean | undefined>;

/**
 * Số của khối Counter: HTML có sẵn số cuối (không JS / máy tìm kiếm thấy đúng số). Trên trình duyệt: về số đầu rồi đếm lên khi
 * khối vào màn hình (IntersectionObserver, một lần). Người dùng chọn giảm chuyển động hoặc duration = 0 → giữ nguyên số cuối.
 */
export function CounterClient({ className, data, text }: { className?: string; data: Data; text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const start = Number(data["data-start"]) || 0, end = Number(data["data-end"]) || 0, dec = Number(data["data-decimals"]) || 0;
  const sep = data["data-separator"], ms = Number(data["data-duration"]) || 0;
  useEffect(() => {
    const el = ref.current;
    if (!el || ms <= 0 || start === end || typeof IntersectionObserver === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    el.textContent = formatCounter(start, dec, sep);
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / ms);
        el.textContent = formatCounter(start + (end - start) * (1 - (1 - p) ** 3), dec, sep);
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); el.textContent = text; };
  }, [start, end, dec, sep, ms, text]);
  return <span ref={ref} className={className} {...data}>{text}</span>;
}
