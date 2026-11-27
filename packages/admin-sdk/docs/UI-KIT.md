# Bộ UI của admin cho plugin

Mọi thứ dưới đây lấy từ `@ecomcx/ecomweb-admin-sdk` — **không cài thêm gì** (không React, dnd-kit, thư viện ảnh…). Plugin dùng đúng bộ này để giao diện đồng nhất với admin và đổi theo chế độ sáng / tối.

Màu: dùng biến CSS của admin (`var(--app-fg)`, `--app-muted`, `--app-faint`, `--app-border`, `--app-panel`, `--app-subtle`, `--app-accent`, `--app-danger`, `--app-success`, `--app-warning`), không viết mã màu cứng.

## Quy tắc (8 quy tắc vàng của Shneiderman, áp cho admin)
1. **Nhất quán**: danh sách = tab + tìm + lọc + chọn nhiều (`ResourceList`); trang sửa = hai cột + nút ở chân.
2. **Dùng được cho mọi người**: phím tắt (⌘S lưu), nhãn đầy đủ, vùng chạm ≥ 44px trên điện thoại.
3. **Phản hồi**: nút `loading`, thông báo `notify`, ✓ khi dữ liệu hợp lệ.
4. **Có điểm kết**: tạo nhanh xong tự chọn vào ô và đóng ngăn (`Drawer`).
5. **Ngăn lỗi**: chọn thay vì gõ (`Combobox`, `TreeSelect`); báo lỗi ngay tại ô, nói cách sửa.
6. **Hoàn tác**: xoá có «Hoàn tác» (`notify` + hành động), xoá thật chỉ qua thùng rác.
7. **Người dùng nắm quyền**: khối kéo sắp xếp được, cảnh báo khi rời trang chưa lưu (`useUnsavedGuard`).
8. **Giảm gánh nặng trí nhớ**: thấy ngay ảnh, tồn kho; ô nhập luôn có `placeholder` là ví dụ thật.

## Quy ước API (mọi component mới và nâng cấp phải theo)
- **Tên prop thống nhất:** `size` (`sm` · `md` · `lg`), `variant`, `status` (`error` · `warning`), `disabled`, `loading`, `className`. Không đặt tên khác cho cùng ý (`invalid`, `isLoading`, `small`…).
- **Giá trị:** điều khiển bằng `value` + `onChange(value)` (nhận thẳng giá trị, không nhận sự kiện DOM). Riêng thành phần bọc thẻ gốc (`Input`, `Textarea`) giữ `onChange(event)` như React. `Select` còn `onChange` giả `<select>` chỉ để tương thích code cũ; viết mới dùng `onValueChange`.
- **Nhãn:** thành phần có chữ (nút, công tắc, ô chọn) nhận chữ qua `children`; `label` / `ariaLabel` chỉ là tên cho trình đọc màn hình khi không có chữ hiện ra.
- **Bàn phím và đọc màn hình là bắt buộc:** mọi thành phần tương tác có tên, thứ tự Tab hợp lý, phím mũi tên cho danh sách, Escape đóng lớp phủ, focus nhìn thấy được.
- **Chữ giao diện qua `t()`** (đa ngôn ngữ), không viết cứng — kể cả nhãn, tên màu, chữ mẫu của trang danh mục. Lõi có `node scripts/i18n-check.mjs` chặn chữ cứng trong `src/ui/` và `pages/UiKit*`. Nhãn của trình soạn văn bản nằm ở `rich.*` trong `locales/core/*.json` (thêm ngôn ngữ chỉ cần thả một file JSON).
- **Màu chỉ lấy từ token** (bảng dưới), kích thước theo thang 4px; không hardcode màu hay pixel lạ.
- **Mỗi component có mặt trong trang danh mục `/admin/ui-kit`** với đủ trạng thái, và có test (`e2e/ui-kit.spec.ts`).

## Trạng thái đang tải (`loading`)
Quy ước chung cho thành phần có trạng thái bận:
- Giữ nguyên **kích thước** (không giật bố cục), đặt `aria-busy="true"`, chặn bấm lặp.
- Nút đang `loading` nhìn **khác** nút `disabled` (không làm mờ như nhau): chữ vẫn rõ, có spinner.
- Spinner chỉ hiện sau ~150ms để tác vụ nhanh không nháy.
- Kiểu hiện đại cùng dùng được: `loading={mutation.isPending}` (react-query), `useTransition`, `<form action>` + `useFormStatus` (React 19), `Suspense` với `Skeleton` làm `fallback`.

