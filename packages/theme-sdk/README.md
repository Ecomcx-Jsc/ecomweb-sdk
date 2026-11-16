# @ecomcx/ecomweb-theme-sdk

SDK để viết theme và phần website của plugin cho Ecomweb CMS: React Server Components trên Next.js.

Hướng dẫn đầy đủ nằm trong repo core: `docs/theme-guide.md` (theme, kèm bảng tương đương hàm WordPress), `docs/plugin-guide.md` (phần Frontend của plugin) và `docs/query-engine.md` (tham số của `getPosts`).

## Entry

| Import | Chạy ở | Dùng cho |
|---|---|---|
| `@ecomcx/ecomweb-theme-sdk` | server | dữ liệu (`getPosts`, `getSite`…), component server (`PostContent`, `Menu`…), `definePlugin`, conditional tags |
| `@ecomcx/ecomweb-theme-sdk/client` | trình duyệt (`"use client"`) | `Link`, form đăng nhập / bình luận, `pluginClient`, `emit` / `on`, `useT`, `setPreference` |
| `@ecomcx/ecomweb-theme-sdk/runtime` | server (core) | nạp theme / plugin: dành cho core |
| `@ecomcx/ecomweb-theme-sdk/auth-shared` | cả hai (core) | hằng và kiểu dùng chung cho proxy đăng nhập |

File `"use client"` chỉ import giá trị từ `/client`. `import type` từ entry chính thì dùng được ở mọi nơi.

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

## Độ ổn định

- Tên công khai theo SemVer: đổi hoặc bỏ chỉ ở bản lớn. Baseline nằm ở `api/theme-sdk.txt` của core, CI so sánh mỗi lần phát hành.
- Tên có `@internal` trong JSDoc là của core, có thể đổi mà không báo trước.
- Tên có `@deprecated` vẫn chạy tới bản lớn kế tiếp; JSDoc ghi tên thay thế.
- `@since x.y.z` = phiên bản SDK có tên đó.

Lịch sử thay đổi: [CHANGELOG.md](CHANGELOG.md).
