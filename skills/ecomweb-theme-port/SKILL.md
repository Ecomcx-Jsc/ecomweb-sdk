---
name: ecomweb-theme-port
description: Clone any website (URL or HTTrack/HTML folder) into an Ecomweb CMS theme 1:1 — look AND motion — and propose Store plugins, asking the user before installing or writing any.
version: 2.0.0
author: Ecomcx
license: MIT
platforms: [macos, linux, windows]
metadata:
  hermes:
    tags: [Ecomweb, Ecomcx, Theme, Clone, WordPress, Elementor, WooCommerce, HTTrack, Nextjs]
    category: software-development
    related_skills: [ecomweb-cms-extensions]
---

# Chuyển website thành theme Ecomweb (giống 100%, cả hình lẫn chuyển động)

Skill này **thắng** mọi ghi chú khác về việc chuyển/clone theme (kể cả `ecomweb-cms-extensions/references/porting-wp-demo-1to1.md`). Chỗ nào khác nhau, làm theo skill này.

Người dùng chỉ cần MỘT câu:
- `chuyển https://demo.site.com thành theme "my-shop"`
- `chuyển thư mục ~/web/site (gốc https://demo.site.com/) thành theme my-shop`
- `làm lại theme ~/themes/my-shop cho giống https://demo.site.com` (theme đã chuyển nhưng còn lệch → mục **Chế độ sửa** cuối file)

Bạn làm hết các pha **theo đúng thứ tự**. Chỉ dừng ở 2 chỗ: **CỬA 1** (hỏi người dùng về plugin) và khi bị chặn thật sự.
`$SKILL` = thư mục chứa file này. Script ở `$SKILL/scripts`, component dựng sẵn ở `$SKILL/kit`.

Đọc khi tới pha cần dùng (đừng đọc trước):
- `reference/cms.md` — CMS Ecomweb: cấu trúc theme, SDK, ACF, body class, bán hàng, CLI
- `reference/kit.md` — component dựng sẵn (carousel Owl/Slick, dải chữ chạy, hiệu ứng cuộn, tab/accordion/menu, header dính, bộ đếm) + cách lấy thông số
- `reference/sources.md` — xử lý riêng từng loại nguồn (Elementor, Woo, RevSlider, Next…)
- `reference/jsx.md` — quy tắc HTML→JSX (html2jsx làm hộ) và thay nội dung demo bằng dữ liệu
- `reference/plugins.md` — cách hỏi người dùng về plugin, mẫu đặc tả plugin mới

**Ghi tiến độ:** sau mỗi pha, cập nhật `port/PROGRESS.md` (pha đã xong, file đã tạo, việc còn lại, câu trả lời của người dùng). Mất ngữ cảnh thì đọc lại file này rồi làm tiếp, không làm lại từ đầu.

---

## Luật tuyệt đối

Mỗi luật là một lỗi đã làm hỏng bản chuyển trước. Vi phạm một luật = bản chuyển lệch.

