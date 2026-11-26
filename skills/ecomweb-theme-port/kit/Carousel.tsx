"use client";
/**
 * Carousel tương thích Owl Carousel 2 và Slick, KHÔNG cần jQuery.
 * Sinh đúng cây thẻ + vòng đời class mà thư viện gốc gắn sau khi khởi tạo, để CSS gốc của theme áp nguyên vẹn:
 *
 *   Owl:   <X class="... owl-carousel owl-loaded owl-drag [owl-dotted]">
 *            <div class="owl-stage-outer"><div class="owl-stage" style="transform;transition;width">
 *              <div class="owl-item [cloned] [active] [center]" style="width;margin-right">…</div>
 *            </div></div>
 *            <div class="owl-nav [disabled]"><button class="owl-prev [disabled]">…</button><button class="owl-next">…</button></div>
 *            <div class="owl-dots [disabled]"><button class="owl-dot [active]"><span></span></button>…</div>
 *          slide 1 item + animateIn/animateOut: "animated owl-animated-in <animateIn>" / "animated owl-animated-out <animateOut>"
 *
 *   Slick: <X class="... slick-initialized slick-slider [slick-dotted]">
 *            <button class="slick-prev slick-arrow [slick-disabled]">Previous</button>
 *            <div class="slick-list draggable"><div class="slick-track" style="opacity:1;width;transform">
 *              <div class="slick-slide [slick-cloned] [slick-active] [slick-current]" data-slick-index="i">…</div>
 *            </div></div>
 *            <button class="slick-next slick-arrow">Next</button>
 *            <ul class="slick-dots"><li class="[slick-active]"><button type="button">1</button></li>…</ul>
 *          fade: mọi slide chồng lên nhau (left = -i*w), slide hiện có opacity 1 + z-index 999.
 *
 * Thông số lấy từ bản gốc: data-* của phần tử, cấu hình gọi plugin trong JS của theme, và motion.json (chu kỳ autoplay).
 * Tự dừng về slide đầu khi nhận sự kiện window "ecx:freeze" (snapshot.mjs phát để ảnh chụp ổn định).
 */
import { Children, cloneElement, isValidElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ElementType, ReactElement, ReactNode } from "react";

export type CarouselOptions = {
  /** Số slide hiện cùng lúc. */
  items?: number;
  /** Khoảng cách giữa các slide (px). */
  margin?: number;
  /** Lặp vòng (tạo slide nhân bản ở hai đầu như thư viện gốc). */
  loop?: boolean;
  nav?: boolean;
  dots?: boolean;
  autoplay?: boolean;
  /** Owl: autoplayTimeout (mặc định 5000). Slick: autoplaySpeed (mặc định 3000). */
  autoplayTimeout?: number;
  autoplayHoverPause?: boolean;
  /** Thời gian trượt (ms). Owl: smartSpeed 250. Slick: speed 300. */
  speed?: number;
  /** Số slide mỗi lần chuyển (Slick slidesToScroll / Owl slideBy). */
  slideBy?: number;
  /** Owl: rộng mỗi slide theo nội dung. */
  autoWidth?: boolean;
  /** Owl: tên class animate.css khi slide vào/ra (chỉ khi items = 1). */
  animateIn?: string;
  animateOut?: string;
  /** Slick: chuyển bằng mờ dần (items = 1). */
  fade?: boolean;
  center?: boolean;
  drag?: boolean;
  startPosition?: number;
  /** Owl: chấm lấy HTML từ thuộc tính data-dot của slide. */
  dotsData?: boolean;
  /** Nội dung 2 nút (HTML, giống navText của Owl). */
  navText?: [string, string];
  /** Theo độ rộng cửa sổ, kiểu Owl `responsive: {0:{…},768:{…}}`. Slick `responsive: [{breakpoint, settings}]` hãy đổi sang dạng này. */
  responsive?: Record<number, Partial<CarouselOptions>>;
};

type Props = CarouselOptions & {
  /** "owl" hoặc "slick": chọn cây thẻ và tên class giống thư viện gốc. */
  flavor: "owl" | "slick";
  /** Thẻ ngoài cùng (giữ đúng thẻ bản gốc, vd "div", "ul"). */
  as?: ElementType;
  /** Class gốc của phần tử ngoài cùng (vd "c-ip-slider__list js-slider-carousel h-carousel"). */
  className?: string;
  /** Thuộc tính khác của phần tử ngoài cùng (data-*, id…). */
  attrs?: Record<string, string | number | boolean | undefined>;
  /** Mỗi con trực tiếp là một slide (giữ markup gốc của slide). */
  children: ReactNode;
  /** Gọi khi slide hiện tại đổi (chỉ số thật, không tính bản nhân). */
  onChange?: (index: number) => void;
};

