"use client";
/**
 * Dải chữ chạy (marquee) kiểu theme WordPress: JS gốc nhân phần nội dung cho tới khi phủ kín bề rộng
 * (số bản = ceil(bề rộng dải / bề rộng một bản) + 2), rồi gắn class "đang chạy" để CSS gốc (keyframes của theme) chạy từng bản.
 *
 * Dùng:
 *   <RunningLine className="c-ip-running-line js-ip-running-line" activeClass="c-ip-running-line--active"
 *     contentClassName="c-ip-running-line__content">
 *     {items.map(...)}   // markup của MỘT bản nội dung, đúng như bản gốc
 *   </RunningLine>
 *
 * Không tự viết keyframes: chuyển động là CSS gốc. Nếu bản gốc tạo thêm bản bằng cách clone cả dải (không chỉ nội dung),
 * đặt cloneWhole để nhân cả phần tử ngoài.
 */
import { useLayoutEffect, useRef, useState } from "react";
import type { ElementType, ReactNode } from "react";

type Props = {
  as?: ElementType;
  className?: string;
  /** Class JS gốc gắn khi bắt đầu chạy (để CSS gốc bật animation). */
  activeClass?: string;
  /** Class của một bản nội dung (phần được nhân). */
  contentClassName: string;
  contentAs?: ElementType;
  /** Số bản tối thiểu (mặc định 2). */
  min?: number;
  /** Cộng thêm vào số bản tính được (công thức gốc thường +2). */
  extra?: number;
  attrs?: Record<string, string | number | boolean | undefined>;
  children: ReactNode;
};

export default function RunningLine({ as: Tag = "div", className, activeClass, contentClassName, contentAs: Content = "div", min = 2, extra = 2, attrs, children }: Props) {
  const line = useRef<HTMLElement>(null);
  const [copies, setCopies] = useState(min);
  const [active, setActive] = useState(false);
  useLayoutEffect(() => {
    const el = line.current;
    if (!el) return;
    const measure = () => {
      const first = el.querySelector<HTMLElement>(`.${contentClassName.split(" ")[0]}`);
      const w = first?.offsetWidth ?? 0;
      if (w > 0) setCopies(Math.max(min, Math.ceil(el.clientWidth / w) + extra));
      setActive(true);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [contentClassName, min, extra]);
  return (
    <Tag ref={line} {...attrs} className={[className, active && activeClass].filter(Boolean).join(" ")}>
      {Array.from({ length: copies }, (_, i) => (
        <Content key={i} className={contentClassName} aria-hidden={i > 0 ? "true" : undefined}>{children}</Content>
      ))}
    </Tag>
  );
}