| Có `loading` | Không cần (chỉ hiển thị) |
|---|---|
| `Button`, `IconButton`, `Select`/`Combobox`, `Table`/`ResourceList` (đã có) | `Badge`, `Tooltip`, `Tabs`, `Kbd`, `Divider` |
| `Input`, `Switch`, `Card`/`Stat`, `Dialog` (nút xác nhận), `DatePicker` (**chưa có, sẽ thêm**) | |

## Token (hợp đồng công khai)
Biến CSS `--app-*` đổi theo chế độ sáng/tối; lớp Tailwind tương ứng: `bg-bg` `bg-panel` `bg-subtle` `bg-hover` `border-line` (`--app-border`) `border-line-strong` `text-fg` `text-muted` `text-faint` `bg-accent` `bg-accent-soft` `text-accent` `text-brand` `bg-danger` `text-success` `text-warning`. Chuyển động: `--ease-out`, `--dur-1/2/3`, tự tắt khi người dùng chọn giảm chuyển động. Xem toàn bộ, kèm chế độ tối, ở `/admin/ui-kit`.

## Form và phản hồi (CMS ≥ 1.42)
```tsx
import { Alert, Badge, Button, CheckboxGroup, Field, Input, Progress, SearchInput, Switch, Tabs, Textarea } from "@ecomcx/ecomweb-admin-sdk";

<Field label="Tên" required error={errors.name}><Input status={errors.name ? "error" : undefined} showCount maxLength={80} clearable /></Field>
<Field label="Giá"><Input suffix="₫" inputMode="numeric" /></Field>
<Field label="Mật khẩu"><Input type="password" revealable /></Field>
<Field label="Mô tả" optional><Textarea autosize={{ minRows: 3, maxRows: 8 }} showCount maxLength={500} /></Field>
<Field label="Kênh bán" layout="horizontal"><CheckboxGroup value={ch} onChange={setCh} options={[{ value: "web", label: "Website" }]} /></Field>
<SearchInput placeholder="Tìm đơn hàng…" onChange={(e) => setQ(e.target.value)} />

<Button variant="primary" onClick={async () => { await save(); }}>Lưu</Button>   {/* tự bận (spinner, khoá bấm) tới khi save() xong */}
<Button variant="soft" size="lg">…</Button>  <Button variant="link" href="/admin/orders">Xem đơn</Button>  <Button size="icon" aria-label="Cài đặt"><Cog /></Button>
<Switch checked={on} onChange={toggle} loading={busy}>Cho phép đặt trước</Switch>   {/* có children thì hiện nhãn */}
<Badge tone="green" variant="solid" size="sm">Đang bán</Badge>  <Badge onRemove={() => remove(tag)}>{tag}</Badge>
<Tabs variant="pills" value={tab} onChange={setTab} items={[{ value: "all", label: "Tất cả", count: 12 }, { value: "x", label: "Đã huỷ", disabled: true }]} />
<Alert tone="warning" title="Sắp hết hàng" action={<Button size="sm">Nhập thêm</Button>}>3 sản phẩm dưới ngưỡng.</Alert>
<Progress value={64} label="Nhập dữ liệu" showValue />   <Progress indeterminate label="Đang chuẩn bị…" />
```
- Không dùng tính năng thêm thì `Input` / `Textarea` vẫn chỉ là một thẻ gốc (mọi thuộc tính HTML chạy tiếp).
- `status="error"` hoặc `<Field error>` đều đặt `aria-invalid`; `status="warning"` chỉ đổi viền (không chặn gửi).
- CMS cũ chưa có: `hasUi("Alert")`; SDK tự dựng bản đơn giản cho `Alert`, `Progress`, `SearchInput`, `CheckboxGroup`, `SkeletonText`. Biến thể và cỡ mới của `Button`, `Badge`, `Tabs`… sẽ không có tác dụng.

