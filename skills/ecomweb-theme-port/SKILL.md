---
name: ecomweb-theme-port
description: Chuyển giao diện của một website bất kỳ (theme WordPress classic/Elementor/WPBakery/Divi/Gutenberg/WooCommerce, HTML tĩnh, bản tải bằng HTTrack, React/Next/Vue/Nuxt, Shopify, Webflow) thành theme của Ecomweb CMS, giống bản gốc tới từng pixel ở 1920/1440/390px, nội dung sửa được trong trang quản trị. Dùng khi người dùng nói "clone/chuyển/port theme", "làm theme giống site X", đưa URL hoặc thư mục HTTrack và muốn có theme Ecomweb.
---

# Chuyển website thành theme Ecomweb

Người dùng chỉ cần đưa **một câu**, ví dụ: `chuyển https://demo.site.com thành theme "my-shop"` hoặc `chuyển thư mục ~/web-kitzone/site (gốc https://demo2.wpthemego.com/themes/sw_kidzone/) thành theme kidzone`.
Bạn làm hết các pha dưới đây **theo đúng thứ tự**, không bỏ pha nào, không hỏi lại những gì skill này đã trả lời.

Thư mục skill gọi là `$SKILL` (thư mục chứa file này). Script nằm ở `$SKILL/scripts`.
Đọc thêm khi tới pha cần dùng, đừng đọc trước:
- `reference/cms.md` — mọi thứ cần biết về CMS Ecomweb (cấu trúc theme, SDK, ACF, menu, bán hàng, dịch chữ, lệnh CLI).
- `reference/sources.md` — cách xử lý riêng từng loại nguồn (Elementor, Woo, Next…).
- `reference/jsx.md` — quy tắc đổi HTML sang JSX và viết lại hành vi JS.

---

## Luật tuyệt đối

Đây là các lỗi đã làm hỏng những lần chuyển trước. Vi phạm một luật = bản chuyển lệch.

**LUÔN**
1. LUÔN lấy markup từ **DOM đã render** (`dom-<w>.html` của `snapshot.mjs`), không từ mã PHP, không từ file `.html` gốc của HTTrack khi trang có JS.
2. LUÔN giữ **nguyên văn** cây thẻ và **nguyên văn** class của bản gốc cho từng khối. Muốn đổi tên class thì làm sau cùng, khi `compare` đã đạt (xem Pha 9).
3. LUÔN dùng CSS gốc qua `css-port.mjs` (gộp đúng thứ tự trên trang). Phần bạn tự viết thêm đặt ở `styles.css`, import **sau** file CSS gốc.
4. LUÔN đặt toàn bộ class của `<body>` gốc (trừ class sinh theo trình duyệt như `e--ua-*`, `rs-safari`, và class trạng thái như `modal-open`) lên **khung bao ngoài cùng** trong `layout.tsx`, render từ server: `<div className="body-wrapper <class của body gốc>">`. Theme không gắn class lên `<body>` được.
5. LUÔN tải font, ảnh, icon về `assets/` của theme. Thứ gì còn nạp từ host ngoài phải khai trong `theme.json › csp`.
6. LUÔN lấy link từ dữ liệu CMS: `post.link`, `term.link`, menu `getMenu()`, đường dẫn cửa hàng `getPlugin("ecomcx-ecommerce").getPaths()/getUrls()` hoặc `window.ecomcx.paths`.
7. LUÔN đưa chữ và ảnh của bản gốc vào **trường ACF** (có `defaultValue` bằng nội dung gốc), menu, bài/trang/sản phẩm thật, hoặc `locales/*.json`. Code chỉ chứa markup.
8. LUÔN chụp và so ở **cả 3 độ rộng** 1920, 1440, 390.
9. LUÔN chạy `audit.mjs` rồi `compare.mjs` trước khi báo xong. Chỉ được nói "xong" khi `compare` in **ĐẠT**, hoặc khi bạn liệt kê rõ phần còn lệch và lý do không sửa được.