const DEF = {
  owl: { items: 3, margin: 0, speed: 250, autoplayTimeout: 5000 },
  slick: { items: 1, margin: 0, speed: 300, autoplayTimeout: 3000 },
};

function settingsFor(o: CarouselOptions, width: number): CarouselOptions {
  if (!o.responsive) return o;
  let s: CarouselOptions = { ...o };
  for (const bp of Object.keys(o.responsive).map(Number).sort((a, b) => a - b)) if (width >= bp) s = { ...s, ...o.responsive[bp] };
  return s;
}

const cx = (...a: Array<string | false | null | undefined>) => a.filter(Boolean).join(" ");

export function Carousel(props: Props) {
  const { flavor, as: Tag = "div", className, attrs, children, onChange } = props;
  const slides = useMemo(() => Children.toArray(children).filter(isValidElement) as ReactElement[], [children]);
  const n = slides.length;
  const [vw, setVw] = useState(1920);
  const s = useMemo(() => {
    const base = { ...DEF[flavor], nav: flavor === "slick", dots: true, drag: true, slideBy: 1, ...props };
    return { ...base, ...settingsFor(base, vw) } as Required<Pick<CarouselOptions, "items" | "margin" | "speed" | "autoplayTimeout" | "slideBy">> & CarouselOptions;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flavor, vw, props.items, props.margin, props.loop, props.nav, props.dots, props.autoplay, props.autoplayTimeout, props.speed, props.slideBy, props.autoWidth, props.animateIn, props.animateOut, props.fade, props.center, props.drag, props.responsive]);
  const items = Math.max(1, Math.min(s.items, n || 1));
  const loop = !!s.loop && n > items;
  // Số bản nhân mỗi đầu (công thức của Owl: max(items*2, 4, ceil(n/2)*2) / 2). Slick: slidesToShow (+1 khi center).
  const clonesPerSide = !loop ? 0 : flavor === "owl" ? Math.max(items * 2, 4, Math.ceil(n / 2) * 2) / 2 : items + (s.center ? 1 : 0);
  const outer = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [outerW, setOuterW] = useState(0);
  const [widths, setWidths] = useState<number[]>([]);
  const [pos, setPos] = useState(clonesPerSide + Math.min(s.startPosition ?? 0, n - 1)); // vị trí trong danh sách có bản nhân
  const [anim, setAnim] = useState(true); // false = nhảy không chuyển động (khi quay vòng)
  const [swap, setSwap] = useState<{ from: number; to: number; left: number } | null>(null);
  const [drag, setDrag] = useState<{ x0: number; dx: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const fadeMode = flavor === "slick" ? !!s.fade && items === 1 : false;
  const swapMode = flavor === "owl" && items === 1 && !!(s.animateIn || s.animateOut);

  // Danh sách hiển thị: [bản nhân cuối] + slide thật + [bản nhân đầu]
  const list = useMemo(() => {
    const real = slides.map((el, i) => ({ el, real: i, cloned: false }));
    if (!clonesPerSide) return real;
    const head = Array.from({ length: clonesPerSide }, (_, k) => ({ el: slides[(n - clonesPerSide + k + n * 10) % n], real: (n - clonesPerSide + k + n * 10) % n, cloned: true }));
    const tail = Array.from({ length: clonesPerSide }, (_, k) => ({ el: slides[k % n], real: k % n, cloned: true }));
    return [...head, ...real, ...tail];
  }, [slides, clonesPerSide, n]);

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    const freeze = () => { setFrozen(true); setAnim(false); setSwap(null); setPos(clonesPerSide); };
    window.addEventListener("ecx:freeze", freeze);
    return () => { window.removeEventListener("resize", onResize); window.removeEventListener("ecx:freeze", freeze); };
  }, [clonesPerSide]);

  useLayoutEffect(() => {
    const el = outer.current;
    if (!el) return;
    const measure = () => {
      setOuterW(el.clientWidth);
      if (s.autoWidth && stage.current) setWidths([...stage.current.children].map((c) => (c.firstElementChild as HTMLElement | null)?.offsetWidth ?? 0));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [s.autoWidth, list.length]);

  const itemW = outerW ? (outerW - s.margin * (items - 1)) / items : 0;
  const wOf = (i: number) => (s.autoWidth ? widths[i] ?? 0 : itemW);
  const offsetOf = (i: number) => { let x = 0; for (let k = 0; k < i; k++) x += wOf(k) + s.margin; return x; };
  const maxPos = loop ? list.length - 1 : Math.max(0, n - items);
  const realIndex = ((pos - clonesPerSide) % n + n) % n;

  const go = useCallback((to: number, animated = true) => {
    if (!n) return;
    let target = to;
    if (!loop) target = Math.max(0, Math.min(maxPos, to));
    // Kiểu animateIn/Out không trượt nên không cần đi qua bản nhân: quy về slide thật ngay.
    else if (swapMode) target = clonesPerSide + (((to - clonesPerSide) % n) + n) % n;
    if (swapMode && animated && target !== pos) {
      // Owl Animate plugin: tắt trượt, slide cũ ra / slide mới vào bằng class animate.css, slide cũ dịch "left" cho đứng yên tại chỗ.
      setSwap({ from: pos, to: target, left: offsetOf(target) - offsetOf(pos) });
      setAnim(false);
    } else setAnim(animated);
    setPos(target);
  }, [n, loop, maxPos, swapMode, pos, itemW, widths, s.margin]); // eslint-disable-line react-hooks/exhaustive-deps

  // Quay vòng: đi vào vùng bản nhân thì nhảy về slide thật tương ứng, không chuyển động.
  useEffect(() => {
    if (!loop) return;
    if (pos >= clonesPerSide && pos < clonesPerSide + n) return;
    const t = setTimeout(() => { setAnim(false); setPos(clonesPerSide + realIndex); }, swapMode ? 0 : s.speed);
    return () => clearTimeout(t);
  }, [pos, loop, clonesPerSide, n, realIndex, s.speed, swapMode]);
  useEffect(() => { if (!anim) { const r = requestAnimationFrame(() => setAnim(true)); return () => cancelAnimationFrame(r); } }, [anim]);
  useEffect(() => { onChange?.(realIndex); }, [realIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Autoplay
  useEffect(() => {
    if (!s.autoplay || frozen || (s.autoplayHoverPause && paused) || drag || n <= items) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => go(loop || pos < maxPos ? pos + s.slideBy : 0), s.autoplayTimeout);
    return () => clearTimeout(t);
  }, [s.autoplay, s.autoplayTimeout, s.autoplayHoverPause, s.slideBy, paused, frozen, drag, pos, loop, maxPos, n, items, go]);

  // Kéo bằng chuột / chạm
  const onPointerDown = (e: React.PointerEvent) => {
    if (!s.drag || e.button > 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ x0: e.clientX, dx: 0 });
  };
  const onPointerMove = (e: React.PointerEvent) => { if (drag) setDrag({ x0: drag.x0, dx: e.clientX - drag.x0 }); };
  const onPointerUp = () => {
    if (!drag) return;
    const step = wOf(pos) + s.margin || 1;
    const moved = Math.abs(drag.dx) > Math.min(step / 5, 60) ? -Math.sign(drag.dx) * Math.max(1, Math.round(Math.abs(drag.dx) / step)) : 0;
    setDrag(null);
    if (moved) go(pos + moved);
  };

  // Slide đang hiện
  const visible = (i: number) => {
    if (fadeMode || swapMode) return i === pos;
    if (s.autoWidth) { const x0 = offsetOf(pos), x = offsetOf(i); return x >= x0 - 1 && x + wOf(i) <= x0 + outerW + 1; }
    return i >= pos && i < pos + items;
  };
  const pages = Math.max(1, Math.ceil(n / items));
  const page = Math.min(pages - 1, Math.floor(realIndex / items));
  const allFit = n <= items;
  const dur = `${(anim && !drag ? s.speed : 0) / 1000}s`;
  const translate = -(offsetOf(pos)) + (drag?.dx ?? 0);
  const stageW = list.reduce((sum, _, i) => sum + wOf(i) + s.margin, 0);
  // Trước khi đo được (SSR), dùng đơn vị cqw để slide đã có đúng bề rộng, không nhảy bố cục.
  const preW = `calc((100cqw - ${s.margin * (items - 1)}px) / ${items})`;
  const itemStyle = (i: number): CSSProperties => ({
    width: outerW ? (s.autoWidth ? undefined : `${itemW}px`) : s.autoWidth ? undefined : preW,
    marginRight: s.margin ? `${s.margin}px` : undefined,
  });
  const hover = { onMouseEnter: () => setPaused(true), onMouseLeave: () => setPaused(false) };
  const swapCls = (i: number) => !swap ? "" : i === swap.from ? cx("animated owl-animated-out", s.animateOut) : i === swap.to ? cx("animated owl-animated-in", s.animateIn) : "";
  const swapStyle = (i: number): CSSProperties => (swap && i === swap.from ? { left: `${swap.left}px` } : {});
  const endSwap = (i: number) => { if (swap && i === swap.from) setSwap(null); };
  const [prevHtml, nextHtml] = s.navText ?? (flavor === "owl" ? ['<span aria-label="Previous">&#x2039;</span>', '<span aria-label="Next">&#x203a;</span>'] : ["Previous", "Next"]);

  if (flavor === "owl") {
    return (
      <Tag {...attrs} className={cx(className, "owl-carousel owl-loaded", s.drag && "owl-drag", drag && "owl-grab", s.dots && "owl-dotted")} {...hover}>
        <div className="owl-stage-outer" ref={outer} style={outerW ? undefined : { containerType: "inline-size" }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          <div className="owl-stage" ref={stage} style={{ transform: `translate3d(${translate}px, 0px, 0px)`, transition: `all ${dur} ease 0s`, width: outerW ? `${Math.ceil(stageW)}px` : undefined, ...(outerW ? {} : { display: "flex" }) }}>
            {list.map((it, i) => (
              <div key={i} className={cx("owl-item", it.cloned && "cloned", visible(i) && "active", s.center && i === pos && "center", swapCls(i))}
                style={{ ...itemStyle(i), ...swapStyle(i) }} onAnimationEnd={() => endSwap(i)}>
                {it.cloned ? cloneElement(it.el, { key: `c${i}` }) : it.el}
              </div>
            ))}
          </div>
        </div>
        {s.nav !== false && (
          <div className={cx("owl-nav", allFit && "disabled")}>
            <button type="button" role="presentation" className={cx("owl-prev", !loop && pos <= 0 && "disabled")} onClick={() => go(pos - s.slideBy)} dangerouslySetInnerHTML={{ __html: prevHtml }} />
            <button type="button" role="presentation" className={cx("owl-next", !loop && pos >= maxPos && "disabled")} onClick={() => go(pos + s.slideBy)} dangerouslySetInnerHTML={{ __html: nextHtml }} />
          </div>
        )}
        {s.dots && (
          <div className={cx("owl-dots", allFit && "disabled")}>
            {Array.from({ length: pages }, (_, p) => {
              const html = s.dotsData ? String((slides[p * items]?.props as Record<string, unknown>)?.["data-dot"] ?? "") : "";
              const click = () => go(clonesPerSide + p * items);
              return s.dotsData
                ? <div key={p} className={cx("owl-dot", p === page && "active")} onClick={click} dangerouslySetInnerHTML={{ __html: html }} />
                : <button key={p} type="button" role="button" className={cx("owl-dot", p === page && "active")} onClick={click}><span /></button>;
            })}
          </div>
        )}
      </Tag>
    );
  }

  // Slick
  return (
    <Tag {...attrs} className={cx(className, "slick-initialized slick-slider", s.dots && "slick-dotted")} {...hover}>
      {s.nav !== false && !allFit && (
        <button type="button" className={cx("slick-prev slick-arrow", !loop && pos <= 0 && "slick-disabled")} aria-label="Previous" onClick={() => go(pos - s.slideBy)} dangerouslySetInnerHTML={{ __html: prevHtml }} />
      )}
      <div className="slick-list draggable" ref={outer} style={outerW ? undefined : { containerType: "inline-size" }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        <div className="slick-track" ref={stage} style={{
          opacity: 1, width: outerW ? `${Math.ceil(stageW)}px` : undefined,
          transform: fadeMode ? "translate3d(0px, 0px, 0px)" : `translate3d(${translate}px, 0px, 0px)`,
          transition: fadeMode ? undefined : `transform ${dur} ease`, ...(outerW ? {} : { display: "flex" }),
        }}>
          {list.map((it, i) => {
            const on = visible(i);
            const fade: CSSProperties = fadeMode ? { position: "relative", left: `${-offsetOf(i)}px`, top: 0, zIndex: on ? 999 : 998, opacity: on ? 1 : 0, transition: `opacity ${s.speed}ms ease` } : {};
            return (
              <div key={i} className={cx("slick-slide", it.cloned && "slick-cloned", on && "slick-active", i === pos && "slick-current", s.center && i === pos && "slick-center")}
                data-slick-index={i - clonesPerSide} aria-hidden={on ? "false" : "true"} tabIndex={on ? 0 : -1} style={{ ...itemStyle(i), ...fade }}>
                {it.cloned ? cloneElement(it.el, { key: `c${i}` }) : it.el}
              </div>
            );
          })}
        </div>
      </div>
      {s.nav !== false && !allFit && (
        <button type="button" className={cx("slick-next slick-arrow", !loop && pos >= maxPos && "slick-disabled")} aria-label="Next" onClick={() => go(pos + s.slideBy)} dangerouslySetInnerHTML={{ __html: nextHtml }} />
      )}
      {s.dots && !allFit && (
        <ul className="slick-dots" role="tablist">
          {Array.from({ length: pages }, (_, p) => (
            <li key={p} className={p === page ? "slick-active" : undefined} role="presentation">
              <button type="button" role="tab" onClick={() => go(clonesPerSide + p * items)}>{p + 1}</button>
            </li>
          ))}
        </ul>
      )}
    </Tag>
  );
}

export const OwlCarousel = (p: Omit<Props, "flavor">) => <Carousel flavor="owl" {...p} />;
export const SlickCarousel = (p: Omit<Props, "flavor">) => <Carousel flavor="slick" {...p} />;
export default Carousel;