## Chữ nội bộ của bộ UI và cách đổi (CMS ≥ 1.42)
Có hai loại chữ, và chỉ một loại là việc của bạn:
- **Chữ của bạn** (nhãn, `children`, `placeholder`, `emptyText`, `loadingText`…): bạn tự dịch bằng i18n của plugin (`createT` + `locales/*.json`).
- **Chữ do bộ UI tự thêm** (nút xoá, "trang sau", "hôm nay", "chọn tất cả", "đang tải"…): lõi tự dịch theo ngôn ngữ admin, bạn không phải làm gì.

Muốn đổi chữ của bộ UI, ba tầng, ưu tiên từ trên xuống:
```tsx
import { Button, Input, Pagination, UiLabelsProvider } from "@ecomcx/ecomweb-admin-sdk";

<Input clearable labels={{ clear: "Gỡ giá trị" }} />                       {/* 1. prop `labels` — chỉ component này */}

<UiLabelsProvider labels={{ previous: "Quay lại", next: "Tiếp tục", items: "{total} đơn hàng" }}>
  <Pagination page={p} totalPages={9} total={87} onPage={setP} />           {/* 2. cả nhánh bên trong; lồng nhau thì nhánh trong thắng theo từng khoá */}
</UiLabelsProvider>

<Button loading={busy} loadingText={t("saving")}>{t("save")}</Button>      {/* chữ hiện lúc đang bận do bạn tự dịch */}
```
- Tầng 3 (mặc định) là khoá `ui.*` trong `locales/core/*.json` của lõi. Thêm ngôn ngữ cho lõi chỉ cần thả một file JSON.
- Khoá đổi được: `addTag` `clear` `close` `columns` `confirm` `confirmTitle` `density` `densityComfortable` `densityCompact` `dismiss` `hidePassword` `items` `loading` `month` `moreTags` `next` `nextMonth` `noData` `noMatches` `notifications` `now` `ok` `optional` `pageN` `pagination` `perPage` `pickDate` `previous` `previousMonth` `remove` `removeTag` `search` `selectAll` `selectRow` `showPassword` `tableSettings` `time` `today` `view` `year`. Chuỗi có `{tên}` được thay giá trị.
- `labels` có trên `Input`, `SearchInput`, `Field`, `Badge`, `Alert`, `Table`, `Pagination`, `DatePicker`, `Select`, `Combobox`, `TagInput`.
- **Không** dùng `registerMessages("core", …)` để đổi chữ: lõi bỏ qua (kèm cảnh báo) vì nó đổi chữ của cả admin. Dùng `labels` / `UiLabelsProvider`.
- CMS cũ: `UiLabelsProvider` chỉ hiện nội dung bên trong, `labels` không có tác dụng (dùng `hasUi("UiLabelsProvider")` để biết).

## Layout: không tự viết `display:grid` hay media query
Bộ layout co giãn theo **bề rộng khung chứa** (không theo màn hình), nên đặt trong Drawer / Modal / cột hẹp vẫn đúng. Mốc khung chứa: `sm` ≥ 512px · `md` ≥ 672px · `lg` ≥ 896px; dưới 512px mọi lưới là 1 cột. Cần CMS ≥ 1.42 (`hasUi("Page")`); CMS cũ tự rơi về flex / lưới tự chia.
```tsx
import { Page, Toolbar, Grid, Col, Stat, SplitView, DefinitionList, Stack, Row, Card, Table, Button, Input } from "@ecomcx/ecomweb-admin-sdk";

<Page width="full" title="Đơn hàng" actions={<Button variant="primary">Tạo đơn</Button>}>   {/* full · container (≈1152px, mặc định) · narrow (≈768px) */}
  <Stack gap={4}>
    <Grid min={180}>{/* tự chia cột, mỗi ô ≥ 180px: 1 cột trên điện thoại */}
      <Stat label="Doanh thu" value="128 triệu" /><Stat label="Đơn hàng" value="342" />
    </Grid>
    <Toolbar start={<Input placeholder="Tìm đơn…" />} end={<Button>Xuất file</Button>} />
    <Table columns={cols} rows={rows} />
  </Stack>
</Page>

<Page title="Đơn #1024" aside={<Card title="Khách hàng">…</Card>}>…</Page>             {/* cột phụ dính khi cuộn */}
<Grid cols={{ base: 1, md: 2, lg: 3 }}><Col span={{ md: 2 }}>…</Col><Col>…</Col></Grid>   {/* chia theo mốc */}
<DefinitionList cols={{ sm: 2 }} items={[{ label: "Email", value: "an@example.com" }]} />
```
- `Page`: chọn độ rộng bằng `width`, đừng tự đặt `max-w-*`. Có `aside` thì tự chia `SplitView`: cột phụ cố định bề rộng, **đứng yên khi cuộn** và chỉ tự cuộn khi cao hơn khung nhìn; khung chứa < 768px xếp 1 cột.
- `Row` tự xuống dòng khi hết chỗ; `gap` là 0 · 1 · 2 · 3 · 4 · 6 · 8 (đơn vị 4px).
- `Table` có bề rộng tối thiểu theo số cột: màn hẹp thì cuộn ngang trong khung chứ không bóp cột thành dải khó đọc.