**KHÔNG BAO GIỜ**
1. KHÔNG viết lại CSS gốc bằng Tailwind, CSS module, styled-components, hay "cho gọn".
2. KHÔNG mở bản gốc bằng `file://` (font, CORS, AJAX hỏng). Dùng `serve.mjs`.
3. KHÔNG thêm class lên `body`/`html` bằng JS cho kiểu trang/bố cục. Trang sẽ nháy sai kiểu lúc tải.
4. KHÔNG dùng jQuery hay chép file JS gốc vào theme. Viết lại hành vi trong component `"use client"` (xem `reference/jsx.md`).
5. KHÔNG gõ cứng `/cart`, `/checkout`, `/product/`, `/products`, `/shop`. Đường dẫn do chủ shop đặt và theo ngôn ngữ.
6. KHÔNG đọc/ghi `localStorage` của giỏ hàng. Dùng `window.ecomcx.cart.*`.
7. KHÔNG thêm trang, kiểu, hiệu ứng mà bản gốc không có, và không bỏ khối nào bản gốc có.
8. KHÔNG để `<img data-src>` mà không có `src`. Lazyload của bản gốc không chạy trong theme.
9. KHÔNG tạo thư mục con trong `templates/`.
10. KHÔNG sửa nhiều thứ một lượt rồi mới so. Mỗi vòng sửa đúng vấn đề lớn nhất trong báo cáo, rồi so lại.
11. KHÔNG sửa core CMS, SDK hay plugin để theme chạy được. Thiếu gì thì ghi vào báo cáo cuối.

---

## Pha 0 — Xác định đầu vào và phạm vi

1. Đầu vào là một trong các loại:
   - **URL** site đang chạy.
   - **Thư mục HTTrack** (có `hts-cache/`), có thể kèm URL gốc.
   - **Thư mục HTML/zip** tải về.
   - **Repo React/Next/Vue**: chạy repo lên (`npm run dev`/`build && start`) rồi coi như URL.
2. Tên theme và slug: lấy từ câu lệnh; không có thì dùng tên site, slug viết thường có gạch ngang.
3. **Danh sách trang cần làm.** Người dùng nói rõ thì làm đúng danh sách đó, không thêm. Không nói thì lấy các trang có trong menu chính của bản gốc, cộng các loại trang sau nếu site có:
   - trang chủ;
   - danh sách bài và chi tiết bài;
   - danh sách sản phẩm và chi tiết sản phẩm;
   - giỏ hàng và thanh toán;
   - tìm kiếm;
   - 404.

   Theme bản gốc có nhiều kiểu trang chủ (Home 1, Home 2…) thì chỉ làm kiểu người dùng chọn. Họ chưa chọn thì hỏi **một câu duy nhất**, rồi làm tiếp.
4. Chỉ chuyển site mà người dùng có quyền dùng: theme đã mua bản quyền, site của họ hoặc của khách họ.
5. Ghi `port/PLAN.md` (trong thư mục theme), gồm: đầu vào, slug, danh sách trang theo bảng `URL gốc | template Ecomweb | trạng thái`.

## Pha 1 — Chuẩn bị công cụ

```bash
cd $SKILL/scripts && npm install && npm run setup      # Playwright + Chromium, một lần
npm test                                                # phải in "selftest: ĐẠT"
npx @ecomcx/create-ecomweb theme "<Tên theme>"          # tạo khung theme, rồi cd vào thư mục đó
npx @ecomcx/create-ecomweb env up --dev                 # CMS thử bằng Docker, gắn thẳng thư mục theme (in ra địa chỉ + tài khoản)
```
Không có Docker: dùng CMS người dùng đưa, chạy `create-ecomweb login --url <site> --token <cmsp_…>` rồi `create-ecomweb dev`.

## Pha 2 — Chụp bản gốc

**Nếu đầu vào là HTTrack:**
```bash
node $SKILL/scripts/httrack-map.mjs <thư-mục-httrack>        # map.json: file trên máy ↔ URL gốc, danh sách file thiếu
node $SKILL/scripts/serve.mjs <thư-mục-httrack> --port 8899  # để chạy nền
```
URL để chụp là `http://127.0.0.1:8899/<đường dẫn của "trang đầu" mà httrack-map in ra>`. Site gốc còn sống thì chụp **cả hai**. Bản HTTrack thiếu gì so với site gốc là lỗi của HTTrack, không phải của theme.