**LUÔN**
1. LUÔN lấy chuẩn so sánh từ **site gốc đang chạy** nếu còn sống. Bản HTTrack chỉ là kho file (thường thiếu font, chunk JS).
2. LUÔN chụp bằng `snapshot.mjs` (nó rê chuột/lăn chuột thật: nhiều theme hoãn JS tới lần thao tác đầu; thiếu bước này bản gốc chụp ra là slider CHƯA chạy).
3. LUÔN đổi markup bằng `html2jsx.mjs` từ DOM đã render. Không gõ lại markup bằng tay, không đọc mã PHP.
4. LUÔN giữ **nguyên văn** cây thẻ và class gốc. Không thêm class mới (`ecx-slider`, `ecx-active`…) cho thứ bản gốc đã có class.
5. LUÔN dùng CSS gốc qua `css-port.mjs`. Import trong `layout.tsx`: `./assets/css/source.css` TRƯỚC, `./styles.css` SAU CÙNG.
6. LUÔN làm hành vi bằng **kit** (`$SKILL/kit` chép vào `components/kit/`). Carousel Owl/Slick → `Carousel.tsx`, dải chữ chạy → `RunningLine.tsx`, hiệu ứng cuộn → `Reveal.tsx`, header dính / nút lên đầu → `ScrollClass.tsx`, tab/accordion/menu/popup → `Toggle.tsx`, bộ đếm → `CountUp.tsx`.
7. LUÔN lấy **thông số** hành vi (autoplay ms, thời lượng, số slide, margin, hiệu ứng vào/ra, offset cuộn) từ `motion.json`/`motion-report.md` của bản gốc + `data-*` + cấu hình trong JS gốc. Không đoán, không "cho đẹp".
8. LUÔN giữ class `<body>` gốc theo `meta.json › bodyClasses.keep`: class cố định của site → `filters["body.class"]` trong `extend.tsx`; class theo loại trang (`home`, `single-product`, `archive`…) → `className` của khung bao `.body-wrapper` trong `layout.tsx`, tính từ `data`, render từ server.
9. LUÔN đưa chữ/ảnh của khối vào ACF (mặc định = nội dung gốc), menu vào `getMenu()`, dữ liệu vào SDK/plugin. Code chỉ chứa markup.
10. LUÔN hỏi người dùng ở **CỬA 1** trước khi cài plugin, bỏ tính năng, hay viết plugin mới — và chờ trả lời.
11. LUÔN chạy đủ `audit.mjs`, `compare.mjs`, `motion.mjs compare` trước khi báo xong. "Xong" chỉ khi cả hai so sánh in **ĐẠT**, hoặc bạn liệt kê rõ phần còn lệch + lý do.

**KHÔNG BAO GIỜ**
1. KHÔNG viết lại CSS gốc (Tailwind, CSS module, "cho gọn"). KHÔNG tự viết `@keyframes`/transition cho hiệu ứng bản gốc đã có.
2. KHÔNG tự viết carousel/slider/marquee (timer + translate). Dùng kit.
3. KHÔNG gắn class trang lên `body` bằng script inline hay `useEffect` (trang nháy sai kiểu). Class trạng thái (`modal-open`) thì được.
4. KHÔNG dùng jQuery, KHÔNG chép file JS gốc vào theme.
5. KHÔNG mở bản gốc bằng `file://`. Dùng `serve.mjs`.
6. KHÔNG gõ cứng `/cart`, `/checkout`, `/product/…`, `/products`, `/shop`. Dùng `post.link`, `term.link`, `getUrls()`/`getPaths()`, `window.ecomcx.paths`.
7. KHÔNG đọc/ghi `localStorage` của giỏ/wishlist: `window.ecomcx.cart.*`, `window.ecomcx.wishlist.*`.
8. KHÔNG thêm trang/kiểu/hiệu ứng bản gốc không có; KHÔNG bỏ khối bản gốc có (trừ khi người dùng chọn "bỏ" ở CỬA 1).
9. KHÔNG tạo thư mục con trong `templates/`. KHÔNG để `port/`, `tools/` lọt vào gói (ghi vào `.ecomwebignore`).
10. KHÔNG sửa nhiều thứ một lượt rồi mới so. Mỗi vòng: sửa vấn đề đứng đầu báo cáo → đo lại.
11. KHÔNG sửa core CMS/SDK/plugin, KHÔNG tự viết plugin khi người dùng chưa đồng ý.

---

## Pha 0 — Đầu vào, phạm vi

1. Đầu vào: URL site đang chạy | thư mục HTTrack (có `hts-cache/`) ± URL gốc | thư mục HTML/zip | repo React/Next/Vue (chạy lên rồi coi như URL).
2. Slug theme: từ câu lệnh, không có thì từ tên site (chữ thường, gạch ngang).
3. Trang cần làm — **mỗi loại trang một trang** (bản gốc có Home 1…7 thì chỉ làm kiểu người dùng chọn; chưa chọn thì hỏi MỘT câu cùng lúc với CỬA 1 hoặc ngay đầu nếu bắt buộc):
   trang chủ · danh sách sản phẩm · chi tiết sản phẩm · giỏ · thanh toán · tài khoản/đăng nhập · danh sách bài · chi tiết bài · trang tĩnh có trong menu (about, contact, faq…) · tìm kiếm · 404.
