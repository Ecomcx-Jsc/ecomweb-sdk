# Ecomweb SDK

Bộ công cụ viết theme và plugin cho **Ecomweb**.

| Gói npm | Dùng cho |
|---|---|
| `@ecomcx/ecomweb-theme-sdk` | Theme và phần website của plugin (Next.js Server Components) |
| `@ecomcx/ecomweb-admin-sdk` | Giao diện trang quản trị của plugin (React) |
| `@ecomcx/create-ecomweb` | CLI: tạo khung, kiểm tra, chạy thử, đóng gói theme / plugin |

Định dạng nội dung dùng chung nằm ở repo riêng `@ecomcx/ecomweb-content`.

```
sdk/
├── packages/
│   ├── create-ecomweb/   # CLI (lệnh ecomweb / create-ecomweb)
│   ├── admin-sdk/        # @ecomcx/ecomweb-admin-sdk
│   └── theme-sdk/        # @ecomcx/ecomweb-theme-sdk
├── scripts/              # test.mjs, release.mjs, npm-publish.mjs
└── .github/workflows/publish.yml
```

## Dùng CLI

Tài liệu đầy đủ từng lệnh, tham số, quy trình và xử lý lỗi: [packages/create-ecomweb/README.md](packages/create-ecomweb/README.md).

```bash
# Tạo mới
npm create @ecomcx/ecomweb theme "Tên theme"                    # --blocks: dựng bằng khối · --parent <slug>: child theme
npm create @ecomcx/ecomweb plugin "Tên plugin"                  # plugin.json + một file C# (Ecomweb tự biên dịch)
npm create @ecomcx/ecomweb plugin "Tên plugin" --admin --frontend --tests   # thêm giao diện React riêng, test xUnit
npm create @ecomcx/ecomweb plugin "Tên plugin" --project        # dự án csproj khi cần thư viện NuGet

# Trong thư mục theme / plugin
npx @ecomcx/create-ecomweb validate        # kiểm tra (không cần mạng)
npx @ecomcx/create-ecomweb check           # chạy thử quy trình cài + quét bảo mật trên CMS, không cài (plugin)
npx @ecomcx/create-ecomweb test            # chạy test xUnit trong tests/ (plugin)
npx @ecomcx/create-ecomweb pack            # đóng gói dist/<slug>-<version>.zip để nộp Store / cài tay
npx @ecomcx/create-ecomweb deploy          # đóng gói + cài lên CMS (--activate để bật luôn)
npx @ecomcx/create-ecomweb dev             # tự đóng gói + cài lại mỗi khi lưu file
npx @ecomcx/create-ecomweb upgrade         # lên SDK mới nhất rồi kiểm tra lại

# CMS thử bằng Docker, không cần mã nguồn CMS
npx @ecomcx/create-ecomweb env up --dev    # sửa theme / plugin là thấy; env status | logs | down [--purge]

# Làm việc với theme đang chạy trên một site (CMS 1.35+, dùng token API, không vướng 2FA)
npx @ecomcx/create-ecomweb login --url https://site.com --token cmsp_…
npx @ecomcx/create-ecomweb clone ten-theme                      # mã nguồn theme đang chạy về máy
npx @ecomcx/create-ecomweb dev --data https://site.com          # xem thử trên máy bằng dữ liệu thật (chỉ đọc)
npx @ecomcx/create-ecomweb pull                                 # lấy thay đổi của server, file bạn sửa được giữ
npx @ecomcx/create-ecomweb push                                 # đưa lên site, từ chối nếu server đã đổi (--force để ghi đè)
```

Hướng dẫn viết theme và plugin: `docs/theme-guide.md`, `docs/plugin-guide.md` trong repo core `Ecomcx-Jsc/ecomweb`. Tra cứu API theme SDK: [packages/theme-sdk/API.md](packages/theme-sdk/API.md).

## Phát triển

```bash
npm ci
npm test              # kiểm thử theme-sdk, admin-sdk, CLI
npm run release       # build dist-release/ + cài thử vào dự án trống
```

## Phát hành

1. Tăng `version` trong `package.json` gốc và `packages/*/package.json` (các gói cùng phiên bản).
2. `npm test && npm run release`.
3. Commit, rồi `gh release create vX.Y.Z --title "SDK vX.Y.Z"` → workflow `publish.yml` build lại, đính kèm tarball và publish
   cả ba gói lên npm bằng Trusted Publishing (OIDC từ GitHub Actions, có provenance, không token).
4. Core: `node scripts/release/update-sdk.mjs X.Y.Z` (đổi phiên bản trong admin / frontend + CLI ghim trong `scripts/dev/cms-cli.sh`).

Gói mới chưa có trên npm thì publish tay lần đầu: `npm login`, `node scripts/release.mjs`, `node scripts/npm-publish.mjs`
(npm in đường link duyệt bằng passkey), rồi trên npmjs.com mỗi gói: Settings › Trusted Publisher › GitHub Actions,
repo `Ecomcx-Jsc/ecomweb-sdk`, workflow `publish.yml`.
