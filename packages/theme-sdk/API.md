# API của @ecomcx/ecomweb-theme-sdk

Sinh tự động từ mã nguồn (`node scripts/api-docs.mjs`), không sửa tay. Hướng dẫn: `docs/theme-guide.md` của core.

## `@ecomcx/ecomweb-theme-sdk`

### Component

#### `ChangePasswordForm`

Đổi mật khẩu của thành viên đang đăng nhập (core ≥ 1.20.0); các thiết bị khác bị đăng xuất.

```ts
ChangePasswordForm({ labels }: { labels?: Partial<AuthLabels>; }): JSX.Element
```

#### `CommentForm`

fields: ô thêm của plugin (captcha…) — Comments của SDK truyền <Slot name="comment_form.fields" />. Ô name="extra.*" gửi kèm trong "extra".

```ts
CommentForm({ postId, parentId, labels, fields }: { postId: number; parentId?: number; labels?: Partial<CommentLabels>; fields?: ReactNode; }): JSX.Element
```

#### `CommentList`

Danh sách bình luận lồng nhau (render được cả ở server lẫn client).

```ts
CommentList({ comments, site, avatarSize, showDate }: { comments: Comment[]; site: DateSite; avatarSize?: number; showDate?: boolean; }): JSX.Element
```

#### `Comments`

Khu bình luận đầy đủ: danh sách đã duyệt (phân trang + "Xem thêm"), form gửi, ảnh đại diện — tương đương `comments_template`. Tự ẩn với bài có mật khẩu chưa mở khoá. Tự dựng theo ý mình: {@link getComments}, `<CommentList>`, `<CommentForm>`.

```ts
Comments({ post, title, perPage, order, avatarSize, showDate }: { post: Post; title?: string; perPage?: number; order?: "asc" | "desc"; avatarSize?: number; showDate?: boolean; }): Promise<JSX.Element | null>
```

#### `CommentsMore`

Nút "Xem thêm bình luận": tải các trang tiếp theo qua /api/cms/comments.

```ts
CommentsMore({ postId, totalPages, site, labels, perPage, order, avatarSize, showDate }: { postId: number; totalPages: number; site: DateSite; labels: { more: string; loading: string; error: string; }; perPage?: number; order?: "asc" | "desc"; avatarSize?: number; showDate?: boolean; }): JSX.Element
```

#### `DeleteAccountForm`

Thành viên tự xoá tài khoản (core ≥ 1.20.0): nhập lại mật khẩu và đánh dấu xác nhận. Tài khoản quản trị không xoá được ở đây. Xong thì đăng xuất và chuyển về <paramref name="redirectTo"/>.

```ts
DeleteAccountForm({ labels, redirectTo }: { labels?: Partial<AuthLabels>; redirectTo?: string; }): JSX.Element
```

#### `EditableRegion`

Vùng của theme: header, footer (vùng chuẩn của core — nên luôn bọc) và vùng hybrid khai báo ở theme.json › regions. Thứ tự: plugin thay vùng (definePlugin → regions) → bản sửa trong Trình dựng / `parts/{name}.json` → `children` (bản code của theme). `<EditableRegion name="header" data={data}><Header /></EditableRegion>`

```ts
EditableRegion({ name, data, className, children }: { name: string; data?: ResolveResult; className?: string; children?: ReactNode; }): Promise<JSX.Element>
```

#### `FeaturedImage`

`label`: tên của link khi ảnh chưa có alt (thường là tiêu đề bài) — không có thì trình đọc màn hình chỉ đọc "liên kết".

```ts
FeaturedImage({ media, size, className, link, label, sizes, priority }: { media?: Media | null; size?: string; className?: string; link?: string; label?: string; sizes?: string; priority?: boolean; }): JSX.Element | null
```

#### `ForgotPasswordForm`

Gửi email đặt lại mật khẩu (liên kết trỏ về /reset-password của website).

```ts
ForgotPasswordForm({ labels, paths, fields }: { labels?: Partial<AuthLabels>; paths?: Partial<AuthPaths>; fields?: ReactNode; }): JSX.Element
```

#### `Img`

Ảnh responsive: &lt;picture&gt; với WebP + ảnh gốc, srcset nhiều cỡ, width/height chống nhảy layout, object-position theo điểm lấy nét chọn trong thư viện media.

```ts
Img({ media, size, sizes, className, alt, priority, style }: ImgProps): JSX.Element | null
```

#### `LanguageSwitcher`

Nút chuyển ngôn ngữ. Đặt ở layout của theme. Ẩn khi site chỉ có một ngôn ngữ. Liên kết tới đúng bản dịch của trang hiện tại (đọc thẻ hreflang), không có thì về trang chủ ngôn ngữ đó.

```ts
LanguageSwitcher({ className, variant }: { className?: string; variant?: "list" | "select"; }): Promise<JSX.Element | null>
```

#### `Link`

Link chuyển trang không tải lại (bọc `next/link`); link ngoài, file, RSS tự dùng `<a>` thường. `activeClassName` gắn class khi URL hiện tại khớp (`matchNested`: khớp cả trang con). Prefetch mặc định tắt.

```ts
Link({ href, prefetch, activeClassName, matchNested, className, children, ...rest }: LinkProps): JSX.Element
```

#### `LoginForm`

fields: ô thêm của plugin (captcha…), thường là <Slot name="auth.login.fields" /> — template có sẵn của SDK tự truyền.

```ts
LoginForm({ redirectTo, labels, links, paths, fields }: { redirectTo?: string; labels?: Partial<AuthLabels>; links?: boolean; paths?: Partial<AuthPaths>; fields?: ReactNode; }): JSX.Element
```

#### `LoginOutLink`

Liên kết "Đăng nhập" / nút "Đăng xuất" theo phiên; kiểm ở client nên trang vẫn cache được. Đang tải → chưa hiện gì.

```ts
LoginOutLink({ loginHref, loginText, logoutText, className }: { loginHref: string; loginText: string; logoutText: string; className?: string; }): JSX.Element
```

#### `LogoutButton`

Nút đăng xuất: thu hồi phiên ở CMS, xoá cookie rồi chuyển về <paramref name="redirectTo"/>.

```ts
LogoutButton({ redirectTo, className, children }: { redirectTo?: string; className?: string; children?: ReactNode; }): JSX.Element
```

#### `Menu`

```ts
Menu({ location, menuId, currentPath, className, fallback }: { location?: string; menuId?: number; currentPath?: string; className?: string; fallback?: ReactNode; }): Promise<JSX.Element>
```

#### `NavToggle`

Nút ☰ của menu trên điện thoại: <details> gốc + Escape đóng menu và trả focus về nút.

```ts
NavToggle({ label, children, className }: { label: string; children: ReactNode; className?: string; }): JSX.Element
```

#### `Pagination`

`pageParam`: phân trang bằng tham số URL (?qpage=2) thay cho /page/2 — dùng cho khối Query nằm trong trang, không phải trang lưu trữ.

```ts
Pagination({ data, prevLabel, nextLabel, pageParam, type, midSize }: { data: ResolveResult; prevLabel?: string; nextLabel?: string; pageParam?: string; type?: "numbers" | "prevNext" | "both"; midSize?: number; }): Promise<JSX.Element | null>
```

#### `PluginForm`

Form tự sinh cho bảng EF của plugin có [PublicCreate] (form liên hệ, đặt lịch, đăng ký…): <PluginForm plugin="lien-he" table="messages" /> — hoặc shortcode [cms-form plugin="lien-he" table="messages"] Ô nhập, nhãn, ràng buộc lấy từ kiểu dữ liệu C# của plugin; máy chủ kiểm tra lại và giới hạn số lần gửi. Class CSS: cms-form, cms-form-field, cms-form-{kiểu}, form-error, form-success.

```ts
PluginForm({ plugin, table, submitLabel, className }: { plugin: string; table: string; submitLabel?: string; className?: string; }): Promise<JSX.Element | null>
```

#### `PostContent`