4. Chỉ chuyển site người dùng có quyền dùng (theme đã mua, site của họ/khách của họ).
5. Ghi `port/PLAN.md`: đầu vào, URL chuẩn so sánh, slug, bảng `URL gốc | template Ecomweb | trạng thái`.

## Pha 1 — Công cụ, theme, CMS thử

```bash
cd $SKILL/scripts && npm install && npm run setup && npm test   # phải in 4 dòng ĐẠT
npx @ecomcx/create-ecomweb theme "<Tên theme>"                  # rồi cd vào thư mục theme
printf 'port/\ntools/\n' >> .ecomwebignore
mkdir -p components/kit && cp $SKILL/kit/*.tsx components/kit/
npx @ecomcx/create-ecomweb env up --dev                         # CMS thử bằng Docker, in địa chỉ + tài khoản
```
Không có Docker: dùng CMS người dùng đưa (`create-ecomweb login --url … --token cmsp_…` rồi `create-ecomweb dev`).

## Pha 2 — Chụp bản gốc (hình + chuyển động)

HTTrack: `node $SKILL/scripts/httrack-map.mjs <thư-mục>` (bảng file↔URL gốc, file thiếu) và `node $SKILL/scripts/serve.mjs <thư-mục> --port 8899` (chạy nền). Site gốc còn sống thì **chụp site gốc**.

Mỗi trang trong PLAN.md:
```bash
node $SKILL/scripts/snapshot.mjs <url> port/orig/<trang>
```
Trang chủ + mọi trang có slider/hiệu ứng:
```bash
node $SKILL/scripts/motion.mjs record <url> port/orig/<trang>/motion.json
```
Đọc kết quả `snapshot`: `nguồn` (mở mục tương ứng trong `reference/sources.md`), `class <body> phải giữ`, `carousel đã khởi tạo` (0 mà trang có slider → chụp lại với `--wait 5000`), request lỗi của bản gốc (ghi vào PLAN, đừng đuổi theo).

## Pha 3 — Tính năng và plugin → **CỬA 1: HỎI NGƯỜI DÙNG, DỪNG**

```bash
node $SKILL/scripts/features.mjs port/orig --cms <địa chỉ API của CMS thử, vd http://localhost:5120>
```
Nó ghi `port/FEATURES.md`: plugin trên Store nên cài (phiên bản, đã bật chưa), thứ làm bằng core/theme, và tính năng **chưa có plugin** kèm 3 lựa chọn (a) bỏ · (b) làm trong theme chỉ phần giao diện · (c) viết plugin mới.
1. Đọc lại `FEATURES.md`, sửa chỗ dò sai (vd chữ "compare" trong bài viết không phải tính năng so sánh).
2. Gửi người dùng **nguyên mục 1, 3 và 4** của `FEATURES.md` (+ câu hỏi kiểu trang chủ nếu có) — theo `reference/plugins.md`.
3. **DỪNG. Chờ trả lời.** Trong lúc chờ chỉ được làm Pha 4–6 cho phần KHÔNG phụ thuộc câu trả lời (CSS, khung, header/footer).
4. Ghi câu trả lời vào `port/PROGRESS.md`. Cài plugin người dùng đồng ý (admin › Plugin › Store, hoặc nhờ người dùng). Chọn (c) → Pha 10.

## Pha 4 — Kế hoạch khối + hành vi

Mở `port/orig/<trang>/dom-1920.html`, `shot-1920.png`, `motion-report.md` (tạo bằng `motion.mjs compare <gốc> <gốc>` nếu chưa có — mục "Thông số bản gốc"). Ghi vào PLAN.md mỗi trang một bảng:

