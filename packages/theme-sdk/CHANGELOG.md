# Changelog

## 1.44.0 (chưa phát hành)

### Thêm
- `getPosts`: `offset`, `noTotal`, `orderBy: "include"`, `parentIn`, `parentNotIn` (cần core có các tham số này; core cũ bỏ qua tham số lạ).
- `getPostIds(query)`: chỉ lấy id bài (`fields=ids`).
- `getAdjacentPost(post, "prev" | "next", query?)`: bài liền trước / sau (`get_adjacent_post`). Khối `postNavigation` dùng hàm này.
- Conditional tags: `isFrontPage`, `isHome`, `isSingle`, `isPage`, `isSingular`, `isCategory`, `isTag`, `isTax`, `isAuthor`, `isDate`, `isArchive`, `isSearch`, `is404`.
- JSDoc cho các hàm và component công khai còn thiếu (`getPosts`, `getPost`, `getTerms`, `getMenu`, `Menu`, `Comments`, `PostDate`, `Link`…). Tag `@internal` cho tên chỉ core dùng.
- `create-ecomweb validate`: cảnh báo file `"use client"` import giá trị từ entry chính.

### Sửa
- `getPost`, `getPostById`: chỉ trả `null` khi CMS trả 404. Lỗi khác (mạng, 5xx) ném `CmsApiError` thay vì `null`, để trang không hiện "không tìm thấy" sai khi CMS lỗi. Theme đang bắt `null` để xử lý cả lỗi thì cần `try/catch`.

### Sẽ đổi ở 2.0
- Entry chính thêm `server-only`: file client import giá trị từ entry chính sẽ lỗi lúc build.
- Tên `@internal` chuyển hẳn sang `/runtime`.
