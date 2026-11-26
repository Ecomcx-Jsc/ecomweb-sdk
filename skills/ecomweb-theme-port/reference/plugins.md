# Plugin: hỏi người dùng, cài, đề xuất plugin mới

## Nguồn sự thật

- Danh mục Store (công khai): `GET https://store.ecomcx.com/api/catalog?kind=plugin&page=1` → `{ items: [{ slug, name, description, version, price, requiresCms }], totalPages }`.
- Plugin đang bật trên CMS: `GET <API CMS>/api/public/site` → `activePlugins`.
- Mức đáp ứng thật của từng plugin: `scripts/feature-map.json` (đã kiểm với mã nguồn; mô tả trên Store có thể nói nhiều hơn thứ đã làm, vd `ecomcx-shop-extras` mới có wishlist, so sánh và xem nhanh chỉ là công tắc).
- `features.mjs` gộp cả ba thành `port/FEATURES.md`.

## CỬA 1: gửi người dùng thế nào

Gửi đúng nội dung này (điền từ FEATURES.md), không thêm lời dẫn dài:

```
Mình đã chụp <N> trang của <site>. Trước khi làm tiếp cần bạn quyết mấy việc:

Plugin nên cài (có trên Store):
- ecomcx-ecommerce 1.10.1 — bán hàng, giỏ, thanh toán (đã bật)
- ecomcx-shop-extras 1.1.0 — wishlist (đã bật)
- ecx-cookie-consent 1.0.1 — thông báo cookie (chưa bật)

Chưa có plugin / chỉ làm được một phần:
1. Đánh giá sản phẩm (sao, nhận xét) — Store chưa có.
   (a) bỏ  (b) chỉ vẽ sao tĩnh trong theme  (c) viết plugin "Đánh giá sản phẩm"
2. Tìm kiếm gợi ý tức thì — core chỉ có tìm kiếm thường.
   (a) bỏ  (b) dùng ô tìm kiếm thường, giữ giao diện  (c) viết plugin "Tìm kiếm tức thì"

Bạn trả lời: cài plugin nào, và chọn a/b/c cho từng mục.
```
Rồi **dừng**. Không tự chọn thay người dùng, kể cả khi một lựa chọn "rõ ràng". Người dùng trả lời một phần → hỏi lại đúng phần còn thiếu.

## Sau khi người dùng trả lời

- Cài/bật plugin: người dùng tự cài ở admin › Plugin › Store, hoặc bạn làm nếu có token admin (`create-ecomweb login`). Kiểm lại bằng `/api/public/site`.
- (a) bỏ: xoá khối/nút đó khỏi markup (không ẩn bằng CSS), ghi vào báo cáo.
- (b) làm trong theme: chỉ phần giao diện, dữ liệu lấy từ thứ đã có (vd xem nhanh dùng dữ liệu đặt sẵn trên thẻ sản phẩm). Ghi rõ giới hạn trong báo cáo.
- (c) viết plugin: viết đặc tả (dưới đây) → gửi người dùng → **chờ duyệt** → mới viết mã. Trong lúc chờ, theme vẽ sẵn markup gốc nhưng chỉ hiện khi plugin có (`getPlugin("<slug>")` khác null ở server, hoặc `window.ecomcx?.<api>` ở client).

## Mẫu đặc tả plugin mới: `port/PLUGIN-<tên>.md`

```markdown
# Plugin <Tên> (`ecx-<slug>`)

## Vì sao
Site gốc có <tính năng> ở <trang>; Store chưa có. Người dùng chọn (c) ngày <ngày>.

## Chức năng (bản đầu, nhỏ nhất đủ dùng)
- …
## Không làm ở bản đầu
- …
## Dữ liệu
- Bảng / meta: …  (migration không dùng '{}', dùng jsonb_build_object())
## Theme dùng thế nào
- Server: `getPlugin("ecx-<slug>")` → `{ … }`
- Trình duyệt: `window.ecomcx.<api>` + sự kiện `ecx:<sự kiện>`
- Markup gốc của theme giữ nguyên; plugin không tự vẽ giao diện trên site (hoặc có shortcode mặc định `[<tên>]`)
## Admin
- Trang …, quyền …
## Phụ thuộc
- ecomweb ≥ …, ecomcx-ecommerce ≥ … (nếu cần)
## Kiểm thử
- …
## Ước lượng
- … file, … ngày
```
Viết plugin: `npx @ecomcx/create-ecomweb plugin "<Tên>" --admin --frontend --tests`, theo skill `ecomweb-cms-extensions` (nếu có) và README của `@ecomcx/create-ecomweb`. Plugin là gói riêng, không đặt trong thư mục theme.
