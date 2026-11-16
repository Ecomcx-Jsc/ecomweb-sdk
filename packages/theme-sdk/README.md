# @ecomcx/ecomweb-theme-sdk

SDK để viết theme và phần website của plugin cho Ecomweb CMS: React Server Components trên Next.js.

Hướng dẫn đầy đủ nằm trong repo core: `docs/theme-guide.md` (theme, kèm bảng tương đương hàm WordPress), `docs/plugin-guide.md` (phần Frontend của plugin) và `docs/query-engine.md` (tham số của `getPosts`).

## Entry

| Import | Chạy ở | Dùng cho |
|---|---|---|
| `@ecomcx/ecomweb-theme-sdk` | chỉ server (`server-only`) | dữ liệu (`getPosts`, `getSite`…), component server (`PostContent`, `Menu`…), `definePlugin`, conditional tags |
| `@ecomcx/ecomweb-theme-sdk/client` | trình duyệt (`"use client"`) | `Link`, form đăng nhập / bình luận, `pluginClient`, `emit` / `on`, `useT`, `setPreference` |
| `@ecomcx/ecomweb-theme-sdk/runtime` | chỉ server (core) | nạp theme / plugin, dựng trang theo URL, xem trước: dành cho core, không có cam kết |
| `@ecomcx/ecomweb-theme-sdk/auth-shared` | cả hai (core) | hằng và kiểu dùng chung cho proxy đăng nhập |

File `"use client"` chỉ import giá trị từ `/client`; import nhầm entry chính thì Next báo lỗi lúc build. `import type` từ entry chính dùng được ở mọi nơi.

Tham chiếu đầy đủ từng tên (chữ ký, mô tả, ví dụ): [API.md](API.md), sinh từ mã nguồn.

## Quy tắc đặt tên

| Dạng | Nghĩa | Ví dụ |
|---|---|---|
| `get*` | lấy dữ liệu từ CMS, async, có cache | `getPosts`, `getSite`, `getAdjacentPost` |
| `format*` | biến đổi giá trị, không gọi mạng | `formatDate`, `formatMessage` |
| `is*` / `has*` | trả về boolean | `isArchive`, `hasPlugin` |
| `require*` | chặn, chuyển hướng nếu không đạt | `requireUser` |
| `define*` | khai báo | `definePlugin`, `defineBlock` |
| `use*` | React hook (client) | `useCurrentUser`, `useT` |
| `PascalCase` | component | `PostDate`, `Menu` |
| `CONSTANT_CASE` | hằng | `CONSENT_CATEGORIES` |

## Cách báo lỗi

| Loại | Không tìm thấy | CMS lỗi (mạng, 5xx) |
|---|---|---|
| Hàm lấy một mục: `getPost`, `getPostById`, `getPattern`, `getMenu`, `getMenuById`, `getPlugin` | `null` | ném `CmsApiError` (`status` = mã HTTP, 0 = lỗi mạng) |
| Hàm lấy danh sách: `getPosts`, `getTerms`, `queryTerms`, `getComments`, `getWidgets`… | danh sách rỗng | ném `CmsApiError` |
| `getCurrentUser` | `null` (khách) | `null` |
| Component phần phụ: `<Menu>`, `<WidgetArea>`, `<Comments>`, `<Slot>` | vẽ `fallback` / không vẽ | ghi `console.error`, bỏ phần đó, trang vẫn hiện |
| Plugin, filter, action lỗi | — | ghi log, bỏ qua plugin đó |

Template gặp lỗi không bắt thì Next hiện trang lỗi (`error.tsx`), không hiện 404 sai. Lỗi mạng ngắn (502 / 503 / 504) được thử lại một lần trước khi ném.

## Độ ổn định

- Tên công khai theo SemVer: đổi hoặc bỏ chỉ ở bản lớn. Baseline nằm ở `api/theme-sdk.txt` của core, CI so sánh mỗi lần phát hành.
- Tên có `@internal` trong JSDoc là của core, có thể đổi mà không báo trước.
- Tên có `@deprecated` vẫn chạy tới bản lớn kế tiếp; JSDoc ghi tên thay thế.
- `@since x.y.z` = phiên bản SDK có tên đó.

Lịch sử thay đổi: [CHANGELOG.md](CHANGELOG.md).
