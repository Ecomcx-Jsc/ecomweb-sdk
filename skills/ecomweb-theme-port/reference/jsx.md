# HTML sang JSX và làm lại hành vi JS

## Đổi HTML sang JSX (làm máy móc, không sáng tạo)

| HTML | JSX |
|---|---|
| `class="a b"` | `className="a b"` |
| `for="x"` | `htmlFor="x"` |
| `style="color:red; margin-top:10px"` | `style={{ color: "red", marginTop: "10px" }}` (biến CSS giữ nguyên tên: `{ "--x": "1" } as React.CSSProperties`) |
| `<br>`, `<img …>`, `<input …>`, `<hr>` | `<br />`, `<img … />`, `<input … />`, `<hr />` |
| `<!-- chú thích -->` | xoá, hoặc `{/* chú thích */}` |
| `tabindex`, `readonly`, `maxlength`, `colspan`, `autocomplete`, `crossorigin`, `srcset`, `frameborder`, `allowfullscreen` | `tabIndex`, `readOnly`, `maxLength`, `colSpan`, `autoComplete`, `crossOrigin`, `srcSet`, `frameBorder`, `allowFullScreen` |
| SVG: `stroke-width`, `fill-rule`, `clip-path`, `xlink:href`, `viewbox` | `strokeWidth`, `fillRule`, `clipPath`, `xlinkHref`, `viewBox` |
| `onclick="…"` | xoá. Hành vi làm lại ở client (dưới đây) |
| `data-*`, `aria-*` | giữ nguyên |
| `value="x"` của input không điều khiển | `defaultValue="x"`; checkbox `defaultChecked` |
| `<script>…</script>` trong body | xoá. Hành vi làm lại ở client |
| `<a href="https://site-goc.com/san-pham/x">` | `<Link href={post.link}>` (dữ liệu thật) |
| `<img data-src="a.jpg" src="placeholder.gif">` | `<img src={url} loading="lazy" />` |
| `&nbsp;` | `{" "}` hoặc giữ `&nbsp;` |

Đoạn HTML dài và tĩnh (icon SVG, khung lồng nhiều lớp) chép nguyên văn sau khi đổi theo bảng.
Giữ cả thuộc tính `width`/`height` của ảnh, vì chúng chống nhảy layout và ảnh hưởng tới `compare`.

## Thay nội dung demo bằng dữ liệu

Trước:
```html
<div class="banner-item"><img src="…/banner1.jpg"><h3>Summer Sale</h3><a href="/shop" class="btn">Shop now</a></div>
```
Sau:
```tsx
<div className="banner-item">
  {img && <img src={img} width="570" height="300" alt="" />}
  <h3>{str(acf.kidzone_banner_title, "Summer Sale")}</h3>
  <Link href={link?.url || shopUrl} className="btn">{t("ui.shop_now")}</Link>
</div>
```
- Chữ do chủ shop sửa (tiêu đề, mô tả) → ACF, mặc định = chữ gốc.
- Chữ giao diện cố định (nút, nhãn) → `locales`.
- Danh sách lặp lại N lần giống nhau → `.map()` trên repeater ACF hoặc trên dữ liệu (sản phẩm, bài, danh mục). Giữ markup **một** phần tử mẫu, xoá các bản lặp còn lại.

## Làm lại hành vi JS

Nguyên tắc:
- Hành vi chỉ **thêm/bớt class và style** đúng như JS gốc làm, để CSS gốc lo phần hình. Mở DevTools ở bản gốc, xem class nào đổi khi bấm/cuộn (`active`, `open`, `show`, `is-sticky`, `slick-active`).
- Một hành vi gắn vào một khối thì làm component `"use client"` bọc khối đó. Hành vi toàn trang (hiệu ứng cuộn, nút lên đầu, header dính, modal) làm một `Behavior.tsx` gắn ở `layout.tsx`.
- Chạy lại khi chuyển trang (Next không tải lại trang): `useEffect(…, [pathname])` với `usePathname()` từ `next/navigation`, hoặc `MutationObserver` trên `document.body`.
- Dọn dẹp trong hàm trả về của `useEffect` (gỡ listener, `observer.disconnect()`).
- Tôn trọng `matchMedia("(prefers-reduced-motion: reduce)")`.

### Header dính