**Mỗi trang trong PLAN.md:**
```bash
node $SKILL/scripts/snapshot.mjs <url-trang> port/orig/<tên-trang>
```
Đọc kết quả in ra và `meta.json`:
- `source`: loại nguồn. Mở đúng mục trong `reference/sources.md`.
- `body.class`: dùng cho Luật LUÔN 4.
- `failed`: request lỗi ở bản gốc. Ghi vào PLAN.md, đừng đuổi theo.
- `lazyImagesLeft` > 0: chụp lại với `--wait 4000`.
- `scripts`: danh sách hành vi JS cần làm lại (Pha 6).

## Pha 3 — Lập kế hoạch khối

Mở `port/orig/<trang>/dom-1920.html` và `shot-1920.png`. Chia trang thành **khối** theo chiều dọc: header, banner/hero, từng section, footer. Ghi vào PLAN.md một bảng cho mỗi trang:

| Khối | Selector gốc (phần tử ngoài cùng) | Component Ecomweb | Dữ liệu lấy từ đâu | Hành vi JS |
|---|---|---|---|---|
| Header | `header#header` | `components/layout/Header.tsx` | ACF logo, `getMenu("primary")`, đếm giỏ | menu dính, menu mobile |
| Hero | `.elementor-element-3a1f` | `components/sections/Hero.tsx` | ACF repeater `slides` | slider |
| Sản phẩm nổi bật | `.products` | `components/ecommerce/ProductGrid.tsx` | `getPosts({ type: "product" })` | — |

Header, footer và thẻ sản phẩm dùng chung cho mọi trang: viết **một lần**.

## Pha 4 — CSS và token

```bash
node $SKILL/scripts/css-port.mjs port/orig/<trang-chủ> .         # ghi assets/css/source.css + assets/files/*
```
- Trang khác có stylesheet riêng (Elementor sinh `post-<id>.css` theo trang): chạy lại với `--name page-<tên>` cho trang đó, rồi import file đó **trong template của trang**.
- Đọc `assets/css/source.report.json`: `missing` phải rỗng. File thiếu thì lấy từ site gốc hoặc từ `map.json` của HTTrack.
- `layout.tsx` import theo thứ tự: `./assets/css/source.css` rồi `./styles.css`.
- `theme.json › styles.colors` (`primary`, `accent`, `text`, `background`, `surface`, `muted`, `border`) và `styles.fonts` (`body`, `heading`): lấy từ computed style của bản gốc trong `meta.json › widths.1920.elements` (màu chữ của `main`, màu nút, nền, font `h1`…). Đây là token bắt buộc của core.
- Font Google: `css-port` đã tải về `assets/files`. Không còn `@import` hay link tới fonts.googleapis.com thì không cần khai `csp`.

## Pha 5 — Khung trang và markup

Làm theo `reference/cms.md` (mục "Khung trang") và `reference/jsx.md`. Thứ tự:
1. `layout.tsx`:
   - khung bao mang class của body gốc;
   - header bọc `<EditableRegion name="header">`, `<main>{children}</main>`, footer bọc `<EditableRegion name="footer">`;
   - giữ các phần tử cấp body của bản gốc (nút lên đầu trang, khung quick view, overlay menu mobile).
2. Header và footer. Chụp và so ngay (Pha 8, chỉ trang chủ) trước khi làm tiếp. Header lệch thì mọi trang đều lệch.
3. Từng template theo PLAN.md: file trong `templates/` chỉ gọi component. Markup thật nằm trong `components/`.
4. Với mỗi khối: chép đoạn HTML từ `dom-1920.html` (phần tử ngoài cùng tới hết), đổi sang JSX theo `reference/jsx.md`, rồi **thay nội dung demo bằng dữ liệu** (Pha 7). Không đổi thẻ, không đổi class, không thêm wrapper.

## Pha 6 — Hành vi JS

