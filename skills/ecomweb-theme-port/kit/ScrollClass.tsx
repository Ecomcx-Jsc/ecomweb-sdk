"use client";
/**
 * Gắn/gỡ class theo vị trí cuộn, đúng như JS gốc của header dính, nút lên đầu trang, thanh thông báo ẩn khi cuộn…
 * Mỗi luật: phần tử nào, cuộn quá bao nhiêu px, thêm những class nào (theo thứ tự và độ trễ như bản gốc).
 *
 *   <ScrollClass rules={[
 *     { selector: ".c-header", offset: 200, steps: [{ add: "c-header--transition" }, { add: "c-header--sticky", delay: 10 }, { add: "c-header--active", delay: 300 }] },
 *     { selector: ".c-to-top-button", offset: 500, steps: [{ add: "c-to-top-button--active" }] },
 *   ]} />
 *
 * Lấy offset, class và độ trễ từ motion.json của bản gốc (mục "scroll"), không đoán.
 * Cuộn ngược lên dưới offset thì gỡ các class theo thứ tự ngược lại.
 */
import { useEffect } from "react";
import { usePathname } from "next/navigation";

export type ScrollRule = {
  selector: string;
  offset: number;
  steps: Array<{ add: string; delay?: number }>;
  /** Giảm offset khi ở mobile (bản gốc hay có offset khác theo thiết bị). */
  mobileOffset?: number;
  mobileMax?: number;
};

export default function ScrollClass({ rules }: { rules: ScrollRule[] }) {
  const pathname = usePathname();
  useEffect(() => {
    const state = new Map<ScrollRule, { on: boolean; timers: ReturnType<typeof setTimeout>[] }>();
    const tick = () => {
      for (const r of rules) {
        const els = document.querySelectorAll<HTMLElement>(r.selector);
        if (!els.length) continue;
        const off = r.mobileOffset !== undefined && innerWidth <= (r.mobileMax ?? 767) ? r.mobileOffset : r.offset;
        const want = scrollY > off;
        const st = state.get(r) ?? { on: false, timers: [] };
        if (want === st.on) continue;
        st.timers.forEach(clearTimeout);
        st.timers = [];
        st.on = want;
        const steps = want ? r.steps : [...r.steps].reverse();
        let t = 0;
        for (const s of steps) {
          t += want ? s.delay ?? 0 : 0;
          const apply = () => els.forEach((el) => el.classList.toggle(s.add, want));
          t ? st.timers.push(setTimeout(apply, t)) : apply();
        }
        state.set(r, st);
      }
    };
    tick();
    addEventListener("scroll", tick, { passive: true });
    addEventListener("resize", tick);
    return () => { removeEventListener("scroll", tick); removeEventListener("resize", tick); state.forEach((s) => s.timers.forEach(clearTimeout)); };
  }, [rules, pathname]);
  return null;
}
