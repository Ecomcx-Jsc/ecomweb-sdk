"use client";
/**
 * Tab, accordion, dropdown, menu mobile, popup: mọi thứ "bấm vào thì một phần tử khác được thêm class".
 * Một component, giữ nguyên markup gốc, chỉ đổi class như JS gốc. Đặt một lần trong layout.tsx hoặc trong khối.
 *
 *   <Toggle groups={[
 *     // Tab: bấm tiêu đề thứ i -> tiêu đề i + nội dung i có class active, các cái khác bỏ
 *     { kind: "tabs", root: ".c-ip-product-tabs", trigger: ".c-ip-product-tabs__menu-item", target: ".c-ip-product-tabs__wrap", activeClass: "active" },
 *     // Accordion: bấm tiêu đề -> mục cha của nó bật/tắt class (single: chỉ mở một mục)
 *     { kind: "accordion", root: ".c-ip-accordion", trigger: ".c-ip-accordion__header", item: ".c-ip-accordion__item", activeClass: "active", single: true },
 *     // Mở/đóng: bấm nút -> phần tử đích bật/tắt class; bấm ra ngoài hoặc Esc thì đóng; chuyển trang thì đóng
 *     { kind: "open", trigger: ".js-mobile-menu-open", target: ".c-header__menu", activeClass: "c-header__menu--active", bodyClass: "h-no-scroll", close: ".js-mobile-menu-close" },
 *   ]} />
 *
 * Class, thứ tự, class trên body lấy từ motion.json / DevTools của bản gốc.
 */
import { useEffect } from "react";
import { usePathname } from "next/navigation";

export type ToggleGroup =
  | { kind: "tabs"; root: string; trigger: string; target: string; activeClass: string; targetActiveClass?: string }
  | { kind: "accordion"; root: string; trigger: string; item: string; activeClass: string; single?: boolean }
  | { kind: "open"; trigger: string; target: string; activeClass: string; close?: string; bodyClass?: string; outside?: boolean };

export default function Toggle({ groups }: { groups: ToggleGroup[] }) {
  const pathname = usePathname();
  useEffect(() => {
    const closeAll = () => {
      for (const g of groups) if (g.kind === "open") {
        document.querySelectorAll(g.target).forEach((t) => t.classList.remove(g.activeClass));
        if (g.bodyClass) document.body.classList.remove(g.bodyClass); // class trạng thái, không phải class trang
      }
    };
    const onClick = (e: MouseEvent) => {
      const el = e.target as Element;
      for (const g of groups) {
        if (g.kind === "tabs") {
          const trig = el.closest(g.trigger); const root = trig?.closest(g.root);
          if (!trig || !root) continue;
          e.preventDefault();
          const triggers = [...root.querySelectorAll(g.trigger)], targets = [...root.querySelectorAll(g.target)];
          const i = triggers.indexOf(trig);
          triggers.forEach((t, k) => t.classList.toggle(g.activeClass, k === i));
          targets.forEach((t, k) => t.classList.toggle(g.targetActiveClass ?? g.activeClass, k === i));
        } else if (g.kind === "accordion") {
          const trig = el.closest(g.trigger); const item = trig?.closest(g.item); const root = item?.closest(g.root);
          if (!trig || !item || !root) continue;
          e.preventDefault();
          const open = !item.classList.contains(g.activeClass);
          if (g.single) root.querySelectorAll(g.item).forEach((x) => x.classList.remove(g.activeClass));
          item.classList.toggle(g.activeClass, open);
        } else {
          if (el.closest(g.trigger)) {
            e.preventDefault();
            const on = !document.querySelector(g.target)?.classList.contains(g.activeClass);
            document.querySelectorAll(g.target).forEach((t) => t.classList.toggle(g.activeClass, on));
            if (g.bodyClass) document.body.classList.toggle(g.bodyClass, on);
          } else if ((g.close && el.closest(g.close)) || (g.outside !== false && !el.closest(g.target) && document.querySelector(`${g.target}.${g.activeClass}`))) {
            document.querySelectorAll(g.target).forEach((t) => t.classList.remove(g.activeClass));
            if (g.bodyClass) document.body.classList.remove(g.bodyClass);
          }
        }
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeAll(); };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    closeAll();
    return () => { document.removeEventListener("click", onClick); document.removeEventListener("keydown", onKey); };
  }, [groups, pathname]);
  return null;
}