Liệt kê hành vi từ `meta.json › scripts` và từ việc bấm thử bản gốc: slider, tab, accordion, menu dính, menu mobile, mega menu, popup, quick view, đếm ngược, đếm số, hiệu ứng xuất hiện khi cuộn, lightbox, nút lên đầu, lọc sản phẩm, thêm giỏ, wishlist.
Mỗi hành vi là một component `"use client"`, hoặc một mục trong `components/layout/Behavior.tsx` cho hành vi toàn trang. Công thức cụ thể ở `reference/jsx.md`. Hành vi phải:
- chạy lại khi chuyển trang mà không tải lại (dùng `useEffect` theo `usePathname()`, hoặc `MutationObserver`);
- dừng chuyển động khi `prefers-reduced-motion`;
- không cần jQuery.

## Pha 7 — Dữ liệu và nội dung

Theo `reference/cms.md`:
- **Chữ và ảnh của khối:** trường ACF trong `acf.json`. Khóa đặt `<slug>_<khối>_<tên>`, `defaultValue` = nội dung gốc, ảnh gốc chép vào `assets/` làm mặc định.
- **Danh sách lặp** (slide, đối tác, câu hỏi, đội ngũ): trường `repeater`.
- **Menu:** khai `menuLocations` trong `theme.json` và lấy bằng `getMenu("primary")`. Giữ markup `<ul>/<li>` của bản gốc.
- **Bài, trang, sản phẩm, danh mục:** `getPosts`, `getPost`, `getTerms` và `data` của template. Giá và giỏ lấy từ plugin `ecomcx-ecommerce`.
- **Trang tĩnh** (about, contact, faq): `pageTemplates` + `pages` trong `theme.json`, đặt `locked: true` khi theme vẽ toàn bộ trang.
- **Chữ giao diện** ("Thêm vào giỏ", "Xem thêm"): `locales/en.json` + `vi.json`, dùng `getT()` ở server và `useT()` ở client.
- **Form liên hệ:** plugin `ecx-contact-form`. Giữ markup và CSS bản gốc quanh form.

## Pha 8 — Kiểm và so (cửa qua bắt buộc)

```bash
node $SKILL/scripts/audit.mjs . --source-host <host bản gốc>     # sửa hết dòng LỖI
npx @ecomcx/create-ecomweb validate
# theme đang chạy ở CMS thử (Pha 1); nhập nội dung giống bản gốc (mặc định ACF đã có; tạo vài sản phẩm/bài như demo)
node $SKILL/scripts/snapshot.mjs <url-trang-trên-CMS-thử> port/clone/<tên-trang>
node $SKILL/scripts/compare.mjs port/orig/<tên-trang> port/clone/<tên-trang>
```
Đọc `port/clone/<trang>/compare/report.md`, rồi làm theo **vòng lặp**:
1. Lấy vấn đề lớn nhất theo thứ tự ưu tiên:
   - thanh cuộn ngang;
   - font thiếu;
   - request lỗi;
   - lỗi console;
   - phần tử "KHÔNG có ở bản theme";
   - chiều cao lệch > 50px;
   - vùng lệch nhiều nhất;
   - phần tử lệch hộp/style.
2. Tìm nguyên nhân bằng bảng "Lỗi hay gặp" dưới đây. Mở `diff-<w>.png` để thấy chỗ đỏ.
3. Sửa **một** nguyên nhân, chụp lại, so lại.
4. Dừng khi in **ĐẠT** ở mọi trang. Sau 10 vòng chưa đạt ở một trang: dừng trang đó, ghi phần còn lệch vào báo cáo.

Nội dung khác nhau (sản phẩm, ảnh, ngày tháng) làm % tăng mà không phải lỗi. Khi đó xét các vùng khung (header, footer, banner, lưới, thẻ) và danh sách phần tử lệch, rồi ghi rõ trong báo cáo vì sao chấp nhận. Có thể nâng ngưỡng bằng `--max-diff 15`, nhưng phải ghi lý do.

## Pha 9 — Đổi tên class (chỉ khi người dùng yêu cầu)

