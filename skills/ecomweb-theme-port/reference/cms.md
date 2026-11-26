# Ecomweb CMS cho người chuyển theme

Đủ để làm theme mà không cần biết trước gì về CMS. Chi tiết đầy đủ:
- API của SDK: `node_modules/@ecomcx/ecomweb-theme-sdk/API.md`
- Lệnh CLI: `npx @ecomcx/create-ecomweb` (không tham số) hoặc README của gói `@ecomcx/create-ecomweb`

Theme là một ứng dụng **Next.js (App Router) + React 19**, viết TypeScript. Core lo routing, dữ liệu, SEO, cache. Theme chỉ vẽ giao diện.
Mỗi template và layout là **Server Component** (async được, gọi API được). Component cần `useState`/`useEffect`/sự kiện trình duyệt thì đặt `"use client"` ở dòng đầu.

## Cấu trúc thư mục

```
<slug>/
├── theme.json        # bắt buộc: tên, slug, phiên bản, menu, trang, màu/font, csp
├── layout.tsx        # khung chung mọi trang (header, main, footer)
├── templates/        # PHẲNG, mỗi file một template theo thứ bậc (bắt buộc có index.tsx)
├── components/       # code thật: layout/, sections/, blog/, ecommerce/, forms/
├── lib/              # helper đọc ACF, dữ liệu
├── assets/css/       # source.css (CSS gốc do css-port gộp) + CSS riêng trang
├── assets/files/     # font, ảnh, icon do css-port tải về
├── styles.css        # CSS bổ sung của bạn (import SAU source.css)
├── acf.json          # trường tuỳ biến (plugin ecomcx-custom-fields)
├── locales/en.json   # chữ giao diện gốc; vi.json bản dịch
├── extend.tsx        # shortcode/slot/filter của theme (tuỳ chọn)
└── package.json      # dependency npm phải ghi phiên bản cụ thể ("swiper": "11.2.6")
```

## theme.json (mẫu cho theme chuyển từ site bán hàng)

```json
{
  "name": "Kidzone", "slug": "kidzone", "version": "1.0.0", "author": "…", "description": "%admin.theme.description%",
  "requires": { "cms": ">=1.40.0 <2.0.0", "plugins": { "ecomcx-custom-fields": ">=1.9.0" } },
  "suggests": { "plugins": { "ecomcx-ecommerce": ">=1.10.0", "ecx-contact-form": ">=1.0.0" } },
  "menuLocations": { "primary": "%admin.menu.primary%", "footer": "%admin.menu.footer%" },
  "supports": ["post-thumbnails", "custom-logo", "menus"],
  "imageSizes": { "kidzone-product": { "width": 600, "height": 600, "crop": true } },
  "styles": {
    "colors": { "primary": "#f44b88", "accent": "#ff266f", "text": "#888888", "background": "#ffffff", "surface": "#fff4f8", "muted": "#999999", "border": "#f1e4ea", "dark": "#222222" },
    "fonts": { "body": "Comfortaa, sans-serif", "heading": "Comfortaa, sans-serif" }
  },
  "pageTemplates": { "kidzone-about": "Kidzone – About" },
  "pages": [{ "slug": "about-us", "title": "About Us", "template": "kidzone-about", "locked": true }],
  "csp": { "frame-src": ["https://www.google.com", "https://www.youtube.com"] }
}
```
- `styles.colors`/`styles.fonts`: token **bắt buộc**. Core sinh biến `--ecx-color-<tên>`, `--ecx-font-family-<tên>`. Khối nội dung và CSS plugin dùng các biến này.
- `pageTemplates`: key = tên file trong `templates/` (không `.tsx`). Hiện ở ô "Template" khi sửa trang.
- `pages`: trang CMS tự tạo khi kích hoạt theme. `locked: true` = theme vẽ toàn bộ trang, người dùng chỉ sửa tiêu đề/SEO.
- `requires.plugins`: thiếu plugin thì không kích hoạt được. Theme dùng ACF thì phải yêu cầu `ecomcx-custom-fields`.
- `csp`: host ngoài theme được phép (`script-src`, `style-src`, `img-src`, `font-src`, `connect-src`, `frame-src`, `media-src`). Không nhận `*`, `https:`, `http://`. Ảnh/video `https:` đã được phép sẵn.
- Nhãn `"%khóa%"` dịch theo `locales/<mã>.json`.

