# Bảo mật

## Báo lỗ hổng

Không mở issue công khai. Dùng **Security › Report a vulnerability** (GitHub private vulnerability reporting) của repo `Ecomcx-Jsc/ecomweb-sdk`, ghi:
- gói và phiên bản (`@ecomcx/ecomweb-theme-sdk@2.0.0`…),
- cách tái hiện,
- ảnh hưởng (lộ dữ liệu, XSS, chiếm phiên…).

## Phiên bản được vá

| Phiên bản | Tính năng mới | Vá lỗi | Vá bảo mật |
|---|---|---|---|
| 2.x (mới nhất) | có | có | có |
| 1.x | không | không | có, tới khi nhóm phát triển công bố ngày kết thúc |
| < 1.0 | không | không | không |

Bản vá bảo mật ra ở bản patch (x.y.Z) của mọi dòng còn được vá.

## Phạm vi

SDK chạy trong website và trình quản trị của Ecomweb CMS, nên các lỗi sau thuộc phạm vi: XSS khi vẽ nội dung / shortcode / khối, lộ dữ liệu của người dùng khác qua cache, lộ token phiên ra JavaScript của trang, chuyển hướng mở (`safeRedirect`), vượt kiểm quyền phía website. Lỗ hổng của core (API, admin) báo ở repo core.
