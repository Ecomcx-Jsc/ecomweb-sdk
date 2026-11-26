# Kit: hành vi dựng sẵn (thay JS gốc, không jQuery)

Chép một lần: `mkdir -p components/kit && cp $SKILL/kit/*.tsx components/kit/`. Không sửa file kit trong theme; thiếu tính năng thì ghi vào báo cáo.
Mọi component kit **giữ class gốc** và chỉ thêm/bớt đúng class mà thư viện gốc thêm/bớt, để CSS gốc (đã có trong `source.css`) lo phần hình và chuyển động.

## Lấy thông số (không đoán)

Theo thứ tự ưu tiên:
1. `port/orig/<trang>/motion-report.md › Thông số bản gốc`: chu kỳ autoplay, tên + thời lượng animation, số bản chạy cùng lúc, offset cuộn.
   Chưa có thì tạo: `node $SKILL/scripts/motion.mjs compare port/orig/<trang>/motion.json port/orig/<trang>/motion.json`.
2. `data-*` trên phần tử gốc (`data-autoplay`, `data-animation`, `data-animation-timeout`, `data-slides_to_show`, `data-settings` của Elementor…).
3. Cấu hình gọi plugin trong JS gốc: `grep -o "owlCarousel({[^}]*}" <file.js>`, `grep -o "slick({[^}]*}" <file.js>`. File JS: `meta.json › scripts`, tìm trong thư mục HTTrack bằng `map.json`.
4. Mặc định của thư viện (Owl: items 3, margin 0, smartSpeed 250, autoplayTimeout 5000; Slick: slidesToShow 1, speed 300, autoplaySpeed 3000).

Option trong JS gốc thường phụ thuộc class trên phần tử, ví dụ `nav: !$this.hasClass('h-carousel--nav-hide')`, `autoplay: $this.hasClass('h-carousel--autoplay')`. Đọc class của chính phần tử đó để ra giá trị.

## Carousel.tsx — Owl Carousel 2 / Slick

```tsx
import { OwlCarousel, SlickCarousel } from "../kit/Carousel";

// html2jsx đã gỡ khung owl và để dấu {/* KIT: … */} trước <div className="c-ip-slider__list …">
<OwlCarousel as="div" className="c-ip-slider__list c-ip-slider__list--full js-slider-carousel h-carousel h-carousel--big-dots h-carousel--inner h-carousel--hover c-ip-slider__list--dots h-carousel--dot-animated"
  items={1} loop autoplay autoplayTimeout={5000} animateIn="owl-fade-scale-in" animateOut="owl-fade-scale-out" dotsData nav={false}
  navText={['<i class="ip-right_big h-carousel__prev"></i>', '<i class="ip-right_big h-carousel__next"></i>']}>
  {slides.map((s) => <div key={s.key} className="c-ip-slider__item c-ip-slider__item--full" data-dot={s.dotHtml}>…markup gốc của slide…</div>)}
</OwlCarousel>

<OwlCarousel as="div" className="c-product-grid__list …" items={4} margin={30} nav dots={false}
  responsive={{ 0: { items: 1 }, 768: { items: 2 }, 1190: { items: 4 } }}>
  {products.map((p) => <ProductCard key={p.id} product={p} />)}
</OwlCarousel>

<SlickCarousel as="div" className="team-slider" items={4} loop nav autoplay autoplayTimeout={3000}
  responsive={{ 0: { items: 1 }, 768: { items: 3 }, 1025: { items: 4 } }}>…</SlickCarousel>
```

| Prop | Owl | Slick | Ghi chú |
|---|---|---|---|
| `items` | `items` | `slidesToShow` | |
| `margin` | `margin` | (CSS) | px |
| `loop` | `loop` | `infinite` | tạo slide nhân bản đúng số lượng như thư viện |
| `nav` / `dots` | `nav` / `dots` | `arrows` (=`nav`) / `dots` | |
| `autoplay`, `autoplayTimeout`, `autoplayHoverPause` | như tên | `autoplay`, `autoplaySpeed`, `pauseOnHover` | |
| `speed` | `smartSpeed` | `speed` | ms trượt |
| `slideBy` | `slideBy` | `slidesToScroll` | |
| `animateIn` / `animateOut` | như tên | — | chỉ khi items = 1: slide gắn `animated owl-animated-in <animateIn>` |
| `fade` | — | `fade` | |
| `autoWidth`, `center`, `startPosition`, `dotsData`, `navText` | như tên | `centerMode` = `center` | `dotsData`: chấm lấy HTML từ `data-dot` của slide |
| `responsive` | `{0:{…},768:{…}}` | đổi `[{breakpoint:767,settings}]` sang `{0:{…mobile},768:{…}}` | theo độ rộng cửa sổ |

