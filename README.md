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

```bash
# Plugin: plugin.json + một file C# (Ecomweb tự biên dịch, tạo bảng, trang quản trị, form)
npm create @ecomcx/ecomweb plugin "Tên plugin"
npm create @ecomcx/ecomweb plugin "Tên plugin" --admin --frontend   # thêm giao diện React riêng
npm create @ecomcx/ecomweb plugin "Tên plugin" --project            # dự án csproj khi cần thư viện NuGet

# Theme
npm create @ecomcx/ecomweb theme "Tên theme"

# Trong thư mục theme / plugin
npx @ecomcx/create-ecomweb validate     # kiểm tra
npx @ecomcx/create-ecomweb dev          # chạy thử trên Ecomweb dev
npx @ecomcx/create-ecomweb upgrade      # lên SDK mới nhất
npx @ecomcx/create-ecomweb pack .       # đóng gói .zip để nộp Store / cài
```

Chi tiết: `docs/theme-guide.md`, `docs/plugin-guide.md` trong repo core `Ecomcx-Jsc/ecomweb`.

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
4. Core: `node scripts/update-sdk.mjs X.Y.Z` (đổi phiên bản trong admin / frontend + CLI ghim trong `scripts/cms-cli.sh`).

Gói mới chưa có trên npm thì publish tay lần đầu: `npm login`, `node scripts/release.mjs`, `node scripts/npm-publish.mjs`
(npm in đường link duyệt bằng passkey), rồi trên npmjs.com mỗi gói: Settings › Trusted Publisher › GitHub Actions,
repo `Ecomcx-Jsc/ecomweb-sdk`, workflow `publish.yml`.