## Thứ bậc template

Core dùng file **đầu tiên tồn tại** trong danh sách:

| Trang | Thứ tự |
|---|---|
| Trang chủ | `front-page` → `home` → `index` |
| Bài viết | `{template}` → `single-{type}-{slug}` → `single-{type}` → `single` → `singular` → `index` |
| Trang | `{template}` → `page-{slug}` → `page` → `singular` → `index` |
| Sản phẩm | `single-product` (plugin có sẵn; theme có file thì theme thắng) |
| Danh sách sản phẩm | `archive-product`, danh mục: `taxonomy-product_cat`, thẻ: `taxonomy-product_tag`, thương hiệu: `taxonomy-product_brand` |
| Chuyên mục / thẻ bài | `category-{slug}` → `category` → `archive` → `index` / `tag` → `archive` |
| Tác giả, ngày | `author`, `date` → `archive` → `index` |
| Tìm kiếm | `search` → `index` |
| Đăng nhập/đăng ký… | `login`/`register`/`forgot-password`/`reset-password` → `auth` → form có sẵn |
| 404 | `404` → `index` |

Trang `/cart`, `/checkout`, `/account` là trang thường có shortcode `[cart]`, `[checkout]`, `[account]` của plugin bán hàng. Template là `page` hoặc `page-{slug}`.

## Template

```tsx
// templates/single.tsx
import { PostContent, FeaturedImage, getT, type TemplateProps } from "@ecomcx/ecomweb-theme-sdk";
import PageBanner from "../components/layout/PageBanner";

export default async function Single({ data, site }: TemplateProps) {
  const t = await getT();
  const post = data.post!;
  return (<>
    <PageBanner title={post.title} />
    <article className="post-single"><FeaturedImage media={post.featuredMedia} size="large" /><PostContent post={post} /></article>
  </>);
}
```
`data` gồm: `kind` (`"single"`, `"archive"`, `"search"`, `"404"`…), `post`, `posts`, `term`, `author`, `page`, `totalPages`, `total`, `basePath`, `search`, `isPreview`.
Ở danh sách, `posts[].content` không gửi kèm (dùng `excerpt`).
Template không cần header/footer: `export const layout = false;`.

## Khung trang (layout.tsx)

```tsx
import "./assets/css/source.css";
import "./styles.css";
import { EditableRegion, getMenu, getClientMessages, type LayoutProps } from "@ecomcx/ecomweb-theme-sdk";
import { TranslationsProvider } from "@ecomcx/ecomweb-theme-sdk/client";
import Header from "./components/layout/Header";
import Footer from "./components/layout/Footer";
import Behavior from "./components/layout/Behavior";

export default async function Layout({ site, data, children }: LayoutProps) {
  const menu = await getMenu("primary").catch(() => null);
  const messages = await getClientMessages(["ui.", "shop.", "cart."]);   // khóa dịch gửi xuống client
  const single = data?.kind === "single" ? ` single single-${data.post?.type}` : "";
  return (
    <TranslationsProvider value={messages}>
      {/* class của <body> gốc, render từ server */}
      <div className={`body-wrapper home page-template elementor-kit-5${single}`}>
        <EditableRegion name="header" data={data}><Header menu={menu} site={site} /></EditableRegion>
        <main id="main">{children}</main>
        <EditableRegion name="footer" data={data}><Footer site={site} /></EditableRegion>
        <a id="back-to-top" href="#" />
        <Behavior />
      </div>
    </TranslationsProvider>
  );
}
```
- Class của body gốc thay đổi theo loại trang (`home`, `single-product`, `archive`, `woocommerce-page`…). Tính từ `data`, đừng chép cứng một bộ cho mọi trang.
- CSS theme được core bọc trong `:where(html[data-theme~="<slug>"])`, không tăng độ ưu tiên. Selector `html`, `body`, `:root` vẫn dùng được. Riêng `body.<class>` không khớp vì body không có class của bạn, nên `css-port` đã đổi sang `.body-wrapper.<class>`.
- Thanh admin (32px) hiện khi đăng nhập: `<html>` có `margin-top: 32px` và biến `--cms-admin-bar`. Header dính dùng `top: var(--cms-admin-bar, 0px)`.