Chỉ làm khi `compare` đã đạt và người dùng muốn bỏ tên thương hiệu như `elementor-*`, `woocommerce-*`. Lập một bảng đổi tên duy nhất. Thay theo **từng token class nguyên vẹn** ở cả CSS lẫn TSX, không thay chuỗi con. Không đổi khóa dịch, khóa ACF, tên sự kiện. Chạy lại Pha 8 cho mọi trang.
Class trùng với tiền tố của core (`ecx-*`) hoặc plugin (`ec-*`) phải đổi ngay ở Pha 5, không chờ.

## Pha 10 — Báo cáo cuối

Trả lời người dùng ngắn gọn:
- Theme ở đâu, chạy thử ở đâu, lệnh đóng gói: `npx @ecomcx/create-ecomweb pack`.
- Bảng trang: `trang | % khác ở 1920/1440/390 | ĐẠT/CHƯA`.
- Những gì không làm được và lý do. Ví dụ: tính năng của plugin bên thứ ba không có trong Ecomweb, giỏ hàng Woo Blocks được thay bằng giao diện plugin bán hàng phủ CSS theo mẫu.
- Nội dung chủ shop cần nhập: ACF nào, menu nào, trang nào.

---

## Lỗi hay gặp

| Dấu hiệu trong report | Nguyên nhân thường gặp | Sửa |
|---|---|---|
| Cả trang lệch font/màu/khoảng cách | Thiếu class body trên khung bao, hoặc CSS import sai thứ tự | Luật LUÔN 4; `source.css` trước `styles.css` |
| Khối đúng chỗ nhưng sai kiểu | Thiếu một class tổ tiên (`elementor-page-123`, `woocommerce`, `layout-*`), hoặc thiếu CSS riêng của trang (`post-123.css`) | So chuỗi tổ tiên trong `dom-1920.html`; chạy `css-port --name page-x` |
| Icon thành ô vuông hoặc mất | Font icon (Font Awesome, WooCommerce, theme icons) không tải | `source.report.json › missing`; kiểm `url()` trỏ đúng `../files/` |
| "thiếu N font" | Font Google/local chưa tải về hoặc sai `font-family` | Chạy lại `css-port`, so `fonts` trong `meta.json` |
| Ảnh trống, chiều cao thấp hơn | Ảnh còn `data-src`, `srcset` trỏ host gốc, hoặc ảnh nền đặt bằng JS | Dùng `src` thật; ảnh nền đặt bằng `style` lúc render |
| Slider xếp dọc hoặc chồng nhau | Chưa làm hành vi slider, hoặc thiếu class sau khởi tạo (`slick-initialized`, `swiper-initialized`) | `reference/jsx.md` › Slider: thêm các class đó khi đã khởi tạo |
| Phần tử "KHÔNG có ở bản theme" | Khối bị bỏ sót, hoặc đã đổi class | Thêm khối; không đổi class (Luật LUÔN 2) |
| Có thanh cuộn ngang ở 390 | Phần tử rộng cố định, slider chưa khởi tạo, `100vw` + thanh cuộn | Tìm trong DevTools phần tử có `scrollWidth` > 390 |
| Header lệch xuống 32px khi đăng nhập | Thanh admin của CMS | `top: var(--cms-admin-bar, 0px)` cho header dính |
| Trang nháy sai kiểu lúc tải | Class trang được thêm bằng JS | Render class từ server trong `layout.tsx` |
| Lọc/phân trang nhảy lên đầu trang | Dùng `<a href>` tải lại cả trang | `<Link scroll={false}>` hoặc `router.replace(url, { scroll: false })` |
| Breadcrumb/URL sai (`/product` thay vì `/products`) | Ghép URL bằng tay | `post.link`, `term.link`, `getUrls()` |
| 404 ở trang tĩnh | Chưa khai `pages` trong `theme.json`, hoặc tên template không khớp file | `audit.mjs` báo; kiểm tên file |
| Lỗi hydration ở console | Markup server khác client (ngày giờ, random, `window` lúc render) | Tính phía client trong `useEffect` |
