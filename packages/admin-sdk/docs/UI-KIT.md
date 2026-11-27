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