## SDK hay dùng (`@ecomcx/ecomweb-theme-sdk`)

| Việc | Gọi |
|---|---|
| Danh sách bài/sản phẩm | `getPosts({ type: "product", perPage: 8, taxonomy: "product_cat", term: "do-choi", noTotal: true })` → `{ items, total, totalPages }` |
| Một bài | `getPost("product", slug)` / `getPostById(id)` (không có thì `null`) |
| Danh mục | `getTerms({ taxonomy: "product_cat", hideEmpty: false })` → `Term[]` (`name`, `slug`, `link`, `count`, `meta`) |
| Menu | `getMenu("primary")` → `{ items: MenuItem[] }` (`title`, `url`, `target`, `cssClass`, `children`) |
| Widget | `getWidgets("sidebar")`, `<WidgetArea id="sidebar" />` (khai `widgetAreas` trong theme.json) |
| Chữ dịch | server: `const t = await getT(); t("ui.read_more")`; client: `const t = useT()` (từ `@ecomcx/ecomweb-theme-sdk/client`) |
| Link nội bộ | `<Link href={post.link}>` (không tải lại trang); lọc/phân trang: `<Link scroll={false}>` |
| Ảnh | `<Img media={post.featuredMedia} size="kidzone-product" />` hoặc `<img src={post.featuredMedia?.url}>` giữ class gốc |
| Nội dung bài | `<PostContent post={post} />` |
| Phân trang | `<Pagination data={data} />` hoặc tự vẽ markup gốc từ `data.page`/`data.totalPages`/`data.basePath` |
| Tìm kiếm | `<SearchForm />` hoặc form GET `action="/"` name `s` |
| Đăng nhập | `LoginForm`, `RegisterForm`, `getCurrentUser()`, `useCurrentUser()` |
| Điều kiện | `isFrontPage(data)`, `isSingle(data)`, `isArchive(data)`, `isTax(data, "product_cat")`, `is404(data)` |
| Gọi plugin | server: `getPlugin<T>("ecomcx-ecommerce")` (trả `null` nếu plugin chưa bật), `pluginFetch("ecomcx-ecommerce", "/config")`; client: `pluginClient` |

Post: `id`, `title`, `slug`, `link`, `excerpt`, `featuredMedia { url, alt, width, height }`, `terms.product_cat[]`, `meta` (trường ACF của bài), `extra` (dữ liệu plugin).

## Trường tuỳ biến (ACF, plugin ecomcx-custom-fields)

`acf.json`:
```json
{
  "optionsPages": [{ "slug": "kidzone-home", "title": "Trang chủ", "description": "Nội dung các khối trang chủ", "position": 1 }],
  "groups": [{
    "id": "kidzone_home", "title": "KIDZONE – Trang chủ", "active": true,
    "rules": { "optionsPage": "kidzone-home" },
    "fields": [
      { "key": "kidzone_tab_hero", "label": "Banner", "type": "tab" },
      { "key": "kidzone_hero_title", "label": "Tiêu đề", "type": "text", "defaultValue": "Summer Sale" },
      { "key": "kidzone_hero_image", "label": "Ảnh", "type": "media" },
      { "key": "kidzone_hero_slides", "label": "Slide", "type": "repeater", "subFields": [
        { "key": "t01", "label": "Chữ", "type": "text" }, { "key": "i01", "label": "Ảnh", "type": "media" } ] }
    ]
  }]
}
```
- Loại trường: `text`, `textarea`, `number`, `checkbox`, `select`, `media` (`{ id, url }`), `url`, `repeater`, `tab`.
- Trường của **trang cài đặt** (optionsPage) đọc ở `site.extra.acf[key]`. Trường gắn vào bài/trang (rules theo post type/template) đọc ở `post.meta[key]`.
- Viết `lib/acf.ts` với `options(site)`, `str(v, fallback)`, `num(v, fallback)`, `url(media)`, `rows(repeater)`. Luôn có giá trị mặc định = nội dung gốc, để theme vừa cài đã giống bản gốc.
- Trang cài đặt: chia theo vùng như bản gốc, ví dụ "Thiết lập chung" (header, footer, mạng xã hội), "Trang chủ" (mỗi khối một tab), "Cửa hàng", "Blog", và mỗi trang tĩnh một trang cài đặt.
- Cài đặt đơn giản không cần ACF thì dùng `theme.json › settings` (form ở Giao diện › Tuỳ biến), đọc bằng `setting(settings, key, mặc định)`.

