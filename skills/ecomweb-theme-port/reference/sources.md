# Xử lý theo loại nguồn

`snapshot.mjs` in ra loại nguồn (`meta.json › source`). Một site thường có nhiều loại cùng lúc (WordPress + Elementor + WooCommerce + RevSlider), nên đọc **mọi mục khớp**.
Phần chung cho mọi loại đã nằm trong SKILL.md. Mục dưới đây chỉ ghi phần khác.

---

## WordPress (mọi kiểu)

- Mã PHP và file `.php` vô dụng. Chỉ dùng DOM đã render.
- **JS bị hoãn:** WP Rocket, Perfmatters, LiteSpeed, FlyingPress và nhiều theme bán sẵn chỉ chạy JS sau lần rê chuột/chạm/cuộn đầu tiên (`ideapark_require`, `rocket-delay-js`, `data-rocket-src`, `type="rocketlazyloadscript"`). `snapshot.mjs`/`motion.mjs` đã thao tác thật; nếu `carousel đã khởi tạo: 0` mà trang có slider → `--wait 5000`.
- Class `<body>`: dùng `meta.json › bodyClasses.keep`, chia hai loại theo `cms.md › Khung trang`. Thông tin trang nằm trong class: `home`, `page-template-*`, `single-product`, `archive`, `tax-product_cat`, `woocommerce`, `woocommerce-page`, `elementor-page-<id>`, `elementor-kit-<n>`. Tính lại theo `data` của CMS trong `layout.tsx`:
  - trang chủ: `home`;
  - chi tiết sản phẩm: `single-product woocommerce woocommerce-page`;
  - danh sách sản phẩm: `archive post-type-archive-product woocommerce woocommerce-page`;
  - bài viết: `single single-post`.

  Bỏ class nhận diện trình duyệt do JS gắn (`e--ua-*`, `rs-safari`, `no-js`). Giữ và render sẵn từ server các class mà CSS gốc cần dù do JS gắn: `woocommerce-js`, `js`.
- Ảnh có `srcset`, `sizes` trỏ về `wp-content/uploads/…-300x300.jpg`: dùng ảnh từ media của CMS (`<Img>`) hoặc `src` đơn. Không giữ `srcset` trỏ host gốc.
- Emoji, admin bar, `wp-embed`, `jquery-migrate`, `dashicons`, `wp-block-library` cho trang không dùng khối: `css-port` bỏ qua admin bar/dashicons. Giữ `wp-block-library` nếu bản gốc có khối Gutenberg trong nội dung.
- Widget sidebar (danh mục, bài mới, thẻ, lọc giá): vẽ thành component với markup gốc, dữ liệu từ `getTerms`/`getPosts`, hoặc đặt `widgetAreas` để chủ shop tự thêm.
- Customizer và theme options (logo, số điện thoại, mạng xã hội, chữ chân trang): trang cài đặt ACF "Thiết lập chung".
- Shortcode trong nội dung (`[contact-form-7]`, `[products]`): không chạy. Thay bằng component của theme hoặc form của plugin `ecx-contact-form`.

## Elementor

- Cấu trúc khung có 2 kiểu, phải giữ đủ lớp lồng:
  - kiểu cũ: `elementor-section > elementor-container > elementor-column > elementor-widget-wrap > elementor-widget > elementor-widget-container`;
  - kiểu mới: `e-con` / `e-con-inner`.
- Mỗi phần tử có class `elementor-element-<id>` mà CSS của trang (`post-<id>.css`, hoặc `<style>` inline) bám vào. **Giữ nguyên các id này.** Đổi id là mất kiểu.
- CSS theo trang: `elementor/css/post-<id>.css` (mỗi trang một file) và `post-<kit>.css` (biến `--e-global-color-*`, `--e-global-typography-*`). Kit dùng chung: gộp vào `source.css`. File của từng trang: `css-port --name page-<tên>` rồi import trong template của trang đó.
- Thuộc tính `data-settings` (JSON) quyết định hành vi:
  - `"sticky"`: header dính;
  - `"animation"`/`"_animation"`: hiệu ứng xuất hiện, gắn class `elementor-invisible` cho tới khi cuộn tới, rồi đổi thành `animated <tên>`;
  - `"background_slideshow_gallery"`: nền trình chiếu;
  - `"motion_fx_*"`: hiệu ứng chuyển động khi cuộn.

  Hiệu ứng xuất hiện: `kit/Reveal` (đọc `data-settings`, gỡ `elementor-invisible`, thêm `animated <tên>`, theo `_tablet`/`_mobile`). Header dính: `kit/ScrollClass`. Nền trình chiếu: `kit/Carousel` hoặc component riêng.
