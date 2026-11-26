# HTML sang JSX và thay nội dung demo

**Không đổi tay.** `scripts/html2jsx.mjs` làm hết bảng dưới (kèm tải ảnh, gỡ khung carousel). Bảng này để hiểu file sinh ra và sửa chỗ nhỏ.

```bash
node $SKILL/scripts/html2jsx.mjs port/orig/home/dom-1920.html --select "<phần tử ngoài cùng của khối>" --out components/<nhóm>/<Tên>.tsx --name <Tên>
```
- `--all`: mọi phần tử khớp (vd mọi `.elementor-section` của trang). Không có `--all` thì lấy phần tử đầu tiên.
- Ảnh (`src`, `srcset` của `<source>`, `poster`, `url()` trong style) tải về `assets/media/`, dùng qua `M.mN` của `<Tên>.media.ts`.
- Thuộc tính lạ (`valign`, `bgcolor`…) giữ trong `{...{ "valign": "top" }}`.
- Carousel Owl/Slick: khung thư viện bị gỡ, có dấu `{/* KIT: … */}` (xem `kit.md`).

## Quy tắc đổi (html2jsx đã làm)

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

## Hành vi JS

Làm bằng kit (`reference/kit.md`). Chỉ viết component riêng cho thứ kit không có, theo quy tắc cuối `kit.md`.