## Bán hàng (plugin ecomcx-ecommerce)

- Dữ liệu sản phẩm: `post.extra.commerce`, gồm:
  - giá: `priceFormatted`, `salePriceFormatted`, `price`, `salePrice` (số nguyên, đơn vị nhỏ nhất), `minPrice`/`maxPrice`, `prices`/`salePrices` (theo từng đồng tiền);
  - kho: `inStock`, `stock`, `sku`;
  - biến thể: `variants`, `defaultVariantId`;
  - khác: `gallery`, `dimensions`, `related`, `saleEndsAt`.
- Danh mục `product_cat`, thẻ `product_tag`, thương hiệu `product_brand`, bộ sưu tập `product_collection`.
- Trình duyệt: `window.ecomcx` có sau sự kiện `ecx:ready`.
  - `cart.add({ id, variantId, name, price }, qty)`, `cart.items()`, `cart.count()`, `cart.remove(key)`, `cart.quote()` (giá thật từ máy chủ).
  - `paths.cart`, `paths.checkout`.
  - Sự kiện `ecx:cart` khi giỏ đổi.
- Server: `const shop = await getPlugin("ecomcx-ecommerce")`, rồi `shop.getPaths()`, `shop.getUrls()`, `shop.formatPrice(minor, "VND", "vi")`. Trả `null` khi plugin chưa bật: kiểm `if (shop)` và ẩn nút giỏ.
- Trang giỏ và thanh toán:
  - Bản gốc vẽ bằng HTML thật: giữ markup gốc, dữ liệu lấy từ `cart.*`.
  - Bản gốc là WooCommerce Blocks (vẽ bằng JS, bản chụp chỉ có khung rỗng): dùng shortcode `[cart]`/`[checkout]` của plugin và viết CSS cho class `ec-*` của plugin để giống mẫu.
- Wishlist và so sánh (YITH…): plugin không có, theme tự làm bằng `localStorage` khóa riêng của theme (`<slug>_wishlist`).
- Không tự ghép URL sản phẩm hay danh mục. Chủ shop đổi được đường dẫn theo ngôn ngữ.

## Dịch chữ

- `locales/en.json` là gốc, `vi.json` là bản dịch. Khóa có nhóm: `ui.*`, `shop.*`, `cart.*`, `admin.*` (nhãn trong theme.json).
- Server: `getT()`. Client: `useT()`, với điều kiện layout đã gửi nhóm khóa qua `getClientMessages([...])`.
- Không đặt khóa trùng tên class (`add_to_wishlist`) vì đổi tên class hàng loạt sẽ đổi luôn khóa.

## Lệnh CLI

```bash
npx @ecomcx/create-ecomweb theme "Tên"        # tạo khung theme
npx @ecomcx/create-ecomweb validate           # kiểm theme.json, locales, token
npx @ecomcx/create-ecomweb env up --dev       # CMS thử bằng Docker, gắn thư mục theme
npx @ecomcx/create-ecomweb dev                # tự đóng gói + cài lại khi sửa file (site đã login)
npx @ecomcx/create-ecomweb login --url <site> --token cmsp_…
npx @ecomcx/create-ecomweb pack               # dist/<slug>-<version>.zip
npx @ecomcx/create-ecomweb deploy             # đóng gói + cài lên site
```