- Widget và JS thường gặp:
  - carousel dùng swiper: cần class `swiper-initialized`;
  - tab (`elementor-tab-title`/`elementor-tab-content`, `e-n-tabs`): gắn `elementor-active`;
  - accordion, toggle, counter (`data-to-value`), countdown (`data-date`), video lightbox, popup Pro.
- Breakpoint mặc định: mobile ≤ 767px, tablet ≤ 1024px. CSS trang đã có `@media` sẵn, đừng tự viết.
- Theme bán sẵn (ThemeForest, wpthemego, parkofideas…) hay có widget riêng (`sw-*`, `bwp-*`, `jws-*`, `ideapark-*`) chạy bằng Owl hoặc Slick → `kit/Carousel`. Thông số: `data-*` của widget (`data-slides_to_show`, `_tablet`, `_mobile`, `data-autoplay`, `data-animation`, `data-animation-timeout`…) + cấu hình `owlCarousel({…})`/`slick({…})` trong JS của theme (thường là một file gộp `uploads/<theme>/min*.js`).

## WPBakery (Visual Composer) / Divi / Avada / Beaver

- WPBakery: khung `vc_row > vc_column > vc_column-inner > wpb_wrapper`. Kiểu lưu ở `<style data-type="vc_shortcodes-custom-css">` với class `vc_custom_<số>`. `css-port` đã gộp inline style, chỉ cần giữ class.
- Divi: `et_pb_section > et_pb_row > et_pb_column > et_pb_module`. CSS sinh theo trang, `et-divi-customizer-global` cũng là CSS trang.
- Avada `fusion-*`, Beaver `fl-*`: cùng cách. Giữ khung, gộp CSS theo trang.

## Gutenberg / theme khối (FSE)

- Lớp `wp-block-*` và biến `--wp--preset--color--*`, `--wp--preset--font-size--*`, `--wp--style--global--*` (sinh trong `global-styles-inline-css`). `css-port` đã gộp style inline đó.
- Ánh xạ preset màu sang `theme.json › styles.colors` (`primary` = màu nút/link chính).
- Nội dung bài có khối Gutenberg: CMS có trình soạn khối riêng. Nội dung bài nhập lại trong CMS, theme chỉ cần CSS khớp với `<PostContent>`.

## WooCommerce

- Thẻ sản phẩm: `ul.products > li.product` (`woocommerce-loop-product__title`, `price`, `add_to_cart_button`). Giữ nguyên markup, dữ liệu từ `extra.commerce` (xem `cms.md` › Bán hàng).
- Giá: `<span class="price"><del>…</del> <ins>…</ins></span>` với `woocommerce-Price-amount amount` + `woocommerce-Price-currencySymbol`. Dùng chuỗi đã định dạng `priceFormatted`/`salePriceFormatted`, đặt vào đúng các span đó.
- Nút thêm giỏ: `cart.add` của plugin. Hiệu ứng "đã thêm" của bản gốc (`added`, `loading`, thông báo) làm lại bằng class.
- Chi tiết sản phẩm: gallery (`woocommerce-product-gallery`, flexslider/zoom), tab (`wc-tabs`), biến thể (`variations_form`, swatch), số lượng (`quantity`). Biến thể lấy từ `extra.commerce.variants`.
- Lọc, sắp xếp, phân trang (`woocommerce-ordering`, `woocommerce-pagination`, widget lọc giá): dùng tham số URL và `<Link scroll={false}>`, không tải lại trang.
- Giỏ và thanh toán:
  - `meta.source.wooBlocks = true`: bản gốc vẽ bằng JS, bản chụp là khung rỗng. Dùng shortcode `[cart]`/`[checkout]` của plugin, phủ CSS theo màu/khoảng cách của mẫu, và ghi vào báo cáo.
  - Giỏ và thanh toán dạng cũ (`woocommerce-cart-form`, `woocommerce-checkout`): giữ markup, dữ liệu từ `window.ecomcx.cart`.