## Trang plugin rộng
```tsx
registerPage({ path: "/shop/products/edit", component: ProductEdit, width: "fluid" }); // "wide" 1600px · "fluid" gần hết chiều ngang
```

## Kéo thả
```tsx
import { SortableList, SortableBoard, SortableHandle } from "@ecomcx/ecomweb-admin-sdk";

// Danh sách / lưới kéo đổi thứ tự — chuột, cảm ứng (nhấn giữ), bàn phím (Space, ↑↓, Space, Esc)
<SortableList items={options} getId={(o) => o.id} onChange={setOptions} render={(o, s) => (
  <div style={{ display: "flex", gap: 8 }}><SortableHandle handle={s.handle} /> {o.name}</div>
)} />

// Hai cột khối, kéo khối trong cột hoặc sang cột kia; cột trống vẫn thả được; `fixed` = không kéo
<SortableBoard columns={{ main: ["info", "media"], side: ["status", "org"] }} onChange={saveLayout} fixed={["info"]}
  className="two-col" render={(id, s) => (
    <Card title={<><SortableHandle handle={s.handle} /> {titles[id]}</>}>{blocks[id]}</Card>
  )} />
```
Lưu bố cục: `localStorage` theo id người dùng (`currentUser().id`); khối mới của plugin khác tự rơi vào cuối cột mặc định.

## Ảnh và video
```tsx
<MediaGallery items={gallery} onChange={setGallery} accept="image/,video/" max={20} />
// items: { id, url, type?: "image"|"video", alt?, posterUrl? } — ảnh đầu là ảnh đại diện; thả tệp từ máy, bấm để xem phóng to, ✎ sửa alt
<DropZone accept=".csv" multiple={false} onFiles={([f]) => importCsv(f)} />
<Lightbox items={imgs} index={i} onIndex={setI} onClose={close} />
```

## Danh sách, lọc, hàng loạt
```tsx
<ResourceList columns={cols} rows={rows} rowKey={(r) => r.id} tabs={tabs} tab={tab} onTab={setTab}
  search={{ value: q, onChange: setQ, placeholder: "Tìm theo tên, SKU" }}
  bulkActions={[{ key: "draft", label: "Chuyển nháp", onRun: (ids) => … }, { key: "del", label: "Xoá", danger: true, onRun: … }]}
  onRowClick={openQuickView} page={{ page, totalPages, total, onPage }} />
```
Bấm dòng mở `Drawer` xem / sửa nhanh; bấm tên sang trang đầy đủ bằng `navigate("/shop/products/edit?id=1")` (không tải lại trang).

## Ngăn trượt tạo nhanh
```tsx
<Drawer open={open} onClose={close} title="Thêm thương hiệu" width={440}
  footer={<><Button onClick={close}>Huỷ</Button><Button variant="primary" onClick={saveAndPick}>Tạo và chọn</Button></>}>…</Drawer>
```

## Chọn có tìm kiếm
`Combobox` (một giá trị), `TagInput` (nhiều giá trị / nhập thẻ), `TreeSelect` (cây danh mục), `MoneyInput`, `NumberInput`, `DatePicker`. Không trải cả danh sách dài ra trang.

## Ô nhập: luôn có placeholder
Mọi `Input` / `Textarea` / `Combobox` có `placeholder` là **ví dụ thật** ("Ví dụ: Áo thun cotton", "0901 234 567", "SKU-001"). Ô chọn: "Chọn danh mục…".