| Khối | Selector gốc | Component | Dữ liệu | Hành vi (kit + thông số) |
|---|---|---|---|---|
| Hero | `.c-ip-slider` | `components/home/Hero.tsx` | ACF repeater `hero_slides` | `OwlCarousel items=1 loop autoplay autoplayTimeout=5000 animateIn="owl-fade-scale-in" animateOut="owl-fade-scale-out" dotsData` |
| Dải chữ | `.c-ip-running-line` | `components/home/RunningLine.tsx` | ACF repeater `running_items` | `RunningLine activeClass="c-ip-running-line--active" contentClassName="c-ip-running-line__content"` |

Header, footer, thẻ sản phẩm dùng chung: viết **một lần**. Thông số Owl/Slick không có trong `data-*` thì tìm trong JS gốc: `grep -o "owlCarousel({[^}]*}" <file js của theme>` (tra file bằng `map.json` của HTTrack hoặc `meta.json › scripts`).

## Pha 5 — CSS, token, body class

```bash
node $SKILL/scripts/css-port.mjs port/orig/<trang-chủ> .
```
- `assets/css/source.report.json › missing` phải rỗng (thiếu thì lấy từ site gốc / `map.json`).
- Trang có stylesheet riêng (Elementor `post-<id>.css`): `css-port port/orig/<trang> . --name page-<trang>` rồi import **trong template trang đó**.
- `layout.tsx`: `import "./assets/css/source.css";` … `import "./styles.css";` (sau cùng).
- Token `theme.json › styles.colors` (`primary, accent, text, background, surface, muted, border`) + `styles.fonts` (`body, heading`) từ computed style trong `meta.json`.
- Body class: theo Luật LUÔN 8 và `reference/cms.md › Class của <body>`.

## Pha 6 — Markup bằng html2jsx

Thứ tự: `layout.tsx` (khung) → header → footer → **chụp + so trang chủ ngay** (Pha 9 bước 2–4) → từng template.
```bash
node $SKILL/scripts/html2jsx.mjs port/orig/home/dom-1920.html --select "header.c-header" --out components/layout/Header.tsx --name Header
node $SKILL/scripts/html2jsx.mjs port/orig/home/dom-1920.html --select ".elementor-element-4012b7ba" --out components/home/Hero.tsx --name Hero
```
- Mỗi khối trong bảng Pha 4 = một lệnh (selector = phần tử ngoài cùng của khối). Ảnh được tải về `assets/media/` và import trong `<Tên>.media.ts`.
- Carousel đã được gỡ khung thư viện và đánh dấu `{/* KIT: … */}` → Pha 7.
- File trong `templates/` chỉ gọi component. Markup thật ở `components/`.
- Không sửa thẻ/class sau khi sinh. Chỉ thay nội dung (Pha 8) và bọc kit (Pha 7).

## Pha 7 — Hành vi bằng kit

Theo `reference/kit.md`. Với mỗi dấu `{/* KIT: … */}`: thay thẻ ngay dưới dấu bằng `<OwlCarousel as="div" className="<class gốc, đã bỏ owl-*>" …thông số>` (hoặc `SlickCarousel`), giữ nguyên các con (mỗi con = một slide), xoá dấu.
Hành vi toàn trang đặt một lần trong `layout.tsx`: `<Reveal />`, `<ScrollClass rules={…} />`, `<Toggle groups={…} />`.
Hành vi kit không có (zoom ảnh, kéo so sánh ảnh…) → component `"use client"` riêng, **chỉ đổi class/style như JS gốc** (xem class đổi trong `motion.json › blocks`).

## Pha 8 — Dữ liệu và nội dung

