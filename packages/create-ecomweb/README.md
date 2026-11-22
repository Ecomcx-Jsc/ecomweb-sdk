# @ecomcx/create-ecomweb

Công cụ dòng lệnh (CLI) để viết **theme** và **plugin** cho Ecomweb CMS: tạo khung, kiểm tra, chạy thử, lấy mã nguồn theme đang chạy về máy, đóng gói và đưa lên site.

Gõ `create-ecomweb` (hoặc `ecomweb`) không kèm lệnh con để xem trợ giúp ngắn. Tài liệu này là bản đầy đủ.

- [Cài đặt và yêu cầu](#cài-đặt-và-yêu-cầu)
- [Kết nối tới một site](#kết-nối-tới-một-site)
- [Các quy trình thường dùng](#các-quy-trình-thường-dùng)
- [Tham chiếu lệnh](#tham-chiếu-lệnh)
  - [Tạo mới: `theme`, `plugin`](#tạo-mới-theme-plugin)
  - [Kiểm tra: `validate`, `check`, `test`](#kiểm-tra-validate-check-test)
  - [Đóng gói và cài: `pack`, `deploy`, `dev`](#đóng-gói-và-cài-pack-deploy-dev)
  - [Làm việc với theme đang chạy trên site: `login`, `clone`, `pull`, `push`](#làm-việc-với-theme-đang-chạy-trên-site-login-clone-pull-push)
  - [Xem thử bằng dữ liệu thật: `dev --data`](#xem-thử-bằng-dữ-liệu-thật-dev---data)
  - [CMS thử bằng Docker: `env`](#cms-thử-bằng-docker-env)
  - [Nâng SDK: `upgrade`](#nâng-sdk-upgrade)
- [Biến môi trường và tệp cấu hình](#biến-môi-trường-và-tệp-cấu-hình)
- [Loại trừ tệp của theme: `.ecomwebignore`](#loại-trừ-tệp-của-theme-ecomwebignore)
- [Xử lý lỗi thường gặp](#xử-lý-lỗi-thường-gặp)

---

## Cài đặt và yêu cầu

Không cần cài toàn cục, chạy thẳng bằng `npx`:

```bash
npx @ecomcx/create-ecomweb <lệnh> [tham số]
```

Hai lệnh tạo mới có dạng ngắn của `npm create`:

```bash
npm create @ecomcx/ecomweb theme  "Tên theme"
npm create @ecomcx/ecomweb plugin "Tên plugin"
```

Có thể cài toàn cục để gõ ngắn hơn (`npm i -g @ecomcx/create-ecomweb`), sau đó dùng `ecomweb <lệnh>` hoặc `create-ecomweb <lệnh>`. Các ví dụ dưới đây viết `create-ecomweb`; nếu không cài toàn cục thì thay bằng `npx @ecomcx/create-ecomweb`.

| Cần có | Khi nào |
|---|---|
| Node.js 20 trở lên | luôn luôn |
| Docker | chỉ cho `env up` (CMS thử trên máy) |
| .NET SDK | chỉ cho `test`, và cho `pack` plugin dạng dự án csproj (`--project`). Plugin một file C# thì CMS tự biên dịch khi cài, không cần .NET |
| CMS 1.35 trở lên | cho `login`, `clone`, `pull`, `push`, `dev --data` |

---

## Kết nối tới một site

Các lệnh làm việc với site (`deploy`, `dev`, `check`, `test`, `clone`, `pull`, `push`) cần biết **địa chỉ** và **cách xác thực**.

### Cách khuyến nghị: token API

Token không qua mật khẩu nên **không vướng xác thực 2 lớp (2FA)**.

1. Vào trang quản trị của site: **Hồ sơ › Token API**, tạo token dạng `cmsp_…`.
2. Lưu token trên máy bạn:

```bash
create-ecomweb login --url https://site-cua-ban.com --token cmsp_xxxxxxxx
```

Lệnh này gọi thử site để kiểm token còn dùng được và đủ quyền quản trị theme/plugin, rồi mới lưu. Token được ghi vào `~/.config/ecomweb/config.json` với quyền `600` (chỉ bạn đọc được), theo từng địa chỉ site. Token **không bao giờ** nằm trong thư mục theme/plugin nên không bị commit nhầm.

### Thứ tự tìm thông tin kết nối

Địa chỉ site, lần lượt:

1. `--url`
2. biến môi trường `CMS_URL`
3. địa chỉ của môi trường `env up` (thư mục `.cms-env`, tìm ở thư mục hiện tại rồi các thư mục cha)
4. mặc định `http://localhost:5100`

Xác thực, lần lượt:

1. `--token`
2. biến môi trường `CMS_TOKEN`
3. token đã lưu bằng `login` cho đúng địa chỉ đó
4. tài khoản và mật khẩu: `--user` / `--password`, hoặc `CMS_USER` / `CMS_PASSWORD`, hoặc tài khoản của `env up`. `--user` mặc định là `admin`. **Tài khoản bật 2FA không dùng được cách này**, hãy dùng token.

---

## Các quy trình thường dùng

### A. Viết theme mới và thử ngay trên máy

```bash
create-ecomweb theme "Cửa hàng của tôi"      # tạo thư mục ./cua-hang-cua-toi
cd cua-hang-cua-toi
create-ecomweb validate                       # kiểm tra theme.json, locales, màu...
create-ecomweb env up --dev                   # CMS thử bằng Docker, gắn thẳng thư mục theme
# mở http://localhost:8080 (tài khoản in ra màn hình), sửa file là thấy
create-ecomweb pack                           # tạo dist/<slug>-<version>.zip
```

### B. Sửa theme đang chạy trên một site có sẵn

```bash
create-ecomweb login --url https://site.com --token cmsp_…
create-ecomweb clone ten-theme                # mã nguồn theme về ./ten-theme
cd ten-theme
create-ecomweb dev --data https://site.com    # xem thử trên máy bằng dữ liệu thật của site
# ... sửa code ...
create-ecomweb pull                           # lấy thay đổi mới của server (nếu có người sửa trên site)
create-ecomweb push                           # đưa lên site, từ chối nếu server đã đổi
```

### C. Viết plugin

```bash
create-ecomweb plugin "Đánh giá sản phẩm" --admin --frontend --tests
cd danh-gia-san-pham
create-ecomweb validate
create-ecomweb check                          # chạy thử quy trình cài và quét bảo mật trên CMS, không cài thật
create-ecomweb test                           # chạy test xUnit trong tests/
create-ecomweb dev                            # tự đóng gói và cài lại mỗi khi lưu file
create-ecomweb pack                           # zip để nộp Store hoặc cài tay
```

---

## Tham chiếu lệnh

Cú pháp chung: `create-ecomweb <lệnh> [thư-mục] [--tham-số]`. `[thư-mục]` là thư mục theme/plugin, mặc định là thư mục hiện tại.

### Tạo mới: `theme`, `plugin`

#### `theme "Tên" [--parent default] [--blocks] [--dir x]`

Tạo theme mới. Slug sinh từ tên (bỏ dấu, chữ thường, gạch ngang). Thư mục đích mặc định là `./<slug>`; nếu đã tồn tại và không rỗng thì lệnh dừng.

| Tham số | Ý nghĩa |
|---|---|
| `--parent <slug>` | tạo **child theme** kế thừa theme cha (ví dụ `--parent default`): chỉ sinh vài file ghi đè như `templates/home.tsx`, phần còn lại lấy từ theme cha |
| `--blocks` | theme dựng bằng **khối**: giao diện nằm ở `parts/*.json` và `templates/*.json`, chỉnh trong Trình dựng (Builder) của trang quản trị, không cần viết React |
| `--dir <thư-mục>` | tạo ở thư mục khác thay vì `./<slug>` |

Theme mã (mặc định) sinh ra: `theme.json`, `layout.tsx`, `styles.css`, `extend.tsx` (nơi đăng ký shortcode, widget, slot), `templates/` (`index`, `single`, `404`, `home`), `locales/` (vi, en), `package.json`, `tsconfig.json`, `README.md`. Theme `--blocks` sinh thêm `parts/header.json`, `parts/footer.json` và `templates/` (`index`, `archive`, `single`, `page`, `404`) dạng JSON.

#### `plugin "Tên" [--admin] [--frontend] [--tests] [--project] [--no-backend] [--dir x]`

Tạo plugin mới, mặc định gồm `plugin.json` và **một file C#** (`<TenPlugin>.cs`); CMS tự biên dịch khi cài, không cần csproj hay .NET SDK.

| Tham số | Ý nghĩa |
|---|---|
| `--admin` | thêm giao diện quản trị React riêng (`admin/src/index.tsx`), kèm trang settings và menu khai báo trong `plugin.json`. Chỉ cần khi các trang tự sinh (`[AdminList]`, settings) không đủ |
| `--frontend` | thêm phần hiển thị trên website (`frontend/index.tsx`) |
| `--tests` | thêm dự án test xUnit trong `tests/` (dùng `Cms.Plugin.Testing`) và `nuget.config` |
| `--project` | backend là **dự án csproj** (`backend/<Ten>.csproj`), dùng khi cần nhiều file hoặc thư viện NuGet. Khi `pack` cần .NET SDK |
| `--no-backend` | không có backend C#. Phải kèm `--admin` hoặc `--frontend`, vì plugin cần ít nhất một phần |
| `--dir <thư-mục>` | thư mục đích |

Sinh ra thêm: `locales/` (vi, en), `package.json` và `tsconfig.json` (khi có `--admin` hoặc `--frontend`), `README.md`.

### Kiểm tra: `validate`, `check`, `test`

#### `validate [thư-mục]`

Kiểm tra **không cần mạng** trên `theme.json` hoặc `plugin.json`: tên, slug (`a-z`, `0-9`, gạch ngang, 2 đến 64 ký tự), version theo semver, các khoá dịch trong `locales/`, kiểu trường cấu hình, token màu và font bắt buộc của theme, file `"use client"` import nhầm entry server của SDK, màu viết cứng trong CSS, khoảng phiên bản CMS yêu cầu. In cảnh báo (`!`) và lỗi (`✗`); có lỗi thì thoát với mã khác 0, dùng được trong CI.

#### `check [thư-mục]` (chỉ plugin)

Đóng gói rồi gửi lên CMS để **chạy thử quy trình cài mà không cài**: kiểm manifest, biên dịch mã C#, quét bảo mật, giống hệt khi cài thật và khi nộp Store. In lỗi biên dịch, kết quả quét (`safe`, `warning`, `dangerous`, `blocked`) và từng phát hiện. Kết thúc thành công nếu gói cài được mà không cần xác nhận rủi ro. Cần kết nối tới một CMS (xem [Kết nối](#kết-nối-tới-một-site)). Với theme dùng `validate`, rồi `deploy`.

#### `test [thư-mục]` (plugin)

Đóng gói, rồi chạy `dotnet test` cho dự án trong `tests/`; thư viện `Cms.Plugin.Testing` cài gói lên một CMS thử rồi chạy các test. Cần .NET SDK. CMS được chọn theo [thông tin kết nối](#kết-nối-tới-một-site), ví dụ môi trường `env up`. Lệnh truyền cho test các biến `CMS_TEST_PACKAGE` (đường dẫn zip), `CMS_TEST_SLUG`, và `CMS_URL`, `CMS_USER`, `CMS_PASSWORD` nếu có. Không có `tests/*.csproj` thì báo lỗi và gợi ý tạo bằng `plugin "Tên" --tests`.

### Đóng gói và cài: `pack`, `deploy`, `dev`

#### `pack [thư-mục] [--out dist]`

Kiểm tra rồi đóng gói thành `dist/<slug>-<version>.zip` (hoặc thư mục `--out`). Gói dùng để nộp Store hoặc cài tay trong trang quản trị. Tuỳ loại:

- **Theme:** chép mã nguồn, bỏ các tệp không cần (xem dưới) và các mẫu trong `.ecomwebignore`.
- **Plugin:** chép `plugin.json`, mã C#, `locales/`, `skills/*.md`, `AI.md` và thư mục `public/` (tệp tĩnh phục vụ tại `/extensions/plugins/<slug>/public/…`). Plugin `--project` chạy `dotnet publish -c Release`. Plugin có phần `admin` thì bundle bằng esbuild thành `admin/index.js`.

Luôn bị loại: `node_modules`, `.git`, `dist`, `bin`, `obj`, `.next`, `.cms-env`, `.ecomweb`, `.DS_Store`, `.env` và `.env.*`.

#### `deploy [thư-mục] [--activate] [--accept-permissions] [--accept-risk]`

`pack` rồi **tải lên và cài** trên CMS. Hiện tiến trình: cài, chờ CMS khởi động lại nếu cần, chờ lượt build website xong. Build lỗi thì in 25 dòng cuối của log và website vẫn chạy bản trước.

| Tham số | Ý nghĩa |
|---|---|
| `--activate` | kích hoạt luôn sau khi cài (theme: build website với theme mới; plugin: bật plugin) |
| `--accept-permissions` | đồng ý thay quản trị viên khi gói xin **quyền mới** (CMS trả 409), giống bấm "Đồng ý" trong trang Plugin |
| `--accept-risk` | đồng ý khi bộ quét thấy hành vi **rủi ro cao** nhưng cho phép ghi đè (CMS trả 422). Chỉ dùng cho gói bạn tin nguồn gốc, ví dụ trên máy dev của chính bạn |
| `--url`, `--token`, `--user`, `--password` | xem [Kết nối](#kết-nối-tới-một-site) |

#### `dev [thư-mục]`

Đóng gói và cài lại **mỗi khi bạn lưu file** (gộp các lần lưu liên tiếp trong 0,4 giây), tự kích hoạt. Bỏ qua `dist`, `node_modules`, `bin`, `obj`, `.git`, `.next`. Dừng bằng Ctrl+C.

Khi CMS chạy bằng `env up --dev` và thư mục này đã được gắn vào, phần website (mọi file của theme, thư mục `frontend/` của plugin) **tự nạp lại không cần build**; chỉ đổi backend, admin, `plugin.json` hay `locales` mới cài lại.

### Làm việc với theme đang chạy trên site: `login`, `clone`, `pull`, `push`

Cần CMS 1.35 trở lên và token API (xem [Kết nối](#kết-nối-tới-một-site)).

#### `login --url URL --token cmsp_…`

Kiểm tra token rồi lưu vào `~/.config/ecomweb/config.json` (quyền 600). Lỗi 401 là token sai hoặc đã thu hồi; 403 là token không đủ quyền quản trị theme/plugin.

#### `clone <slug> [thư-mục] [--url …] [--token …]`

Tải **mã nguồn của theme đang chạy** trên site về `./<slug>` (hoặc thư mục chỉ định). Thư mục đích phải trống. Lệnh ghi `.ecomweb/remote.json` lưu phiên bản và mã băm từng file lúc lấy về, để `pull` và `push` biết ai đã sửa gì.

**Chỉ clone được theme.** Plugin cài trên server chỉ còn bản đã biên dịch (DLL, bundle), không còn mã nguồn; `--plugin` báo lỗi. Hãy giữ mã nguồn plugin ở repo của bạn rồi `deploy`.

#### `pull [thư-mục] [--force]`

Lấy phần **server đã đổi** về máy.

- Server chưa đổi: báo "Đã mới nhất".
- File chỉ server đổi: ghi về máy. File chỉ bạn đổi: giữ nguyên. Hai bên đã giống nhau: bỏ qua.
- File **cả hai bên cùng sửa**: dừng, liệt kê, **chưa ghi gì cả**. Sao lưu file của bạn rồi chạy `pull --force` để lấy bản server.
- File server đã xoá mà bạn chưa sửa thì bị xoá ở máy.

#### `push [thư-mục] [--force] [--activate] …`

Như `deploy` nhưng **an toàn khi nhiều người cùng sửa**: từ chối nếu server đã thay đổi kể từ lần `pull` (hoặc `clone`) gần nhất, và server cũng kiểm lại lúc nhận file. Thông báo lỗi cho biết phải `pull` trước. `--force` ghi đè bất chấp. Sau khi push thành công, bản trên server trở thành bản gốc mới. Nhận các tham số của `deploy`.

### Xem thử bằng dữ liệu thật: `dev --data`

```bash
create-ecomweb dev --data https://site.com [--port 3000] [--source DIR] [--store URL]
```

Chạy website **ngay trên máy bạn** (Node, không Docker) với theme đang viết, đọc dữ liệu thật của site qua API công khai. **Chỉ đọc, không ghi gì lên site.** Muốn đưa lên site thì dùng `push`.

Cách hoạt động:

1. Hỏi `<site>/api/health` để biết phiên bản CMS.
2. Tải mã website đúng phiên bản đó từ Store (kiểm chữ ký), lưu cache ở `~/.cache/ecomweb/website/<phiên bản>` (đổi chỗ bằng `ECOMWEB_CACHE_DIR`).
3. Chạy `npm install` một lần (khoảng một phút), rồi cài thêm các gói npm khai báo trong `package.json` của theme (phải ghi phiên bản cụ thể).
4. Chép theme vào website, đồng bộ mỗi khi sửa file; thêm hoặc xoá template thì tự sinh lại registry.
5. Chạy `next dev` ở `http://localhost:3000`.

Giới hạn: phần do **plugin vẽ** để trống; đăng nhập khách và giỏ hàng không chạy cục bộ.

| Tham số | Ý nghĩa |
|---|---|
| `--port` | cổng, mặc định 3000 |
| `--source <thư-mục>` | dùng mã website có sẵn (ví dụ thư mục `frontend/` của repo CMS) thay vì tải từ Store; được chép sang cache, không sửa nguồn |
| `--store <url>` | Store khác (mặc định `STORE_URL`, hoặc store.ecomcx.com). Store khác cần `STORE_PUBLIC_KEY` |

### CMS thử bằng Docker: `env`

Dựng nhanh một CMS đầy đủ (Postgres, Redis, API, website, Caddy) để thử theme/plugin mà **không cần mã nguồn CMS**. Dữ liệu và cấu hình nằm ở thư mục `.cms-env` (tự có `.gitignore`); tài khoản quản trị lưu ở `.cms-env/credentials.json`, các lệnh `deploy`, `dev`, `check` tự dùng nên không cần `--password`.

```bash
create-ecomweb env up [--dev] [--port 8080] [--build DIR] [--image IMG] [--mount DIR] [--title "..."] [--lang vi] [--no-setup]
create-ecomweb env status
create-ecomweb env logs [api|builder|...] [-f]
create-ecomweb env down [--purge]
```

**`env up`** dựng và chạy, chờ API và website sẵn sàng (lần đầu build mất 1 đến 2 phút), tự cài đặt CMS lần đầu và in địa chỉ cùng tài khoản. Lấy image CMS theo thứ tự: image dựng sẵn `ghcr.io/ecomcx-jsc/ecomweb:latest`; nếu không kéo được thì tải gói đã build mới nhất từ Store (kiểm chữ ký và SHA-256) và dựng image tại máy.

| Tham số | Ý nghĩa |
|---|---|
| `--dev` | website chạy `next dev`; theme/plugin ở thư mục hiện tại và các thư mục con (có `theme.json`, hoặc `plugin.json` có phần `frontend`) được **gắn thẳng** vào, sửa là thấy |
| `--mount <thư-mục>` | gắn thêm thư mục theme/plugin ở nơi khác (dùng nhiều lần được); chỉ có tác dụng với `--dev` |
| `--port <số>` | cổng, mặc định 8080. Cổng đang bận thì báo lỗi |
| `--build <thư-mục>` | build image từ mã nguồn CMS ở thư mục đó (khi bạn có repo CMS) |
| `--image <image>` | dùng image CMS khác (hoặc biến `CMS_IMAGE`). CMS 1.24 trở về trước dùng `--api-image` và `--builder-image` |
| `--store <url>` | Store khác để tải gói CMS (hoặc `STORE_URL`; cần `STORE_PUBLIC_KEY`) |
| `--title`, `--lang` | tên website và ngôn ngữ khi cài đặt lần đầu (mặc định "Website thử", `vi`) |
| `--no-setup` | không tự cài đặt; in mã cài đặt để bạn tự đi qua màn hình cài đặt |
| `--dir <thư-mục>` | thư mục môi trường, mặc định `.cms-env` |

**`env status`**: đang chạy hay đã dừng, địa chỉ, tài khoản. **`env logs`**: 200 dòng cuối, thêm tên dịch vụ để lọc, `-f` để theo dõi. **`env down`**: dừng và **giữ dữ liệu**; `--purge` xoá luôn dữ liệu và thư mục môi trường. Môi trường này chỉ để thử, không dùng cho website thật.

### Nâng SDK: `upgrade`

```bash
create-ecomweb upgrade [thư-mục]
```

Đưa project theme/plugin lên bản mới nhất của `@ecomcx/ecomweb-theme-sdk` và `@ecomcx/ecomweb-admin-sdk` (lấy từ npm): sửa `package.json`, gỡ bản cũ khỏi `node_modules` và `package-lock.json`, `npm install` lại, rồi `validate` để báo API cũ hoặc yêu cầu CMS mới hơn. Website không phụ thuộc bản trong project: CMS build theme/plugin bằng SDK của chính nó; bản trong project phục vụ gợi ý code, kiểm kiểu và `pack`.

---

## Biến môi trường và tệp cấu hình

| Tên | Dùng cho |
|---|---|
| `CMS_URL` | địa chỉ site, mặc định `http://localhost:5100` |
| `CMS_TOKEN` | token API (`cmsp_…`) |
| `CMS_USER`, `CMS_PASSWORD` | tài khoản và mật khẩu (không dùng được khi bật 2FA) |
| `CMS_IMAGE`, `CMS_API_IMAGE`, `CMS_BUILDER_IMAGE` | image CMS cho `env up` |
| `STORE_URL`, `STORE_PUBLIC_KEY` | Store khác cho `env up` và `dev --data` |
| `ECOMWEB_CONFIG_DIR` | đổi thư mục lưu token (mặc định `~/.config/ecomweb`) |
| `ECOMWEB_CACHE_DIR` | đổi thư mục cache website (mặc định `~/.cache/ecomweb`) |

| Tệp | Nội dung |
|---|---|
| `~/.config/ecomweb/config.json` | token theo từng site, quyền 600 |
| `.ecomweb/remote.json` | trong thư mục theme đã `clone`: phiên bản và mã băm file lúc lấy về. Đừng sửa tay và đừng xoá, mất thì `pull` và `push` không chạy được |
| `.cms-env/` | môi trường `env up`: `docker-compose.yml`, `credentials.json`, dữ liệu |

Nên thêm `.ecomweb`, `.cms-env` và `dist` vào `.gitignore` của project (`pack` đã tự bỏ qua chúng).

---

## Loại trừ tệp của theme: `.ecomwebignore`

Đặt file `.ecomwebignore` ở gốc **theme** để loại thêm tệp khỏi gói khi `pack`, `deploy`, `push` và khi `dev --data` chép theme. Mỗi dòng một mẫu, `#` là ghi chú.

```text
# thiết kế gốc, không cần trên server
design/
*.psd
docs/mockup-*.png
```

- `tên` hoặc `thư-mục/` khớp ở **mọi cấp**.
- `a/b` hoặc `/a` khớp **từ gốc**.
- `*` thay cho chuỗi bất kỳ trong một tên (không vượt qua dấu `/`).
- Chưa hỗ trợ `!` (phủ định) và `**`: mẫu như vậy bị bỏ qua.

---

## Xử lý lỗi thường gặp

| Thông báo | Nguyên nhân và cách xử lý |
|---|---|
| `Thiếu token: chạy create-ecomweb login …` | chưa có token hay mật khẩu. Tạo token ở **Hồ sơ › Token API** rồi chạy `login` |
| `Tài khoản bật xác thực 2 lớp` | dùng token API thay cho mật khẩu |
| `Token không hợp lệ hoặc đã bị thu hồi (401)` / `không đủ quyền (403)` | tạo token mới bằng tài khoản có quyền quản trị theme/plugin |
| `Thư mục này chưa được clone từ CMS` | `pull` và `push` chỉ chạy trong thư mục tạo bởi `clone` (cần `.ecomweb/remote.json`) |
| `Server đã thay đổi từ lần pull gần nhất` | chạy `pull` trước, hoặc `push --force` nếu chắc chắn muốn ghi đè |
| `Cả server và máy bạn đều sửa các file này` | sao lưu file của bạn, chạy `pull --force`, rồi gộp lại bằng tay |
| `409 … Quyền xin thêm: …` | gói xin quyền mới. Kiểm tra rồi chạy lại với `--accept-permissions` |
| `422 … bộ quét thấy hành vi rủi ro cao` | xem các phát hiện in ra; nếu tin gói, chạy lại với `--accept-risk` |
| `Cổng 8080 đang được dùng` | `env up --port 8081` |
| `Không kéo được image CMS` | thử `--image …`, hoặc `--build <thư-mục-mã-nguồn>`, hoặc kiểm tra mạng tới Store |
| `Không gọi được …/api/health` | sai địa chỉ site khi `dev --data` |
| `Build thất bại — website vẫn chạy bản trước` | đọc log in ra; theme hoặc plugin lỗi không làm hỏng website đang chạy |
| `Không thấy tests/*.csproj` | tạo plugin bằng `--tests` hoặc thêm dự án test theo tài liệu `Cms.Plugin.Testing` |

---

Theme và plugin import `@ecomcx/ecomweb-theme-sdk` và `@ecomcx/ecomweb-admin-sdk`; khung tạo ra cài chúng dưới dạng npm alias (`"@ecomcx/ecomweb-theme-sdk": "npm:@ecomcx/ecomweb-theme-sdk@^x.y.z"`). Hướng dẫn viết theme và plugin: `docs/theme-guide.md`, `docs/plugin-guide.md` trong repo core `Ecomcx-Jsc/ecomweb`. Tra cứu API theme SDK: [API.md](../theme-sdk/API.md).
