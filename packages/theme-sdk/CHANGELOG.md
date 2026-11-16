# Changelog

Theo [SemVer](https://semver.org/lang/vi/): bản lớn (x.0.0) mới được đổi hoặc bỏ API công khai. Tên công khai là tên có trong [API.md](API.md).

## 2.0.0 (16/11/2026)

### Phá tương thích, cần làm khi nâng cấp
- **Entry chính chỉ chạy ở server.** `@ecomcx/ecomweb-theme-sdk` có `import "server-only"`: file `"use client"` import giá trị từ entry chính thì Next báo lỗi lúc build. Sửa: import từ `@ecomcx/ecomweb-theme-sdk/client` (`Link`, form đăng nhập, `CommentForm`…). `import type` vẫn dùng được ở mọi nơi. `create-ecomweb validate` báo lỗi này khi đóng gói.
- **Tên nội bộ của core rời entry chính, chỉ còn ở `/runtime`:** `getActiveTheme`, `getActiveExtensions`, `getSlotItems`, `getSlotComponents`, `findShortcode`, `findWidget`, `findBlock`, `findRoute`, `findRegion`, `resolvePath`, `getPreview`, `getTemplates`, `getAccessToken`, `cmsApi`, `varyHeader`, `UNLOCK_COOKIE`, `UNLOCK_HEADER`, `TEMPLATE_DRAFT_COOKIE`. `ACCESS_COOKIE`, `REFRESH_COOKIE` chỉ còn ở `/auth-shared`. Theme dùng `<Slot>`, `getCurrentUser()`, `pluginFetch(..., { asUser: true })` thay thế.
- **`getPost`, `getPostById`, `getPattern`, `getMenu`, `getMenuById` chỉ trả `null` khi 404.** Lỗi khác (mạng, 5xx) ném `CmsApiError`. Trước đây `getPost` trả `null` cho mọi lỗi nên trang hiện 404 sai khi CMS lỗi. Nơi dùng kết quả cho phần phụ (link chân trang…) nên tự `.catch(() => null)`.
- **`PostDate` là Server Component async**, không truyền `site` thì tự đọc cấu hình ngày của website.
- **Peer dependency có cận trên:** `next >=16 <17`, `react >=19 <20`, `next-fetch-kit >=0.5.0 <1`.

### Đã cũ (vẫn chạy, cảnh báo một lần ở môi trường dev, bỏ ở 3.0)
- `getTerms(taxonomy, hideEmpty, locale)` → `getTerms({ taxonomy, hideEmpty, locale })`.
- `getComments(postId, page, unlock, opts)` → `getComments(postId, { page, unlock, perPage, order })`.

### Thêm
- `getPosts`: `offset`, `noTotal`, `orderBy: "include"`, `parentIn`, `parentNotIn`.
- `getPostIds(query)`, `getAdjacentPost(post, "prev" | "next", query?)`.
- Conditional tags: `isFrontPage`, `isHome`, `isSingle`, `isPage`, `isSingular`, `isCategory`, `isTag`, `isTax`, `isAuthor`, `isDate`, `isArchive`, `isSearch`, `is404`.
- Kiểu `CommentQuery`.
- `<Menu>`, `<WidgetArea>`, `<Comments>`: CMS lỗi thì ghi log và bỏ phần đó, trang vẫn hiện.
- JSDoc cho mọi tên công khai; [API.md](API.md) sinh từ mã nguồn (CI kiểm tra khớp).
- `cmsFetch` được công bố là lối thoát có cam kết khi SDK chưa có hàm riêng.

### Hướng dẫn nâng cấp từ 1.x
1. `npx @ecomcx/create-ecomweb validate`: sửa mọi lỗi "component client import … từ @ecomcx/ecomweb-theme-sdk" bằng cách đổi sang `/client`.
2. Tìm `getActiveTheme`, `findBlock`, `resolvePath`, `ACCESS_COOKIE`… trong theme / plugin: thay bằng API công khai tương ứng (nếu thật sự cần thì import từ `/runtime`, không có cam kết).
3. Nơi gọi `getPost` / `getPostById` / `getMenu` để lấy phần phụ của trang: thêm `.catch(() => null)` nếu muốn giữ cách cũ (lỗi = không có).
4. Chạy dev, đọc cảnh báo `[ecomweb-theme-sdk] … đã cũ` và đổi sang dạng object.