Theo `reference/cms.md` + `reference/jsx.md › Thay nội dung demo`:
- Chữ/ảnh của khối → ACF (`acf.json`), khoá `<slug>_<khối>_<tên>`, `defaultValue` = nội dung gốc, ảnh mặc định = `M.<khoá>` của file `.media.ts`.
- Danh sách lặp (slide, mục dải chữ, đối tác, câu hỏi) → `repeater`.
- Menu → `getMenu("primary")`, giữ `<ul>/<li>` gốc. Sản phẩm/bài/danh mục → `getPosts`/`getTerms`/`data` của template. Giá, giỏ, wishlist → plugin.
- Tính năng người dùng chọn (a) "bỏ" → xoá khối/nút đó khỏi markup và ghi vào báo cáo. Chọn (b) → làm phần giao diện, ghi rõ giới hạn.
- Chữ giao diện cố định → `locales/en.json` + `vi.json`.

## Pha 9 — Kiểm và so → **CỬA 2 (bắt buộc)**

```bash
node $SKILL/scripts/audit.mjs . --source-host <host gốc>            # sửa HẾT dòng LỖI
npx @ecomcx/create-ecomweb validate
# theme đang chạy trên CMS thử; nhập nội dung giống bản gốc (mặc định ACF đã có; tạo vài sản phẩm/bài như demo)
node $SKILL/scripts/snapshot.mjs <url-theme> port/clone/<trang>
node $SKILL/scripts/compare.mjs port/orig/<trang> port/clone/<trang>                 # hình
node $SKILL/scripts/motion.mjs record <url-theme> port/clone/<trang>/motion.json
node $SKILL/scripts/motion.mjs compare port/orig/<trang>/motion.json port/clone/<trang>/motion.json   # chuyển động
```
Vòng lặp: lấy vấn đề **đứng đầu** (thứ tự: LỖI audit → thanh cuộn ngang → font thiếu → request lỗi → lỗi console → `[thiếu hành vi]`/`[thiếu class]` → `[autoplay]`/`[animation]`/`[số bản]` → phần tử thiếu → chiều cao lệch > 50px → vùng lệch nhiều nhất → `[rê chuột]`/`[cuộn]`) → tra bảng **Lỗi hay gặp** → sửa MỘT nguyên nhân → đo lại. Dừng khi cả hai in **ĐẠT** cho mọi trang; 10 vòng chưa đạt ở một trang → ghi phần còn lệch vào báo cáo, sang trang khác.
Nội dung khác nhau (sản phẩm, ảnh) làm % ảnh tăng: xét vùng khung (header, footer, banner, lưới) + phần tử lệch; được nâng `--max-diff 15` nhưng phải ghi lý do.

## Pha 10 — Plugin mới (chỉ khi người dùng chọn (c))

Theo `reference/plugins.md`: viết `port/PLUGIN-<tên>.md` (đặc tả: chức năng, dữ liệu, API cho theme, admin, giới hạn, ước lượng) → gửi người dùng → **chờ duyệt** → mới viết (theo skill `ecomweb-cms-extensions` hoặc `npx @ecomcx/create-ecomweb plugin`). Theme gọi plugin qua API đã ghi trong đặc tả; plugin chưa xong thì theme ẩn phần đó (kiểm `getPlugin()`/`window.ecomcx`).

## Pha 11 — Báo cáo

Ngắn gọn cho người dùng: theme ở đâu, chạy thử ở đâu, `npx @ecomcx/create-ecomweb pack`; bảng `trang | % khác 1920/1440/390 | chuyển động | ĐẠT/CHƯA`; plugin đã cài; tính năng đã bỏ / làm một phần / chờ plugin; nội dung chủ shop cần nhập (ACF, menu, trang).

---

## Chế độ sửa (theme đã chuyển nhưng còn lệch)