Render nội dung bài viết (định dạng của CMS —

```ts
PostContent({ post, content, className, page }: { post?: Post | null; content?: PostContentDoc | null; className?: string; page?: number; }): Promise<JSX.Element | null>
```

#### `PostDate`

Ngày đăng của bài trong thẻ `<time datetime>`, định dạng theo Cài đặt › Chung (xem {@link formatDate}) — tương đương `the_date`. Không truyền `site` thì tự đọc cấu hình của website (`getSite()`, có cache).

```ts
PostDate({ post, site }: { post: Post; site?: { dateFormat: string; timezone: string; locale?: string; }; }): Promise<JSX.Element>
```

#### `PostPasswordForm`

Form mật khẩu của bài được bảo vệ. Đúng mật khẩu → cookie httpOnly, tải lại nội dung trang.

```ts
PostPasswordForm({ postId, labels }: { postId: number; labels: { intro: string; label: string; submit: string; wrong: string; }; }): JSX.Element
```

#### `ProfileForm`

Sửa hồ sơ của thành viên đang đăng nhập (core ≥ 1.20.0): tên hiển thị, giới thiệu, email. Đổi email cần mật khẩu hiện tại. Đặt trong trang tài khoản của theme (vd template "account"); khách chưa đăng nhập thấy lời nhắn.

```ts
ProfileForm({ labels, fields, onSaved }: { labels?: Partial<AuthLabels>; fields?: ReactNode; onSaved?(user: CurrentUser): void; }): JSX.Element | null
```

#### `RegisterForm`

Đăng ký thành viên (chỉ khi quản trị viên bật "Ai cũng có thể đăng ký"). Vai trò = vai trò mặc định trong Cài đặt.

```ts
RegisterForm({ labels, links, paths, fields }: { labels?: Partial<AuthLabels>; links?: boolean; paths?: Partial<AuthPaths>; fields?: ReactNode; }): JSX.Element
```

#### `ResetPasswordForm`

Đặt mật khẩu mới từ liên kết trong email (?token=…).

```ts
ResetPasswordForm({ labels, paths }: { labels?: Partial<AuthLabels>; paths?: Partial<AuthPaths>; }): JSX.Element
```

#### `SearchForm`

Ô tìm kiếm — gửi về trang chủ của ngôn ngữ hiện tại (/?s= hoặc /en?s=).

```ts
SearchForm({ defaultValue, placeholder, buttonLabel, postType, showLabel, buttonPosition, buttonIcon, scopes, scopeType }: { scopes?: Array<{ value: string; label: string; }>; scopeType?: string; buttonIcon?: boolean; defaultValue?: string | null; placeholder?: string; buttonLabel?: string; postType?: string; showLabel?: boolean; buttonPosition?: "right" | "left" | "below"; }): Promise<JSX.Element>
```

#### `Slot`

Điểm cho plugin chèn nội dung (vd `before.content`, `body.end`) — tương đương `do_action` trong template. Mỗi plugin được bọc riêng: plugin lỗi thì phần đó ẩn, trang vẫn hiện.

```ts
Slot<P = any>({ name, data, props, fallback, className, }: { name: SlotName; data?: ResolveResult | null; props?: P; fallback?: ReactNode; className?: string; }): Promise<JSX.Element>
```

#### `TermLinks`

Danh sách link term (chuyên mục, thẻ), phân tách bằng `separator` — tương đương `the_category` / `the_tags`.

```ts
TermLinks({ terms, separator }: { terms?: Array<{ id: number; name: string; link: string; }>; separator?: string; }): JSX.Element | null
```

```tsx
<TermLinks terms={post.terms.category} />
```

#### `WidgetArea`

Vẽ các widget của một khu vực (`theme.json › widgetAreas`) — tương đương `dynamic_sidebar`. Khu vực trống → không vẽ gì.

```ts
WidgetArea({ id, className }: { id: string; className?: string; }): Promise<JSX.Element | null>
```

### Hàm

#### `applyFilters`

Chạy filter của các plugin/theme đang bật theo thứ tự, bỏ qua filter bị lỗi.

```ts
applyFilters<K extends keyof FilterMap>(name: K, value: Parameters<NonNullable<FilterMap[K]>>[0], ctx?: Parameters<NonNullable<FilterMap[K]>>[1], site?: Site): Promise<Parameters<NonNullable<FilterMap[K]>>[0]>
applyFilters<T = any>(name: string, value: T, ctx?: any, site?: Site): Promise<T>
```

#### `buildDocumentMetadata`

Metadata mặc định cho trang + cho plugin (vd SEO) sửa qua filter "document.metadata".

```ts
buildDocumentMetadata(data: ResolveResult, site: Site): Promise<DocumentMetadata>
```

#### `cmsFetch`

Gọi thẳng một endpoint của Public API (`/api/public/...`) khi SDK chưa có hàm riêng — lối thoát có cam kết cho theme / plugin. Ưu tiên các hàm `get*`. Lỗi → ném `CmsApiError` (`status` = mã HTTP). Kết quả được cache và gắn tag "cms" để revalidate khi nội dung thay đổi.

```ts
cmsFetch<T>(path: string, opts?: FetchOptions): Promise<T>
```

#### `consentDefault`

(Server) Mặc định của site khi khách CHƯA chọn — filter "consent.default", không có plugin banner → true. Không đọc cookie nên không làm mất cache trang; dùng cho phần không có JS (vd <noscript> của GTM).

```ts
consentDefault(category: ConsentCategory): Promise<boolean>
```

#### `cx`

Ghép class CSS, bỏ giá trị rỗng / false (như `clsx`).

```ts
cx(...classes: Array<string | false | null | undefined>): string
```

```tsx
cx("card", active && "is-active")
```

#### `defineBlock`

Khai báo một khối — dùng chung cho trình soạn (admin) và website: cùng một file định nghĩa, import ở cả hai phía. Chỉ là dữ liệu (không phụ thuộc trình soạn nào): trình soạn tự sinh node + form cài đặt + mục slash menu, website chuẩn hoá thuộc tính rồi đưa cho component hiển thị của plugin. Khối của plugin đã tắt: dữ liệu giữ nguyên.

```ts
defineBlock(input: BlockDefinitionInput): BlockDefinition
```

#### `definePlugin`

Dùng trong file entry của plugin/theme: export default definePlugin({...}).

```ts
definePlugin(def: PluginDefinition): PluginDefinition
```

#### `doAction`

Phát action tới các plugin/theme đang bật.

```ts
doAction(name: string, arg?: any, site?: Site): Promise<void>
```

#### `formatDate`

Định dạng một ngày theo cấu hình ngày của website (Cài đặt › Chung: `site.dateFormat`, `site.timezone`) — tương đương `date_i18n`. Token: `yyyy`, `MMMM` (tên tháng theo `site.locale`), `MM`, `dd`, `d`. Luôn truyền `site` (có trong `TemplateProps`): thiếu thì dùng `dd/MM/yyyy` + `Asia/Ho_Chi_Minh`, không theo cấu hình admin. Giá trị rỗng → `""`. Chạy được ở server và client.

```ts
formatDate(value: string | null | undefined, site?: Pick<Site, "dateFormat" | "timezone"> & { locale?: string; }): string
```

```tsx
formatDate(post.publishedAt, site) // "16/11/2026"
```

#### `getAdjacentPost` · từ 1.44.0

Bài liền trước (`"prev"`, đăng sớm hơn) hoặc liền sau (`"next"`) cùng loại nội dung (tương đương `get_adjacent_post`). `query` lọc thêm, vd cùng chuyên mục: `{ taxQuery: [{ taxonomy: "category", terms: [slug] }] }`. Không có → `null`.

```ts
getAdjacentPost(post: Pick<Post, "id" | "type" | "publishedAt">, direction: "prev" | "next", query?: Omit<PostQuery, "after" | "before" | "orderBy" | "order" | "perPage" | "page" | "offset">): Promise<Post | null>
```

```tsx
const [prev, next] = await Promise.all([getAdjacentPost(post, "prev"), getAdjacentPost(post, "next")]);
```

#### `getArchives`

Số bài theo tháng, mới nhất trước, kèm link trang lưu trữ (tương đương `wp_get_archives`).

```ts
getArchives(locale?: string): Promise<{ year: number; month: number; count: number; link: string; }[]>
```

#### `getAuthors`

Danh sách tác giả công khai (trang "Đội ngũ", danh bạ): mặc định thành viên có bài đã đăng; plugin mở rộng qua filter authors.query. Chỉ có tên, slug, ảnh, tiểu sử, meta công khai — không bao giờ có email.

```ts
getAuthors({ params, ...q }?: AuthorQuery): Promise<ListPage<Author>>
```

#### `getClientMessages`

Lấy các chuỗi cần cho component client (core ≥ 1.20.0) — chỉ khoá bắt đầu bằng một trong <paramref name="prefixes"/> (vd ["cart.", "auth."]) để không gửi cả từ điển xuống trình duyệt. Truyền kết quả vào <TranslationsProvider value={…}>.

```ts
getClientMessages(prefixes: string[]): Promise<ClientMessages>
```

#### `getComments`

Bình luận đã duyệt của một bài, theo trang → `{ items, total, count, page, totalPages }` (tương đương `get_comments`). Bài có mật khẩu: CMS chỉ trả bình luận khi có `unlock`.

```ts
getComments(postId: number, query?: CommentQuery): Promise<CommentPage>
/** @deprecated */ getComments(postId: number, page: number, unlock?: string, opts?: { perPage?: number; order?: "asc" | "desc"; }): Promise<CommentPage>
```

> Chữ ký cũ: Từ 2.0: dùng `getComments(postId, { page, unlock, perPage, order })`. Dạng tham số vị trí bị bỏ ở 3.0.

```tsx
const { items } = await getComments(post.id, { page: 2 });
```

#### `getCurrentUser`

Người đang đăng nhập trên website, null nếu là khách. Dùng trong Server Component, route, generateMetadata. Component client: dùng useCurrentUser() hoặc nhận qua props.

```ts
getCurrentUser(): Promise<CurrentUser | null>
```

#### `getFacets`

Đếm số bài theo từng giá trị (bộ lọc có số đếm: "Khoa CNTT (12)") trên đúng tập bài mà {@link getPosts} trả về với cùng điều kiện. `facets`: tên phân loại công khai ("category") và/hoặc `"meta:khoá"` (khoá khai báo `filterable`). Tối đa 5 facet × 100 giá trị, đếm trong PostgreSQL.

```ts
getFacets(facets: string[], query?: Omit<PostQuery, "page" | "perPage" | "withContent" | "orderBy" | "order" | "orderByMeta">): Promise<FacetResult>
```

```tsx
const { facets } = await getFacets(["khoa", "meta:hoc-ky"], { type: "khoa-hoc", taxQuery })
```

#### `getLanguages`

Ngôn ngữ đang bật của website và ngôn ngữ mặc định.

```ts
getLanguages(): Promise<{ defaultLocale: string; languages: Array<{ code: string; name: string; isDefault: boolean; flag?: string; }>; }>
```

#### `getMedia`

Danh sách media (thư viện ảnh, tài liệu tải về) — plugin giới hạn / mở rộng qua filter media.query.

```ts
getMedia({ params, ...q }?: MediaQuery): Promise<ListPage<Media>>
```

#### `getMenu`

Menu gắn ở một vị trí của theme (`theme.json › menuLocations`), ngôn ngữ của request (tương đương `wp_get_nav_menu_items` theo location). Chưa gắn menu → `null`. Vẽ sẵn: `<Menu location="primary" />`.

```ts
getMenu(location: string, locale?: string): Promise<Menu | null>
```

#### `getMenuById`

Menu theo id (khối Điều hướng chọn menu cụ thể). Không có → `null`.

```ts
getMenuById(id: number): Promise<Menu | null>
```

#### `getPattern`

Nội dung mẫu đồng bộ (khối syncedPattern). Mẫu đã xoá / chưa xuất bản → `null`; CMS lỗi → ném `CmsApiError`.

```ts
getPattern(id: number): Promise<PostContentDoc | null>
```

#### `getPlugin`

Hàm mà plugin đang bật công bố qua definePlugin({ exports }). null nếu plugin chưa cài/chưa bật — luôn kiểm tra: const shop = await getPlugin<ShopApi>("shop"); if (shop) cart = await shop.getCart(); Chỉ dùng phía server (Server Component, route, generateMetadata). Component client nhận dữ liệu qua props.

```ts
getPlugin<T = Record<string, unknown>>(slug: string, site?: Site): Promise<T | null>
```

#### `getPost`

Bài đã đăng theo loại nội dung + slug, ngôn ngữ của request hiện tại (tương đương `get_page_by_path`). Không có / chưa đăng → `null`. CMS lỗi → ném `CmsApiError`.

```ts
getPost(type: string, slug: string, locale?: string): Promise<Post | null>
```

```tsx
const about = await getPost("page", "gioi-thieu");
```

#### `getPostById` · từ 1.31.0

Bài đã đăng theo id (tương đương `get_post($id)`). Không có / chưa đăng → `null`. CMS lỗi → ném `CmsApiError`.

```ts
getPostById(id: number): Promise<Post | null>
```

#### `getPostIds` · từ 1.44.0

Chỉ lấy id bài (tương đương `WP_Query` với `fields => 'ids'`): cùng điều kiện như {@link getPosts}, máy chủ không dựng đối tượng bài.

```ts
getPostIds({ withContent: _w, ...q }?: PostQuery): Promise<{ items: number[]; total: number; page: number; totalPages: number; }>
```

#### `getPosts`

Danh sách bài đã đăng theo điều kiện (tương đương `WP_Query`). Mặc định không kèm nội dung đầy đủ (`withContent`). Trả `{ items, total, page, totalPages }`; `noTotal: true` bỏ bước đếm tổng.

```ts
getPosts({ withContent, ...q }?: PostQuery): Promise<{ items: Post[]; total: number; page: number; totalPages: number; }>
```

```tsx
const { items } = await getPosts({ type: "post", taxQuery: [{ taxonomy: "category", terms: ["tin-tuc"] }], perPage: 6 });
```

#### `getPreference`

Đọc tuỳ chọn ở Server Component (layout/template).

```ts
getPreference(key: string): Promise<string | undefined>
```

#### `getRequestLocale`

Ngôn ngữ của request hiện tại (undefined = ngôn ngữ mặc định của site).

```ts
getRequestLocale(): Promise<string | undefined>
```

#### `getSite`

Thông tin site theo ngôn ngữ của request (hoặc locale truyền vào).

```ts
getSite(locale?: string): Promise<Site>
```

#### `getT`

Hàm dịch phía server theo ngôn ngữ của request: chữ của theme / plugin (`locales/*.json`), cú pháp ICU — tương đương `__()`.

```ts
getT(): Promise<Translator>
```

```tsx
const t = await getT(); t("readMore"); t("comments.count", { count: 3 })
```

#### `getTerms`

Mọi term của một phân loại (không phân trang), ngôn ngữ của request (tương đương `get_terms`). `hideEmpty` mặc định `true` = bỏ term chưa có bài. Cần lọc / phân trang / sắp xếp → {@link queryTerms}.

```ts
getTerms(query: { taxonomy: string; hideEmpty?: boolean; locale?: string; }): Promise<Term[]>
/** @deprecated */ getTerms(taxonomy: string, hideEmpty?: boolean, locale?: string): Promise<Term[]>
```

> Chữ ký cũ: Từ 2.0: dùng `getTerms({ taxonomy, hideEmpty, locale })`. Dạng tham số vị trí bị bỏ ở 3.0.

```tsx
const cats = await getTerms({ taxonomy: "category" });
```

#### `getThemeSettings`

Lấy giá trị Customizer của theme đang active.

```ts
getThemeSettings(): Promise<JsonObject>
```

#### `getWidgets`

Widget trong một khu vực (`theme.json › widgetAreas`), theo thứ tự. Vẽ sẵn: `<WidgetArea id="sidebar" />`.

```ts
getWidgets(area: string, locale?: string): Promise<WidgetInstance[]>
```

#### `hasPlugin`

Plugin có đang bật không.

```ts
hasPlugin(slug: string, site?: Site): Promise<boolean>
```

#### `imageCandidates`

Các cỡ ảnh dùng cho srcset: cỡ được chọn + mọi cỡ cùng tỉ lệ (không bị cắt) nhỏ hơn, để trình duyệt tự chọn file vừa đủ cho màn hình.

```ts
imageCandidates(media: Media, size?: string): MediaSize[]
```

#### `is404`

Trang không tìm thấy — `is_404`.

```ts
is404(data: Page): boolean
```

#### `isArchive`

Mọi trang lưu trữ: chuyên mục, thẻ, phân loại, tác giả, ngày, lưu trữ theo loại nội dung — `is_archive`.

```ts
isArchive(data: Page): boolean
```

#### `isAuthor`

Trang tác giả — `is_author`.

```ts
isAuthor(data: Page): boolean
```

#### `isCategory`

Trang chuyên mục; `slug` để kiểm tra chuyên mục cụ thể — `is_category`.

```ts
isCategory(data: Page, slug?: string): boolean
```

#### `isDate`

Trang lưu trữ theo ngày — `is_date`.

```ts
isDate(data: Page): boolean
```

#### `isFrontPage`

Trang chủ của website, dạng bài mới hoặc trang tĩnh — `is_front_page`.

```ts
isFrontPage(data: Page): boolean
```

#### `isHome`

Danh sách bài của blog — `is_home`: trang chủ dạng bài mới, hoặc trang được chọn làm "Trang bài viết" (Cài đặt › Đọc).

```ts
isHome(data: Page): boolean
```

#### `isInternalHref`

`true` nếu link là trang của website (chuyển trang không tải lại); file, feed, API, link ngoài → `false`.

```ts
isInternalHref(href: string): boolean
```

#### `isPage`

Trang tĩnh; `slug` để kiểm tra trang cụ thể, vd `isPage(data, "lien-he")` — `is_page`.

```ts
isPage(data: Page, slug?: string): boolean
```

#### `isSearch`

Trang kết quả tìm kiếm — `is_search`.

```ts
isSearch(data: Page): boolean
```

#### `isSingle`

Một bài (không phải trang tĩnh); `type` để kiểm tra loại nội dung, vd `isSingle(data, "product")` — `is_single` / `is_singular($type)`.

```ts
isSingle(data: Page, type?: string): boolean
```

#### `isSingular`

Bài hoặc trang tĩnh (có `data.post`) — `is_singular`.

```ts
isSingular(data: Page): boolean
```

#### `isTag`

Trang thẻ; `slug` để kiểm tra thẻ cụ thể — `is_tag`.

```ts
isTag(data: Page, slug?: string): boolean
```

#### `isTax`

Trang của phân loại tuỳ biến; `taxonomy` để kiểm tra phân loại cụ thể — `is_tax`.

```ts
isTax(data: Page, taxonomy?: string): boolean
```

#### `localeHref`

Đường dẫn có tiền tố ngôn ngữ: localeHref(site, "/author/an") → "/en/author/an" khi đang ở tiếng Anh.

```ts
localeHref(site: { locale: string; defaultLocale: string; }, path: string): string
```

#### `pageLink`

Đường dẫn trang thứ `page` của một danh sách (`/tin-tuc/page/2`), giữ từ khoá tìm kiếm nếu có. Trang 1 → đường dẫn gốc. Danh sách có bộ lọc khác → {@link pageLinkWithQuery}.

```ts
pageLink(basePath: string, page: number, search?: string | null): string
```

#### `pageLinkWithQuery`

Link của một trang trong danh sách CÓ bộ lọc: giữ nguyên mọi tham số truy vấn hiện có (phòng ban, mức lương, từ khoá…) và chỉ đổi số trang. Truyền `data.query` của trang vào. <Link href={pageLinkWithQuery(data.basePath, 2, data.query)}>2</Link>

```ts
pageLinkWithQuery(basePath: string, page: number, query?: Record<string, string> | null): string
```

#### `pluginFetch`

Gọi endpoint public của plugin khi render trên server: pluginFetch("ecomcx-seo", "/sitemap/news"). Cache theo tag "cms" (+ tags) như dữ liệu khác của CMS; noStore để luôn lấy mới. asUser: gửi kèm phiên của người đang xem (endpoint nhận ICurrentUser) — luôn không cache: pluginFetch("shop", "/cart", { asUser: true }).

```ts
pluginFetch<T>(slug: string, path: string, opts?: FetchOptions): Promise<T>
```

#### `queryTerms`

Danh sách term có phân trang, lọc theo cha / từ khoá / meta, sắp xếp — bản đầy đủ của {@link getTerms}.

```ts
queryTerms({ params, ...q }: TermQuery): Promise<ListPage<Term>>
```

#### `requestUnlock`

Cookie mở khoá bài có mật khẩu của request hiện tại (server component); ngoài request → undefined.

```ts
requestUnlock(): Promise<string | undefined>
```

#### `requireUser`

Bắt buộc đăng nhập: khách bị chuyển tới /login, đăng nhập xong quay lại <paramref name="returnTo"/>. const user = await requireUser("/account");

```ts
requireUser(returnTo?: string): Promise<CurrentUser>
```

#### `safeRedirect`

Chỉ nhận đường dẫn nội bộ ("/account") — chặn chuyển hướng ra trang ngoài (?redirect=https://lừa-đảo). Trình duyệt bỏ tab / xuống dòng và coi "\" như "/" khi phân tích URL, nên "/<TAB>/evil.com" hay "/\evil.com" thành "//evil.com": chặn mọi ký tự điều khiển và dấu "\" ở bất kỳ vị trí nào, không chỉ ở đầu.

```ts
safeRedirect(target: string | null | undefined, fallback?: string): string
```

#### `setting`

Đọc một giá trị Tuỳ biến của theme (`theme.json › settings`) từ `settings` của `TemplateProps` / `LayoutProps`, kèm giá trị dự phòng (tương đương `get_theme_mod`). Rỗng / chưa đặt → `fallback`. Không gọi mạng.

```ts
setting<T = string>(settings: Record<string, unknown>, key: string, fallback: T): T
```

```tsx
setting(settings, "showComments", true)
```

#### `useCurrentUser`

Người đang đăng nhập, dùng trong component client (null = khách, undefined = đang tải). Server Component nên dùng getCurrentUser() để khỏi tốn thêm một request.

```ts
useCurrentUser(): CurrentUser | null | undefined
```

#### `userCan`

Người dùng có quyền này không — current_user_can().

```ts
userCan(user: CurrentUser | null | undefined, capability: string): boolean
```

### Class

#### `CmsApiError`

Lỗi khi gọi Public API của CMS. `status` = mã HTTP (0 = lỗi mạng / hết thời gian chờ).

```ts
class CmsApiError
```

#### `ExtensionBoundary`

```ts
class ExtensionBoundary
```

### Hằng

#### `AUTH_LABELS`

```ts
const AUTH_LABELS: { login: string; password: string; submitLogin: string; code: string; verify: string; userName: string; email: string; displayName: string; submitRegister: string; submitForgot: string; newPassword: string; submitReset: string; sending: string; error: string; logout: string; noAccount: string; register: string; forgot: string; haveAccount: string; login2: string; registerClosed: string; missingToken: string; bio: string; currentPassword: string; currentPasswordForEmail: string; submitProfile: string; submitPassword: string; notSignedIn: string; deleteWarning: string; deleteConfirm: string; submitDelete: string; }
```

#### `AUTH_PATHS`

```ts
const AUTH_PATHS: AuthPaths
```

#### `BINDABLE`

Thuộc tính gắn được của khối lõi: tên trong bindings → nơi đặt giá trị.

```ts
const BINDABLE: Record<string, readonly string[]>
```

#### `BUILTIN_PAGE_TEMPLATES`

Tên template trang có sẵn (theme có template cùng tên thì dùng của theme).

```ts
const BUILTIN_PAGE_TEMPLATES: readonly ["canvas", "full-width", "landing"]
```

#### `BUILTIN_STRINGS`

Chữ mặc định của các component trong SDK (theme có thể ghi đè trong locales/{code}.json).

```ts
const BUILTIN_STRINGS: Record<string, Record<string, string>>
```

#### `CONSENT_CATEGORIES`

Consent API (như WP Consent API): hợp đồng chung giữa plugin hỏi khách (banner cookie) và plugin cần biết câu trả lời (analytics, pixel, widget chat, video nhúng…). Core không có banner, không chọn optin/optout thay ai — chỉ là API. Lựa chọn của khách chỉ đọc ở TRÌNH DUYỆT: HTML giống nhau cho mọi khách → trang cache được (không đọc cookie lúc render). Bên hỏi (trình duyệt): hasConsent("statistics") / getConsent() từ "@ecomcx/ecomweb-theme-sdk/client"; on("consent.changed", …) để nạp script khi khách vừa cho phép. Plugin banner: setConsent([...]) ở trình duyệt; mặc định khi khách chưa chọn khai ở 2 chỗ (cùng một cài đặt của site): <meta name="cms-consent" content="optin"> trong <head> (trình duyệt đọc) và filter "consent.default" (server, vd quyết định có in <noscript> theo dõi hay không). Chưa có plugin banner → mọi nhóm được phép (website chạy như trước).

```ts
const CONSENT_CATEGORIES: readonly ["functional", "preferences", "statistics", "statistics-anonymous", "marketing"]
```

#### `CONSENT_META`

<meta name="cms-consent" content="optin|optout">: plugin banner khai mặc định cho trình duyệt.

```ts
const CONSENT_META: "cms-consent"
```

#### `CORE_BINDING_SOURCES`

```ts
const CORE_BINDING_SOURCES: Record<string, BindingSource>
```

#### `LOCALE_HEADER`

Header do proxy.ts của frontend gắn vào request: mã ngôn ngữ lấy từ tiền tố URL (/en/...).

```ts
const LOCALE_HEADER: "x-cms-locale"
```

### Kiểu

#### `AuthLabels`

```ts
type AuthLabels = typeof AUTH_LABELS;
```

#### `Author`

```ts
interface Author { id: number; name: string; slug: string; avatarUrl?: string | null; bio?: string | null; /** Meta công khai của thành viên (plugin khai báo `UserMeta` Public), vd `{ khoa: "cntt" }`. */ meta?: JsonObject; /** Số bài đã đăng — chỉ có trong danh sách {@link getAuthors}. */ postCount?: number | null; /** Dữ liệu plugin thêm qua filter api.author.response. */ extra?: JsonObject; }
```

#### `AuthorQuery`

```ts
interface AuthorQuery { locale?: string; /** Tìm theo tên hiển thị, không phân biệt dấu. */ search?: string; include?: number[]; exclude?: number[]; /** Lọc theo meta công khai (khoá khai báo `UserMeta` Public), vd metaKey "khoa". Khoá không công khai → 422. */ metaKey?: string; metaValue?: string; orderBy?: "name" | "post_count" | "id"; order?: "asc" | "desc"; /** perPage 1–100 (mặc định 20). */ page?: number; perPage?: number; /** Tham số thêm cho plugin (filter authors.query), vd plugin danh bạ thêm vai trò "giang-vien". */ params?: Record<string, string>; }
```

#### `AuthPaths`

Đường dẫn các trang tài khoản. Website nhiều ngôn ngữ truyền bản có tiền tố (localeHref(site, "/login") → "/en/login"); template có sẵn của SDK tự truyền.

```ts
interface AuthPaths { login: string; register: string; forgotPassword: string; home: string }
```

#### `BindingContext`

Gắn dữ liệu (@ecomcx/ecomweb-content 1.15 — `attrs.bindings`): thuộc tính của khối lấy giá trị lúc hiển thị. Nguồn lõi: core/post (trường của bài đang vẽ / bài trong vòng lặp), core/post-meta (trường meta), core/site. Plugin thêm nguồn: definePlugin({ bindingSources: { "shop/product": async (args, ctx) => … } }).

```ts
interface BindingContext { site: Site; post?: Post | null; data?: ResolveResult | null }
```

#### `BindingSource`

```ts
type BindingSource = (args: Record<string, string | number | boolean>, ctx: BindingContext) => unknown | Promise<unknown>;
```

#### `Block`

Khối cấp cao nhất. - `richtext`: `data` là cây {@link RichNode} gốc `type: "doc"` (nội dung soạn bằng trình soạn). - `html`: `data.html` là HTML (nội dung nhập từ hệ thống cũ). - tên khác: khối của plugin, `data` do plugin định nghĩa. Plugin không có/đã tắt → giữ nguyên dữ liệu, website bỏ qua.

```ts
interface Block { id?: string; type: string; data: any; }
```

#### `BlockAsset`

Asset nạp theo nhu cầu: `src` trong website ("/extensions/…") hoặc https.

```ts
interface BlockAsset { kind: "script" | "style"; src: string; /** Nạp khi nội dung có một trong các khối, hoặc khối có class bắt đầu bằng tiền tố này (vd "mx-"). */ when: { blocks?: string[]; className?: string }; }
```

#### `BlockAttrSpec`

```ts
interface BlockAttrSpec extends AttrSpec { /** Nhãn trong form cài đặt (chữ hoặc "%khoá%" dịch theo locales của plugin). */ label?: string; control?: AttrControl; /** Nhãn cho từng giá trị của enum (cùng thứ tự). */ enumLabels?: readonly string[]; help?: string; }
```

#### `BlockDefinition`

```ts
interface BlockDefinition extends Required<Pick<BlockDefinitionInput, "name" | "title" | "content" | "version">> { description?: string; icon?: string; keywords: string; category?: string; attributes: Record<string, BlockAttrSpec>; migrate: Record<number, (attrs: Record<string, unknown>) => Record<string, unknown>>; placeholder?: BlockPlaceholder; }
```

#### `BlockDefinitionInput`

```ts
interface BlockDefinitionInput { /** Tên khối, duy nhất trong mọi plugin — nên đặt tiền tố plugin: "ten-plugin/callout" hoặc "tenPluginCallout". */ name: string; /** Tên hiển thị (slash menu, khung khối). */ title: string; description?: string; /** Biểu tượng (tên icon lucide, vd "star") — trình soạn hiển thị nếu có. */ icon?: string; /** Từ khoá tìm trong slash menu (không dấu, cách nhau bởi khoảng trắng). */ keywords?: string; category?: string; content?: BlockContent; attributes?: Record<string, BlockAttrSpec>; /** * Phiên bản cấu trúc thuộc tính (mặc định 1). Đổi cấu trúc → tăng version + 
```

#### `BlockProps`

Renderer khối của plugin. Dùng cho cả khối cấp cao nhất (`data` = dữ liệu khối) và nút trong nội dung soạn thảo (`data` = thuộc tính của nút, `children` = nội dung bên trong đã vẽ — vd hộp lưu ý chứa đoạn văn).

```ts
interface BlockProps<D = any> { block: Block; data: D; site: Site; post?: Post | null; children?: ReactNode }
```

#### `ClientMessages`

Chuỗi đã chọn đúng ngôn ngữ để truyền xuống trình duyệt (<TranslationsProvider>).

```ts
interface ClientMessages { locale: string; messages: Record<string, { code: string; text: string }> }
```

#### `Comment`

```ts
interface Comment { id: number; postId: number; parentId?: number | null; authorName: string; authorUrl?: string | null; content: string; status: string; createdAt: string; replies: Comment[]; /** Ảnh đại diện (ảnh của thành viên hoặc Gravatar); null khi site tắt hiển thị avatar. */ avatarUrl?: string | null; }
```

#### `CommentPage`

Một trang bình luận gốc (kèm trả lời). total = số bình luận gốc, count = tổng kể cả trả lời.

```ts
interface CommentPage { items: Comment[]; total: number; count: number; page: number; totalPages: number }
```

#### `CommentQuery`

Tham số của {@link getComments}. Bỏ trống = theo Cài đặt › Thảo luận.

```ts
interface CommentQuery { page?: number; perPage?: number; order?: "asc" | "desc"; /** Bài có mật khẩu: token mở khoá (giá trị cookie, xem {@link requestUnlock}). Có thì không cache. */ unlock?: string; }
```

#### `ConsentCategory`

```ts
type ConsentCategory = (typeof CONSENT_CATEGORIES)[number];
```

#### `CoreSlotName`

Slot chuẩn. Core: head, body.start, body.end, footer. Theme: before.content, after.content. Component của SDK: comments.before / comments.after (khu bình luận), comment_form.fields (ô thêm trong form bình luận), auth.login.fields, auth.register.fields, auth.forgot_password.fields (ô thêm trong form tài khoản, vd captcha). Ô thêm có name="extra.*" được gửi kèm trong "extra" — backend đọc ở action auth.attempt / filter comment.data.

```ts
type CoreSlotName = "head" | "body.start" | "body.end" | "before.content" | "after.content" | "footer" | "comments.before" | "comments.after" | "comment_form.fields" | "auth.login.fields" | "auth.register.fields" | "auth.forgot_password.fields" /** Ô thêm trong mọi form (core + plugin theo hợp đồng chung, CMS ≥ 1.29): props { form, settings }; ô name="extra.*" → hook form.submitting. */ | "form.fields";
```

#### `CurrentUser`

Người dùng đang đăng nhập trên website.

```ts
interface CurrentUser { id: number; email: string; userName: string; displayName: string; roles: string[]; capabilities: string[]; /** Giới thiệu (core ≥ 1.20.0). */ bio?: string | null; }
```

#### `DocumentMetadata`

```ts
interface DocumentMetadata { title: string; description?: string; canonical?: string; /** Bản dịch của trang: { vi: "/chao-mung", en: "/en/welcome" } → thẻ hreflang. */ alternates?: Record<string, string>; robots?: string; openGraph?: { title?: string; description?: string; image?: string; type?: string; url?: string; /** Nhiều ảnh kèm kích thước (ưu tiên hơn `image`). */ images?: Array<{ url: string; width?: number; height?: number; alt?: string }>; siteName?: string; locale?: string; /** Bài viết (type = article). */ publishedTime?: string; modifiedTime?: string; section?: string; tags?: str
```

#### `FacetResult`

```ts
interface FacetResult { total: number; facets: Record<string, FacetValue[]> }
```

#### `FacetValue`

Một giá trị facet: slug term (facet phân loại) hoặc giá trị meta, kèm số bài.

```ts
interface FacetValue { value: string; count: number; termId?: number | null; name?: string | null; parentId?: number | null }
```

#### `FetchOptions`

```ts
interface FetchOptions { tags?: string[]; noStore?: boolean; revalidate?: number; query?: Record<string, unknown>; headers?: Record<string, string>; asUser?: boolean; /** * Chiều biến thiên cache (core ≥ 1.22.0) mà plugin đang bật khai báo trong plugin.json › cacheVary: `{ device: "mobile", "flag:ab": "b" }`. * CMS gộp vào khoá cache công khai, mỗi giá trị một bản; chiều chưa ai khai báo bị bỏ qua. Danh sách chiều: GET /api/public/cache-vary. * Đọc header / cookie để biết giá trị sẽ khiến trang thành động — chỉ làm khi plugin thật sự cần. */ vary?: Record<string, string>; }
```

#### `FilterMap`

```ts
interface FilterMap { /** Sửa metadata của trang (title, description, og…). */ "document.metadata": (meta: DocumentMetadata, ctx: { site: Site; data: ResolveResult }) => DocumentMetadata | Promise<DocumentMetadata>; /** Sửa danh sách block trước khi render nội dung bài viết. */ "post.blocks": (blocks: Block[], ctx: { site: Site; post?: Post | null }) => Block[] | Promise<Block[]>; /** Sửa nội dung robots.txt (văn bản). */ "robots.txt": (content: string, ctx: { site: Site }) => string | Promise<string>; /** Sửa danh sách URL của sitemap.xml. */ "sitemap.entries": (entries: SitemapEntry[], ctx: 
```

#### `ImgProps`

```ts
interface ImgProps { media?: Media | null; /** Cỡ lớn nhất cần dùng: thumbnail, medium, medium_large, large, 1536x1536, 2048x2048 hoặc cỡ theme tự khai báo. */ size?: string; /** Thuộc tính sizes của HTML, vd "(max-width: 768px) 100vw, 50vw". Mặc định: rộng tối đa bằng cỡ ảnh. */ sizes?: string; className?: string; alt?: string; /** Ảnh đầu trang (LCP): tải ngay, ưu tiên cao. */ priority?: boolean; style?: CSSProperties; }
```

#### `JsonObject`

```ts
type JsonObject = { [k: string]: JsonValue };
```

#### `JsonValue`

```ts
type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
```

#### `Language`

```ts
interface Language { code: string; name: string; isDefault: boolean; flag?: string | null }
```

#### `LayoutProps`

```ts
interface LayoutProps { site: Site; settings: JsonObject; children: ReactNode; /** Trang đang xem — truyền cho <EditableRegion data={data}> để vùng (và plugin thay vùng) biết trang nào. */ data?: ResolveResult; }
```

#### `LinkProps`

```ts
type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string; children?: ReactNode; /** * Prefetch của Next.js. Mặc định false: mọi trang của CMS là trang động, mỗi lần prefetch là một lần render trên server * (trang chủ báo có thể có cả trăm link). Bật cho vài link quan trọng nếu muốn chuyển trang tức thì. */ prefetch?: boolean | null; /** Đặt aria-current và class này khi URL hiện tại khớp href (dùng cho menu). */ activeClassName?: string; /** Khớp cả trang con (vd /category/a/page/2 vẫn active cho /category/a). Mặc định true, trừ trang chủ. */ matchNested?: boolea
```

#### `ListPage`

Một trang của danh sách công khai (term, tác giả, media).

```ts
interface ListPage<T> { items: T[]; total: number; page: number; totalPages: number }
```

#### `Media`

```ts
interface Media { id: number; url: string; fileName: string; mimeType: string; size: number; width?: number | null; height?: number | null; alt: string; caption: string; sizes: Record<string, MediaSize>; /** Bản WebP của ảnh gốc. */ webpUrl?: string | null; /** Điểm lấy nét 0–1 (object-position). */ focalX?: number | null; focalY?: number | null; title?: string; createdAt?: string; }
```

#### `MediaQuery`

```ts
interface MediaQuery { /** Tìm theo tiêu đề, alt, chú thích, tên file — không phân biệt dấu. */ search?: string; /** Tiền tố kiểu file: "image/", "video/", "application/pdf". */ mime?: string; folder?: number; include?: number[]; exclude?: number[]; orderBy?: "date" | "title" | "id" | "size"; order?: "asc" | "desc"; /** perPage 1–100 (mặc định 20). */ page?: number; perPage?: number; /** Tham số thêm cho plugin (filter media.query). */ params?: Record<string, string>; }
```

#### `MediaSize`

```ts
interface MediaSize { url: string; width: number; height: number; webpUrl?: string | null }
```

#### `MenuItem`

```ts
interface MenuItem { id: number; parentId?: number | null; title: string; url: string; kind: string; objectId?: number | null; target?: string | null; cssClass?: string | null; order: number; children: MenuItem[]; }
```

#### `MetaQuery`

```ts
interface MetaQuery { /** Mặc định "AND". */ relation?: "AND" | "OR"; clauses: MetaQueryClause[]; }
```

#### `MetaQueryClause`

Một điều kiện lọc theo trường tuỳ biến (post.meta). Giá trị so sánh phải đúng kiểu JSON (số là số). So bằng (`=`, `!=`, `IN`, `NOT IN`, `EXISTS`, `NOT EXISTS`) chạy trên chỉ mục GIN sẵn có — dùng được với mọi khoá meta. So khoảng (`>`, `>=`, `<`, `<=`, `BETWEEN`, `LIKE`) **chỉ dùng được với khoá đã khai báo `filterable`** (backend tạo chỉ mục B-tree cho khoá đó lúc khởi động); khoá chưa khai báo trả 422. Với khoá kiểu số, giá trị phải là số JSON (chuỗi số cũng được, core tự chuyển) — nếu không phép so sẽ so chuỗi ("100" < "20").

```ts
interface MetaQueryClause { key: string; compare: "=" | "!=" | "IN" | "NOT IN" | "EXISTS" | "NOT EXISTS" | ">" | ">=" | "<" | "<=" | "BETWEEN" | "LIKE"; /** Bỏ trống với EXISTS / NOT EXISTS. Với LIKE: mẫu có `%` / `_`. */ value?: string | number | boolean | (string | number | boolean)[]; /** Cận trên của BETWEEN (bắt buộc với BETWEEN). */ value2?: string | number; }
```

#### `PluginDefinition`

```ts
interface PluginDefinition { /** [contact-form id="1"] trong nội dung → component. */ shortcodes?: Record<string, ComponentType<ShortcodeProps>>; /** Renderer cho loại widget đã khai báo ở backend (IWidgetRegistry). */ widgets?: Record<string, ComponentType<WidgetProps>>; /** Chèn component vào vị trí cố định của trang (hỗ trợ tên tự do, ưu tiên priority). */ slots?: Record<string, SlotRegistration<any>>; /** * Thay cả một vùng của theme (header, footer hoặc vùng theme khai báo): { header: MyHeader }. * Nhiều plugin cùng thay một vùng → priority nhỏ nhất thắng (mặc định 10; bằng nhau thì plugi
```

#### `PluginFormField`

```ts
interface PluginFormField { key: string; type: string; label: string; required: boolean; maxLength?: number | null; minLength?: number | null; min?: string | null; max?: string | null; options?: string[] | null; pattern?: string | null; default?: unknown; }
```

#### `PluginLoader`

```ts
type PluginLoader = Loader<PluginDefinition>;
```

#### `PluginRoute`

Route gốc do plugin cung cấp (vd /news-sitemap.xml): nhận Request, trả Response. Khai báo đường dẫn trong plugin.json → frontend.routes.

```ts
type PluginRoute = (req: Request, ctx: { site: Site; path: string }) => Response | Promise<Response>;
```

#### `Post`

```ts
interface Post { id: number; type: string; title: string; slug: string; status: string; /** Mã ngôn ngữ của bài, vd "vi". */ locale: string; /** Bản dịch đã đăng ở ngôn ngữ khác. */ translations: TranslationRef[]; content?: PostContentDoc | null; excerpt: string; authorId?: number | null; author?: Author | null; parentId?: number | null; menuOrder: number; template?: string | null; featuredMedia?: Media | null; commentStatus: string; commentCount: number; /** Bài ghim / nổi bật. */ sticky: boolean; /** Bài có mật khẩu: chưa mở khoá thì content = null, excerpt rỗng — PostContent tự hiện form nh
```

#### `PostContentDoc`

Nội dung một bài viết / trang: danh sách khối cấp cao nhất.

```ts
interface ContentDoc { version: number; blocks: Block[]; }
```

#### `PostQuery`

```ts
interface PostQuery { /** Mặc định: ngôn ngữ của request hiện tại. */ locale?: string; type?: string; taxonomy?: string; term?: string; authorId?: number; search?: string; /** Lọc nhiều post type cùng lúc (bài viết + trang + job...). Gộp với `type`. */ types?: string[]; /** Lọc nhiều taxonomy cùng lúc — thay cho taxonomy/term khi cần AND/OR nhiều điều kiện. */ taxQuery?: TaxQueryClause[]; /** Lọc theo trường tuỳ biến; chạy trong cơ sở dữ liệu trên chỉ mục GIN của posts.meta. */ metaQuery?: MetaQuery; /** Chỉ lấy bài thuộc ngữ cảnh này (plugin tự lọc thêm qua filter posts.query). */ context?: s
```

#### `RegionName`

Vùng chuẩn của core: theme bọc đầu trang / chân trang trong <EditableRegion name="header|footer"> (theme khối: khối templatePart cùng slug) → plugin thay được bằng definePlugin({ regions }) với mọi theme.

```ts
type RegionName = "header" | "footer" | (string & {});
```

#### `RegionProps`

Component thay vùng của plugin. `children` = bản vùng sẽ vẽ nếu không có plugin (Trình dựng / theme) — trả lại `children` để giữ nguyên.

```ts
interface RegionProps { name: string; site: Site; data?: ResolveResult | null; children?: ReactNode }
```

#### `ResolveKind`

```ts
type ResolveKind = | "front-page" | "home" | "single" | "page" | "category" | "tag" | "taxonomy" | "author" | "date" | "archive" | "search" | "route" | "404" | "redirect";
```

#### `ResolveResult`

```ts
interface ResolveResult { kind: ResolveKind; templates: string[]; title: string; locale: string; /** Trang tương ứng ở các ngôn ngữ (dùng cho hreflang, nút chuyển ngôn ngữ). */ alternates: Array<{ locale: string; link: string }>; post?: Post | null; posts?: Post[] | null; term?: Term | null; author?: Author | null; postType?: string | null; search?: string | null; page: number; totalPages: number; total: number; basePath: string; redirect?: { location: string; statusCode: number } | null; isPreview?: boolean; /** Trang ảo (kind = "route") do core/plugin đăng ký: /login, /account/orders/12 → { 
```

#### `RichMark`

```ts
interface RichMark { type: string; attrs?: Record<string, unknown>; }
```

#### `RichNode`

Nút trong nội dung soạn thảo: khối (đoạn, tiêu đề, ảnh…) hoặc chữ (`type: "text"`).

```ts
interface RichNode { type: string; attrs?: Record<string, unknown>; content?: RichNode[]; /** Chỉ có ở `type: "text"`, không rỗng. */ text?: string; /** Định dạng chữ (đậm, liên kết…), chỉ có ở `type: "text"`. */ marks?: RichMark[]; }
```

#### `ShortcodeProps`

```ts
interface ShortcodeProps { attrs: Record<string, string>; content?: string; site: Site; post?: Post | null }
```

#### `SignInProvider`

Nút "Đăng nhập bằng …" của plugin (ISignInProvider, core ≥ 1.20.0). Core cũ không trả providers → không có nút.

```ts
interface SignInProvider { id: string; label: string; iconUrl?: string | null; url: string }
```

#### `Site`

```ts
interface Site { title: string; tagline: string; url: string; language: string; timezone: string; dateFormat: string; /** Ngôn ngữ của request hiện tại. */ locale: string; defaultLocale: string; languages: Language[]; postsPerPage: number; showOnFront: "posts" | "page"; pageOnFront?: number | null; pageForPosts?: number | null; activeTheme: string; themeSettings: JsonObject; activePlugins: string[]; menuLocations: Record<string, number>; extra: JsonObject; /** Preset kiểu dáng đã gộp (theme.json › styles + bản sửa trong Giao diện › Kiểu dáng) — core sinh biến CSS --ecx-*. */ themeStyles?: { co
```

#### `SitemapEntry`

Một URL trong sitemap.xml (filter "sitemap.entries").

```ts
interface SitemapEntry { url: string; lastModified?: string | Date; changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never"; priority?: number; images?: string[]; alternates?: { languages?: Record<string, string> }; }
```

#### `SlotComponent`

```ts
type SlotComponent<P = any> = ComponentType<P> | SlotHandler<P>;
```

#### `SlotHandler`

Một handler gắn vào Slot, kèm priority (mặc định 10, số nhỏ chạy trước).

```ts
interface SlotHandler<P = any> { component: ComponentType<P>; priority?: number; }
```

#### `SlotName`

```ts
type SlotName = CoreSlotName | (string & {});
```

#### `SlotProps`

```ts
interface SlotProps { site: Site; data?: ResolveResult | null }
```

#### `SlotRegistration`

```ts
type SlotRegistration<P = any> = SlotComponent<P> | Array<SlotComponent<P>>;
```

#### `TaxQueryClause`

Một điều kiện lọc theo taxonomy: bài phải khớp (hoặc không khớp) các term này.

```ts
interface TaxQueryClause { taxonomy: string; terms: string[]; /** Mặc định "IN". "NOT IN" = loại bài thuộc các term này. */ operator?: "IN" | "NOT IN"; }
```

#### `TemplateProps`

Props mà mọi template của theme nhận được.

```ts
interface TemplateProps { data: ResolveResult; site: Site; settings: JsonObject; /** Tên template đã được chọn (vd "single"). */ template: string; }
```

#### `Term`

```ts
interface Term { id: number; taxonomy: string; name: string; slug: string; locale: string; description: string; parentId?: number | null; count: number; link: string; meta: JsonObject; /** Dữ liệu plugin thêm vào qua filter api.term.response (vd extra.seo). */ extra?: JsonObject; }
```

#### `TermQuery`

```ts
interface TermQuery { taxonomy: string; locale?: string; /** Tìm theo tên, không phân biệt dấu. */ search?: string; /** Chỉ term con trực tiếp của term này; 0 = chỉ term gốc. */ parent?: number; include?: number[]; exclude?: number[]; hideEmpty?: boolean; /** Chỉ term có meta khoá này (và đúng giá trị nếu có metaValue). */ metaKey?: string; metaValue?: string; orderBy?: "name" | "slug" | "count" | "id"; order?: "asc" | "desc"; /** perPage 1–500 (mặc định 100). */ page?: number; perPage?: number; /** Tham số thêm cho plugin (filter terms.query đọc trong Query). */ params?: Record<string, string
```

#### `ThemeEntry`

```ts
interface ThemeEntry { manifest: ThemeManifest; layout?: Loader<ComponentType<LayoutProps>>; templates: Record<string, Loader<ComponentType<TemplateProps>>>; /** Theme cũng có thể đăng ký shortcode, widget, slot, filter. */ extend?: Loader<PluginDefinition>; /** Bản dịch chữ của theme: locales/{code}.json */ locales?: Record<string, Loader<Record<string, string>>>; }
```

#### `ThemeManifest`

```ts
interface ThemeManifest { name: string; slug: string; version: string; author?: string; description?: string; parent?: string | null; menuLocations?: Record<string, string>; widgetAreas?: Record<string, string>; supports?: string[]; settings?: Array<{ key: string; type: string; label: string; default?: JsonValue; options?: string[]; section?: string; help?: string; /** Ô màu trùng một màu preset (`primary`, `text`, `background`…): chỉnh ở tab Phong cách, ô ẩn khỏi Cài đặt (CMS ≥ 1.23). */ preset?: string }>; /** Cỡ ảnh riêng của theme: { "card": { "width": 600, "height": 400, "crop": true } }.
```

#### `ThemeStyles`

```ts
interface ThemeStyles { colors?: Record<string, ThemeStyleValue>; fontSizes?: Record<string, ThemeStyleValue>; spacing?: Record<string, ThemeStyleValue>; fonts?: Record<string, ThemeStyleValue>; gradients?: Record<string, ThemeStyleValue>; shadows?: Record<string, ThemeStyleValue>; variations?: ThemeStyleVariation[]; /** Kiểu mặc định theo loại khối / phần tử (Global Styles). */ blocks?: Record<string, unknown>; elements?: Record<string, unknown>; [group: string]: unknown; }
```

#### `ThemeStyleValue`

Một giá trị preset: chuỗi, hoặc { label, value } để hiện tên trong Thiết kế.

```ts
type ThemeStyleValue = string | { label?: string; value: string };
```

#### `ThemeStyleVariation`

Bộ phối sẵn của theme (CMS ≥ 1.23): bấm một lần là đổi màu / phông ở Thiết kế › Phong cách.

```ts
interface ThemeStyleVariation { id: string; title: string; colors?: Record<string, string>; fonts?: Record<string, string> }
```

#### `TranslationRef`

```ts
interface TranslationRef { locale: string; id: number; title: string; status: string; link: string }
```

#### `Translator`

```ts
type Translator = ((key: string, vars?: Record<string, string | number>) => string) & { locale: string };
```

#### `WidgetInstance`

```ts
interface WidgetInstance { id: number; area: string; type: string; title: string; settings: any; order: number }
```

#### `WidgetProps`

```ts
interface WidgetProps<S = any> { widget: WidgetInstance; settings: S; site: Site }
```

## `@ecomcx/ecomweb-theme-sdk/client`

Dùng trong file `"use client"`. Tên đã có ở entry chính (component client dùng được từ Server Component) không lặp lại ở đây.

### Component

#### `CountdownClient`

Khối countdown: đếm ngược tới `target` (ms). Dựng lần đầu cùng giá trị trên máy chủ, rồi cập nhật mỗi giây.

```ts
CountdownClient({ target, label, expiredText, units, serverNow, attrs }: { target: number; label?: string; expiredText?: string; units?: Partial<Record<CountdownUnit, string>>; serverNow?: number; attrs?: Record<string, unknown>; }): JSX.Element
```

#### `FormBlockClient`

Khối form cơ bản của lõi (1.39): các ô đã vẽ sẵn ở máy chủ (children), phần này gửi bài qua /api/cms/forms, báo lỗi đúng ô (422), hiện lời cảm ơn. Chống spam: ô bẫy ẩn (_hp) + thời gian điền (máy chủ kiểm), máy chủ còn giới hạn theo IP.

```ts
FormBlockClient({ formId, source, successMessage, labels, button, className, children, fields: extraUi }: { formId: string; source: string; successMessage?: string; labels: { submit: string; sending: string; error: string; }; fields?: ReactNode; button?: { className?: string; style?: CSSProperties; }; className?: string; children?: ReactNode; }): JSX.Element
```

#### `LanguageSwitcherClient`

Phần client của LanguageSwitcher: lấy link bản dịch từ <link rel="alternate" hreflang> do metadata của trang sinh ra.

```ts
LanguageSwitcherClient({ languages, current, defaultLocale, label, className, variant }: { languages: Lang[]; current: string; defaultLocale: string; label: string; className?: string; variant: "list" | "select"; }): JSX.Element
```

#### `LightboxClient`

Phóng to ảnh: bấm ảnh mở lớp phủ (Esc hoặc bấm nền để đóng). `src` đã qua safeUrl ở máy chủ.

```ts
LightboxClient({ src, alt, children }: { src: string; alt: string; children: ReactNode; }): JSX.Element
```

#### `NavDrawer`

Menu di động của khối Menu: nút burger mở ngăn trượt từ trái (nền mờ, nút đóng, khoá cuộn trang, Esc / bấm nền / bấm liên kết để đóng, trả focus về nút). Menu con hiện thụt vào ngay dưới mục cha. Khác NavToggle (giữ nguyên cho theme cũ dùng <details>).

```ts
NavDrawer({ label, closeLabel, children }: { label: string; closeLabel: string; children: ReactNode; }): JSX.Element
```

#### `ScrollRow`

Hàng cuộn ngang có nút trước / sau (Query dạng carousel): cuộn đúng một "trang" mỗi lần bấm, ẩn nút ở hai đầu. Không có JS vẫn vuốt / cuộn được.

```ts
ScrollRow({ children, arrows }: { children: ReactNode; arrows?: boolean; }): JSX.Element
```

#### `SearchFormClient`

Form tìm kiếm (GET) chuyển trang phía client.

```ts
SearchFormClient({ action, defaultValue, placeholder, label, buttonLabel, postType, showLabel, buttonPosition, buttonIcon, scopes, scopeAllLabel, scopeLabel, scopeValue }: { scopes?: Array<{ value: string; label: string; }>; scopeAllLabel?: string; scopeLabel?: string; scopeValue?: string; buttonIcon?: boolean; action: string; defaultValue?: string | null; placeholder: string; label: string; buttonLabel: string; postType?: string; showLabel?: boolean; buttonPosition?: "right" | "left" | "below"; }): JSX.Element
```

#### `TabsClient`

Khối tabs: các panel đã vẽ sẵn trên máy chủ (nội dung vẫn có trong HTML cho SEO); chỉ đổi panel đang hiện. Tab dọc (`vertical`), thành accordion trên điện thoại (`mobileAccordion`, chỉ CSS: tiêu đề nằm ngay trên panel của nó); tab có neo → panel mang id = neo, mở thẳng bằng #neo.

```ts
TabsClient({ titles, panels, initial, icons, subtitles, anchors, vertical, mobileAccordion, extraClass }: { titles: string[]; panels: ReactNode[]; initial?: number; icons?: Array<string | undefined>; subtitles?: Array<string | undefined>; anchors?: Array<string | undefined>; vertical?: boolean; mobileAccordion?: boolean; extraClass?: string; }): JSX.Element
```

#### `TocSpy`

Mục lục: tô đậm mục của tiêu đề đang đọc (tiêu đề cuối cùng đã cuộn qua mép trên 120px) — aria-current="location".

```ts
TocSpy(): JSX.Element
```

#### `TranslationsProvider`

Chuyển chuỗi đã dịch xuống component client. Server Component lấy bằng `getClientMessages(["cart."])` rồi bọc: <TranslationsProvider value={await getClientMessages(["cart."])}><CartButton /></TranslationsProvider> Nhiều provider lồng nhau được gộp (provider trong thắng).

```ts
TranslationsProvider({ value, children }: { value: ClientMessages; children: ReactNode; }): JSX.Element
```

### Hàm

#### `emit`

Phát sự kiện cho mọi component trên trang (vd plugin giỏ hàng báo "đã thêm" để mini-cart của theme cập nhật). `crossTab: true`: các tab khác của cùng website cũng nhận (BroadcastChannel).

```ts
emit<K extends EventName>(name: K, detail?: EventData<K>, opts?: { crossTab?: boolean; }): void
```

#### `extraFields`

Dữ liệu thêm của plugin (vd token captcha): mọi ô trong form có name bắt đầu bằng "extra." — gửi lên CMS trong "extra", plugin backend đọc ở action auth.attempt / filter comment.data. Plugin chèn ô qua slot (auth.login.fields, comment_form.fields…).

```ts
extraFields(fd: FormData): Record<string, string> | undefined
```

#### `getConsent`

Lựa chọn cookie của khách (xem consent.ts); undefined = chưa trả lời. "functional" luôn có. Chỉ chạy ở trình duyệt.

```ts
getConsent(): ConsentCategory[] | undefined
```

#### `hasConsent`

Khách đã cho phép nhóm cookie này chưa (gọi trong useEffect / handler — không gọi lúc render để HTML giống nhau cho mọi khách). Chưa chọn: theo <meta name="cms-consent" content="optin"> của plugin banner; không có banner → true.

```ts
hasConsent(category: ConsentCategory): boolean
```

#### `on`

Nghe sự kiện; trả hàm huỷ. Nhận cả sự kiện từ tab khác nếu bên phát dùng crossTab.

```ts
on<K extends EventName>(name: K, handler: (detail: EventData<K>) => void): () => void
```

#### `onBlockReady`

Gọi `fn(el, attrs)` cho mỗi khối loại `type` ("*" = mọi khối mà website gắn dấu) đang có / sẽ xuất hiện trên trang (kể cả sau khi chuyển trang bằng Link); hàm dọn trả về được gọi khi khối rời trang. Website chỉ gắn dấu cho loại khối plugin khai ở `definePlugin({ readyBlocks })` — `attrs` gồm các thuộc tính liệt kê ở đó. Trả hàm huỷ đăng ký. onBlockReady("image", (img) => { const z = startZoom(img); return () => z.stop(); });

```ts
onBlockReady(type: string, fn: BlockReadyFn): () => void
```

#### `pluginClient`

Gọi endpoint của plugin từ component client — cùng endpoint với `pluginFetch` phía server, qua proxy của website (`/api/cms/plugins/{slug}/…`): gửi kèm phiên của người đang đăng nhập (ICurrentUser ở backend), chặn gọi từ trang khác. Lỗi → `PluginApiError` (status, title, errors theo trường). const shop = pluginClient("shop"); const cart = await shop.post<Cart>("/cart/items", { productId, qty: 1 });

```ts
pluginClient(slug: string): PluginClient
```

#### `setConsent`

Plugin banner ghi lựa chọn của khách rồi phát "consent.changed" (cả tab khác) để bên hỏi nạp / báo lại script ngay.

```ts
setConsent(categories: readonly ConsentCategory[]): void
```

#### `setPreference`

Ghi tuỳ chọn hiển thị của người đọc (xem getPreference). value = null để xoá.

```ts
setPreference(key: string, value: string | null, maxAgeDays?: number): void
```

#### `useEvent`

Hook React của `on`: tự huỷ khi component gỡ; handler mới nhất luôn được gọi (không cần useCallback).

```ts
useEvent<K extends EventName>(name: K, handler: (detail: EventData<K>) => void): void
```

#### `useT`

Hàm dịch trong component client — cùng cú pháp ICU với `getT`. Khoá không có trong provider → trả lại chính khoá.

```ts
useT(): Translator
```

### Class

#### `PluginApiError`

Lỗi trả về từ endpoint của plugin: status HTTP, lời nhắn (title), lỗi theo từng trường (422), mã lỗi (code).

```ts
class PluginApiError
```

### Hằng

#### `browserApi`

Client phía trình duyệt: gọi các route proxy /api/cms/* của frontend.

```ts
const browserApi: FetchKitInstance
```

### Kiểu

#### `BlockReadyFn`

```ts
type BlockReadyFn = (el: HTMLElement, attrs: Record<string, unknown>) => void | (() => void);
```

#### `BrowserEvents`

Bảng tên sự kiện phía trình duyệt → dữ liệu (emit / on / useEvent, core ≥ 1.20.0). Theme / plugin khai báo kiểu cho sự kiện của mình: declare module "@ecomcx/ecomweb-theme-sdk/client" { interface BrowserEvents { "shop.cart.changed": { count: number } } } Tên nên có tiền tố slug plugin (như hook backend).

```ts
interface BrowserEvents { /** Khách vừa đổi lựa chọn cookie (setConsent). */ "consent.changed": { categories: ConsentCategory[] }; }
```

#### `PluginClient`

```ts
interface PluginClient { get<T = unknown>(path: string, opts?: PluginRequestOptions): Promise<T>; post<T = unknown>(path: string, body?: unknown, opts?: PluginRequestOptions): Promise<T>; put<T = unknown>(path: string, body?: unknown, opts?: PluginRequestOptions): Promise<T>; delete<T = unknown>(path: string, opts?: PluginRequestOptions): Promise<T>; }
```

#### `PluginRequestOptions`

```ts
interface PluginRequestOptions { query?: Record<string, string | number | boolean | null | undefined>; headers?: Record<string, string>; signal?: AbortSignal; }
```