```tsx
"use client";
import { useEffect } from "react";
export default function Sticky({ selector = "#header", offset = 200, cls = "is-sticky" }: { selector?: string; offset?: number; cls?: string }) {
  useEffect(() => {
    const el = document.querySelector(selector);
    if (!el) return;
    const on = () => el.classList.toggle(cls, window.scrollY > offset);
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [selector, offset, cls]);
  return null;
}
```

### Hiệu ứng xuất hiện khi cuộn (WOW, AOS, Elementor `elementor-invisible`)

```tsx
"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
export default function Reveal() {
  const pathname = usePathname();
  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target as HTMLElement; io.unobserve(el);
      let s: Record<string, string> = {};
      try { s = JSON.parse(el.dataset.settings || "{}"); } catch {}
      const name = (innerWidth <= 767 && s._animation_mobile) || (innerWidth <= 1024 && s._animation_tablet) || s._animation || s.animation;
      el.classList.remove("elementor-invisible");
      if (name && name !== "none" && !reduce) el.classList.add("animated", name);
    }));
    document.querySelectorAll(".elementor-invisible").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);
  return null;
}
```
Với AOS: phần tử `[data-aos]`, thêm class `aos-animate` (và `aos-init` lúc đầu). Với WOW: `.wow`, thêm `animated` + đặt `visibility: visible`.

### Slider (slick, owl, swiper, flexslider của bản gốc)

Chọn một trong hai cách, dùng **một cách cho cả theme**:
1. **Gói `swiper` (khuyên dùng khi bản gốc là swiper):** `npm i swiper@11.2.6` (ghi đúng phiên bản trong package.json). Khởi tạo trên markup gốc trong `useEffect`. CSS swiper gốc đã có trong `source.css`.
2. **Component slider tự viết** (khi bản gốc là slick/owl, để giữ đúng markup `slick-list`/`slick-track`/`owl-stage`): tạo đúng cây thẻ mà plugin gốc sinh ra **sau khi khởi tạo**. Lấy cây này từ `dom-1920.html`, không lấy từ HTML nguồn. Sau đó tính `transform: translate3d(-Xpx,0,0)` theo slide hiện tại, gắn `slick-active`/`slick-current`, và đọc số cột từng thiết bị từ `data-*` của bản gốc.

Dù cách nào, slider phải:
- có class "đã khởi tạo" (`slick-initialized`, `swiper-initialized`, `owl-loaded`) ngay khi render;
- có đúng số slide hiện ở 1920/1440/390;
- vuốt được trên mobile;
- không tạo thanh cuộn ngang.

### Tab, accordion, toggle

`useState` chỉ số đang mở. Gắn đúng class gốc (`active`, `show`, `elementor-active`, `is-open`) lên tiêu đề và nội dung đang mở. Nội dung tab vẫn render hết (CSS gốc ẩn bằng class), để giống bản gốc và tốt cho SEO.

### Menu mobile, mega menu, dropdown

- Nút mở menu: toggle class gốc (`menu-open` trên khung bao hoặc `active` trên menu). Đóng khi chuyển trang (`useEffect` theo `pathname`).
- Mega menu định vị bằng JS ở bản gốc: tính `left`/`width` như JS gốc khi hover. Đọc hàm gốc trong file JS của bản gốc (có trong thư mục HTTrack, tra bằng `map.json`).
- Menu từ `getMenu()` có `children`. Vẽ đệ quy với đúng `ul.sub-menu`/`li.menu-item-has-children` của bản gốc. `cssClass` của mục menu gắn vào `li`.

### Đếm ngược, đếm số, lightbox, modal, nút lên đầu, quick view

- Đếm ngược: ngày kết thúc từ ACF hoặc `extra.commerce.saleEndsAt`. Tính ở client (`useEffect`) để tránh lỗi hydration.
- Đếm số (counter): `IntersectionObserver` rồi tăng từ 0 tới đích trong khoảng thời gian `data-duration` gốc.
- Lightbox video/ảnh: modal tự viết với class gốc. `iframe` YouTube cần `csp.frame-src`.
- Modal kiểu Bootstrap (`data-toggle="modal"`): gắn `show`/`in` + `display:block` lên modal và `modal-open` lên body (class trạng thái, được phép).
- Quick view: đặt sẵn dữ liệu cần hiện trên thẻ sản phẩm lúc render server (`data-product-id`, `-title`, `-img`, `-price`, `-link`), rồi client đọc và vẽ vào khung quick view gốc. Không gọi API của CMS từ trình duyệt.