Kit tự dừng về slide đầu khi `snapshot.mjs` phát `ecx:freeze` (ảnh chụp ổn định). Swiper: dùng gói npm `swiper` (ghi phiên bản cụ thể) trên markup gốc trong `useEffect`; CSS swiper gốc đã có trong `source.css`.
Flexslider/Splide/Glide/Flickity: chưa có trong kit → component riêng sinh đúng class của thư viện (xem `motion.json › blocks` để biết class nào được gắn), ghi vào báo cáo.

## RunningLine.tsx — dải chữ chạy

```tsx
<RunningLine className="c-ip-running-line js-ip-running-line" activeClass="c-ip-running-line--active"
  contentAs="ul" contentClassName="c-ip-running-line__content">
  {items.map((it, i) => <li key={i} className="c-ip-running-line__item">…markup gốc của một mục…</li>)}
</RunningLine>
```
Nhân phần nội dung tới khi phủ kín bề rộng (`ceil(dải/nội dung) + 2`, như JS gốc), gắn `activeClass` để keyframes gốc chạy. Số bản đúng thì `motion compare` hết dòng `[số bản]`.

## Reveal.tsx — hiệu ứng xuất hiện khi cuộn

`<Reveal />` một lần trong `layout.tsx`. Tự nhận Elementor (`elementor-invisible` + `data-settings._animation`), AOS (`data-aos`), WOW (`.wow`), kiểu `data-reveal`. Giữ nguyên các thuộc tính đó trong markup (html2jsx giữ sẵn). Breakpoint khác Elementor mặc định: `<Reveal mobile={767} tablet={1024} />`.

## ScrollClass.tsx — header dính, nút lên đầu, thanh ẩn khi cuộn

```tsx
<ScrollClass rules={[
  { selector: ".c-header", offset: 250, steps: [{ add: "c-header--transition" }, { add: "c-header--sticky", delay: 10 }, { add: "c-header--active", delay: 300 }] },
  { selector: ".c-to-top-button", offset: 900, steps: [{ add: "c-to-top-button--active" }] },
]} />
```
Offset + class + thứ tự: `motion-report.md › cuộn …`. Header dính cần `top: var(--cms-admin-bar, 0px)` (thanh admin của CMS).

## Toggle.tsx — tab, accordion, menu mobile, popup, dropdown

```tsx
<Toggle groups={[
  { kind: "tabs", root: ".c-ip-product-tabs", trigger: ".c-ip-product-tabs__menu-item", target: ".c-ip-product-tabs__wrap", activeClass: "active" },
  { kind: "accordion", root: ".c-ip-accordion", trigger: ".c-ip-accordion__header", item: ".c-ip-accordion__item", activeClass: "active", single: true },
  { kind: "open", trigger: ".js-mobile-menu-open", target: ".c-header__menu", activeClass: "c-header__menu--active", bodyClass: "h-no-scroll", close: ".js-mobile-menu-close" },
]} />
```
Đóng khi bấm ra ngoài, Esc, chuyển trang. Class lấy bằng cách bấm thử ở bản gốc rồi xem `motion.json › blocks` (hoặc DevTools).

## CountUp.tsx — bộ đếm số

`<span className="elementor-counter-number"><CountUp to={250} duration={2000} /></span>`: giữ thẻ/class ngoài như bản gốc.

## Không có trong kit

Zoom ảnh sản phẩm, gallery lightbox (PhotoSwipe), so sánh ảnh trước/sau, video nền, parallax, đếm ngược: component `"use client"` riêng. Quy tắc giống kit: giữ markup + class gốc, chỉ đổi class/style như JS gốc, thông số từ motion/data/JS gốc, tôn trọng `prefers-reduced-motion`, dọn listener khi unmount, chạy lại theo `usePathname()`.