- Mini cart ở header: `cart.items()`, `cart.count()`, nghe `ecx:cart`.
- Wishlist (YITH), so sánh, quick view: theme tự làm (xem `cms.md`).

## Slider Revolution / LayerSlider / Smart Slider

- Không chạy được bản gốc (JS độc quyền). Chụp `shot-1920.png` và `shot-390.png` vùng slider, đọc vị trí từng lớp chữ/ảnh.
- Dựng lại bằng HTML/CSS:
  - ảnh nền `background-size: cover`;
  - lớp chữ `position: absolute` theo %;
  - chuyển slide bằng component slider của theme (`reference/jsx.md` › Slider).
- Ảnh, chữ và link từng slide là repeater ACF.
- Đây là chỗ được phép viết CSS mới (trong `styles.css`) vì không có CSS gốc dùng được. So bằng `compare` như mọi khối khác.

## Bản HTTrack

- `httrack-map.mjs` → `map.json` (file ↔ URL gốc, file thiếu). HTTrack đổi tên file có query (`style.css?ver=6.1` → `style6a3f.css`).
- Thường thiếu: CSS Google Fonts, chunk JS của Elementor (`chunks/*.min.js`), file do JS gọi. Site gốc còn sống → chụp site gốc làm chuẩn, chỉ dùng HTTrack để lấy file.
- Phục vụ bằng `serve.mjs` (không `file://`).

## HTML tĩnh (template mua ở ThemeForest, bản tải về)

- Có sẵn HTML thật: vẫn chụp bằng `serve.mjs` + `snapshot.mjs` để lấy DOM sau JS và CSS đúng thứ tự.
- Bootstrap, slick, owl, swiper, AOS, WOW, isotope, magnific-popup: không chép JS, dùng kit (`reference/kit.md`). Kit gắn đúng class sau khởi tạo (`owl-loaded`, `slick-initialized`, `aos-animate`).

## React / Next.js / Vue / Nuxt / Astro / Svelte

- Dễ nhất vì đã là component. Dù vậy vẫn **chép DOM đã render và CSS đã build** (chạy site lên, chụp bằng `snapshot.mjs`). Lý do: CSS-in-JS, CSS module (tên class băm `_hero_a1b2c`), Tailwind có purge chỉ đúng ở dạng đã build.
- Có mã nguồn thì được phép bê logic hành vi (state của tab, slider) sang component `"use client"`. Bỏ phụ thuộc vào router, data fetching và state management (Redux, Zustand) của app gốc: dữ liệu lấy qua SDK.
- Tailwind:
  - cách nhanh: giữ class Tailwind và dùng CSS đã build qua `css-port`, không cài Tailwind;
  - muốn sửa tiếp bằng Tailwind: cài `tailwindcss` (phiên bản cụ thể) vào theme, chép `tailwind.config` gốc, `content` trỏ `components/**/*.tsx` và `templates/**/*.tsx`.
- `next/image` → `<Img>` hoặc `<img>`; `next/link` → `Link` của SDK; `next/font` → font tải về `assets/files` qua CSS gốc.
- Vue/Nuxt/Svelte: đổi template sang JSX (`v-if` → `&&`, `v-for` → `.map`, `:class` → `className`, `@click` → `onClick`).

## Shopify

- Liquid không dùng được. Chụp DOM đã render.
- Section (`shopify-section`) tương ứng một khối/component. `{{ settings.* }}` chuyển thành ACF, `product.*` chuyển thành `extra.commerce`.
- Ảnh `cdn.shopify.com`: tải về hoặc nhập vào media của CMS. Không để link CDN của Shopify.
- Giỏ AJAX (`/cart/add.js`) chuyển thành `window.ecomcx.cart`.

## Webflow / Wix / Framer / Squarespace

- Webflow: class giữ nguyên, CSS `webflow.css` + `<site>.webflow.css`. Interaction (IX2, `data-w-id`) phải làm lại bằng `IntersectionObserver` và CSS transition. Đọc `style` inline ban đầu (opacity 0, transform) để biết trạng thái trước khi hiện.
- Wix, Framer, Squarespace: markup sinh tự động rất sâu, class băm. Vẫn chép DOM đã render, nhưng ghi vào báo cáo rằng markup khó bảo trì. Nếu người dùng đồng ý thì dựng lại markup gọn hơn theo `shot-*.png`, rồi dùng `compare` để giữ đúng hình.
