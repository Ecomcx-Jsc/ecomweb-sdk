# ECX Nexus SDK

Bộ công cụ phát triển Theme và Plugin chuẩn cho hệ sinh thái **ECX Nexus**.

## Cấu trúc Packages

```
sdk/
├── package.json               # Root monorepo (định nghĩa npx CLI entrypoint)
├── packages/
│   ├── create-cms/            # CLI tạo khung, kiểm tra, đóng gói theme & plugin
│   ├── admin-sdk/             # React SDK cho giao diện quản trị Admin của plugin
│   └── theme-sdk/             # Next.js Server Components SDK cho theme & storefront
└── .github/workflows/
    └── publish.yml            # CI/CD tự động publish lên GitHub Packages
```

---

# Sử dụng trực tiếp từ GitHub qua `npx` (Không cần cài đặt)

Sau khi push repo này lên GitHub (`github.com/Ecomcx-Jsc/ecx-nexus-sdk`), bất kỳ ai cũng có thể chạy ngay lập tức:

```bash
# Tạo plugin mới: plugin.json + một file C# (CMS tự biên dịch, tự tạo bảng, trang quản trị, form)
npx github:Ecomcx-Jsc/ecx-nexus-sdk plugin "Tên Plugin"
# Thêm giao diện React riêng khi trang tự sinh không đủ / dự án csproj khi cần thư viện NuGet
npx github:Ecomcx-Jsc/ecx-nexus-sdk plugin "Tên Plugin" --admin --frontend
npx github:Ecomcx-Jsc/ecx-nexus-sdk plugin "Tên Plugin" --project

# Tạo theme mới
npx github:Ecomcx-Jsc/ecx-nexus-sdk theme "Tên Theme"

# Project tạo từ trước: lên SDK mới nhất (theme-sdk / admin-sdk) rồi kiểm tra lại
npx github:Ecomcx-Jsc/ecx-nexus-sdk upgrade

# Đóng gói plugin / theme thành file .zip
npx github:Ecomcx-Jsc/ecx-nexus-sdk pack <đường-dẫn-thư-mục>
```

---

## 2. Hướng dẫn khởi tạo Git và đẩy lên GitHub

Mở Terminal và thực hiện các bước sau:

```bash
cd /Volumes/SSD-1/Code/ecomcx-nexus/sdk

# 1. Khởi tạo Git repository
git init

# 2. Thêm file và commit
git add .
git commit -m "feat: initial commit ecx-nexus-sdk monorepo"

# 3. Tạo repository mới trên GitHub (ví dụ đặt tên là: ecx-nexus-sdk)
# 4. Gắn remote và đẩy lên GitHub
git branch -M main
git remote add origin https://github.com/<username>/ecx-nexus-sdk.git
git push -u origin main
```

---

## 3. Phát hành SDK (GitHub Release)

npm không cài được thư mục con của repo git, nên `@ecomcx/nexus-admin-sdk` và `@ecomcx/nexus-theme-sdk` được phát hành thành tarball (JavaScript đã biên dịch + `.d.ts`) đính kèm GitHub Release. Không cần tài khoản npm hay token khi cài.

1. Tăng `version` trong `packages/*/package.json` (các gói cùng phiên bản).
2. Thử trên máy: `npm run release` (build vào `dist-release/` và cài thử vào dự án trống).
3. Tạo release trên GitHub với tag `vX.Y.Z` trùng phiên bản → workflow **Release SDK packages** tự build và đính kèm `cms-admin-sdk-X.Y.Z.tgz`, `cms-theme-sdk-X.Y.Z.tgz`.

Cài trong core/plugin:

```json
"@ecomcx/nexus-theme-sdk": "https://github.com/Ecomcx-Jsc/ecx-nexus-sdk/releases/download/vX.Y.Z/cms-theme-sdk-X.Y.Z.tgz",
"@ecomcx/nexus-admin-sdk": "https://github.com/Ecomcx-Jsc/ecx-nexus-sdk/releases/download/vX.Y.Z/cms-admin-sdk-X.Y.Z.tgz"
```

CLI `create-cms` không cần tarball — chạy thẳng từ tag: `npx github:Ecomcx-Jsc/ecx-nexus-sdk#vX.Y.Z pack`. Core ghim tag trong `scripts/cms-cli.sh`.