Khi người dùng đưa một theme đã có và bản gốc:
1. Pha 2 cho bản gốc (snapshot + motion record) nếu `port/orig` chưa có hoặc được chụp bằng công cụ cũ (không có `meta.json › bodyClasses` → chụp lại).
2. Đo theme hiện tại: `audit.mjs`, `snapshot` + `compare`, `motion record` + `motion compare`. Ghi danh sách lỗi vào `port/DEFECTS.md` (mỗi dòng: trang, triệu chứng, selector, file sở hữu).
3. Pha 3 (CỬA 1) nếu chưa từng hỏi người dùng về plugin.
4. Sửa theo thứ tự (mỗi bước đo lại):
   1. `layout.tsx`: thứ tự import CSS; class body (extend.tsx + khung bao), bỏ script gắn class.
   2. Thay carousel/slider/marquee tự viết bằng kit: chạy lại `html2jsx` cho khối đó từ DOM gốc, bọc kit với thông số từ motion report. Xoá component + CSS tự chế cũ (`ecx-carousel`, keyframes tự viết) khi không còn ai dùng.
   3. Hiệu ứng cuộn/header/tab/menu → `Reveal`/`ScrollClass`/`Toggle`.
   4. Chữ/ảnh gõ cứng → ACF.
   5. Đường dẫn gõ cứng, dữ liệu → SDK/plugin.
5. Pha 9 tới khi ĐẠT, rồi Pha 11.

---

## Lỗi hay gặp

| Dấu hiệu | Nguyên nhân | Sửa |
|---|---|---|
| Cả trang sai font/màu/khoảng cách | Thiếu class body (`elementor-kit-*`, `h-ltr`, `woocommerce`…) hoặc import CSS sai thứ tự | Luật LUÔN 5, 8; `meta.json › bodyClasses.keep` |
| Bản gốc chụp ra slider chưa chạy, 0 carousel | Theme hoãn JS tới thao tác đầu; chụp bằng công cụ cũ | Chụp lại bằng `snapshot.mjs` mới, `--wait 5000` |
| `[thiếu class] … owl-carousel owl-loaded` | Khối không dùng kit (tự viết) hoặc đổi class gốc | Bọc `OwlCarousel` của kit, className = class gốc |
| `[autoplay] gốc 5000ms, theme 7000ms` | Đoán thông số | `autoplayTimeout` = số trong motion report |
| `[animation] scaleUpFrom … bản theme không có` | Thiếu `animateIn/animateOut` (class gốc gắn keyframes) | `animateIn="owl-fade-scale-in" animateOut="owl-fade-scale-out"` (tên class lấy từ `data-animation`/motion) |
| `[số bản] … gốc 6 bản, theme 1` | Dải chữ chạy không nhân đủ | `kit/RunningLine` |
| `[class tự chế] ecx-…` | Tự chế class thay cho class gốc | Bỏ, dùng class gốc + kit |
| `[cuộn] c-header--sticky ở 250px, theme 8600px` | Header dính sai offset/class | `ScrollClass` với offset + thứ tự class từ motion |
| `[rê chuột] … bản gốc đổi transform` | Thiếu class tổ tiên, hoặc markup thẻ khác bản gốc | So chuỗi tổ tiên trong dom; chạy lại html2jsx cho thẻ |
| Icon thành ô vuông | Font icon chưa tải | `source.report.json › missing` |
| Ảnh trống / chiều cao thấp | Ảnh còn `data-src` / srcset trỏ host gốc | html2jsx đã xử lý; kiểm `.media.ts` không còn URL gốc |
| Thanh cuộn ngang ở 390 | Slider chưa khởi tạo, phần tử rộng cố định | Kit; DevTools tìm phần tử `scrollWidth > 390` |
| Header lệch 32px khi đăng nhập | Thanh admin | `top: var(--cms-admin-bar, 0px)` |
| Lọc/phân trang nhảy lên đầu | `<a>` tải lại trang | `<Link scroll={false}>` |
| 404 trang tĩnh | Thiếu `pages`/`pageTemplates` hoặc tên file sai | `audit.mjs` báo |
| Lỗi hydration | Render khác nhau server/client (ngày giờ, random, `window`) | Tính trong `useEffect` |
| Cài theme lỗi 422 | Gói có `node:fs`, `process.env`, script/binary, hoặc `port/` lọt vào | `.ecomwebignore`; đọc `scan.findings[]` của phản hồi upload |
