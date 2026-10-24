import { host } from "./host";
import type { AdminPage, AskOptions, DashboardWidget, Density, MetaBox, TableSettings, UiKit } from "./types";

export * from "./types";

export const registerPage = (page: AdminPage) => host().registerPage(page);
export const registerMetaBox = (box: MetaBox) => host().registerMetaBox(box);
/** Sidebar riêng trong trình soạn bài, kèm nút trên thanh hành động (CMS cũ chưa hỗ trợ thì bỏ qua). */
export const registerEditorSidebar = (s: import("./types").EditorSidebar) => host().registerEditorSidebar?.(s);
export const registerDashboardWidget = (w: DashboardWidget) => host().registerDashboardWidget(w);
/** Thêm cột vào danh sách bài viết/trang (vd điểm SEO). */
export const registerPostListColumn = (c: import("./types").PostListColumn) => host().registerPostListColumn(c);
/** Thêm hộp vào form sửa chuyên mục/thẻ (dữ liệu lưu trong term.meta). */
export const registerTermMetaBox = (b: import("./types").TermMetaBox) => host().registerTermMetaBox(b);
/** Lấy các MetaBox đã đăng ký trong hệ thống (tùy chọn lọc theo postType). */
export const getMetaBoxes = (postType?: string) => (host().getMetaBoxes ? host().getMetaBoxes!(postType) : []);
/** Hook lấy toàn bộ state plugin UI trong host. */
export const usePluginUi = () => (host().usePluginUi ? host().usePluginUi!() : { metaBoxes: [], pages: {}, dashboardWidgets: [], postListColumns: [], termMetaBoxes: [], loaded: true, errors: [] });
export const useApi = <T = any>(path: string | null) => host().useApi<T>(path);
export const can = (capability: string) => host().can(capability);
/**
 * Khối cho trình soạn nội dung, khai báo bằng defineBlock (file dùng chung với phần website của plugin):
 * trình soạn tự có mục slash menu, khung khối và form cài đặt sinh từ attributes. Nhãn "%khoá%" dịch theo
 * locales của plugin khi tên khối có tiền tố "slug/" (vd "lien-he/callout").
 */
export const registerBlock = (def: import("@ecomcx/ecomweb-content").BlockDefinition, options?: import("./types").RegisterBlockOptions) => {
  const editor = host().editor;
  if (!editor.registerBlock) throw new Error("registerBlock cần CMS ≥ 1.8.0 (trình soạn hỗ trợ defineBlock)");
  editor.registerBlock(def, options);
};
/**
 * Thêm panel vào tab "Khối" của trình soạn cho một số loại khối (kể cả khối lõi như "image", "button") hoặc mọi khối:
 *   registerBlockPanel({ id: "seo/link-rel", title: "%link.title%", blocks: ["button"], attributes: { sponsored: { default: false } }, component: Panel })
 * CMS cũ (chưa có tab "Khối") → bỏ qua, không lỗi.
 */
export const registerBlockPanel = (panel: import("./types").BlockPanel) => host().editor.registerBlockPanel?.(panel);
/**
 * Thêm mẫu (đoạn dựng sẵn) vào tab "Mẫu" của trình chèn:
 *   registerPattern({ name: "shop/product-hero", title: "%pattern.hero%", category: "hero", content: { type: "doc", content: [...] } })
 * CMS cũ (chưa có tab Mẫu) → bỏ qua, không lỗi.
 */
export const registerPattern = (pattern: import("./types").EditorPattern) => host().editor.registerPattern?.(pattern);
export { defineBlock, type BlockDefinition, type BlockDefinitionInput, type BlockAttrSpec } from "@ecomcx/ecomweb-content";
/** Thêm node/mark TipTap cho trình soạn (cấp thấp — khối thường dùng registerBlock). */
export const registerEditorExtension = (pack: import("./types").EditorExtensionPack) => host().editor.register(pack);
/** Lớp TipTap dùng chung với admin (không cần cài @tiptap/core trong plugin). */
export const tiptap = new Proxy({} as CmsAdminTiptap, { get: (_t, k: string) => (host().editor.tiptap as any)[k] });
type CmsAdminTiptap = import("./types").CmsAdmin["editor"]["tiptap"];
export const currentUser = () => host().currentUser();
/**
 * Công bố hàm cho plugin khác dùng trong admin (gọi ở đầu bundle):  exposeApi({ openCartDrawer, formatPrice })
 * Bên dùng:  const shop = await waitForPluginApi<ShopAdminApi>("shop");  shop?.formatPrice(1000)
 */
export const exposeApi = (api: Record<string, unknown>) => host().plugins?.expose("", api);
/** Hàm plugin khác đã công bố (undefined nếu plugin chưa bật hoặc bundle chưa nạp xong). */
export const getPluginApi = <T = Record<string, unknown>>(slug: string) => host().plugins?.get<T>(slug);
/** Chờ plugin khác nạp xong rồi lấy hàm (undefined nếu plugin không bật). */
export const waitForPluginApi = <T = Record<string, unknown>>(slug: string, timeoutMs?: number) =>
  host().plugins ? host().plugins!.wait<T>(slug, timeoutMs) : Promise.resolve(undefined);
/**
 * Dịch chuỗi giao diện theo khoá (ICU MessageFormat). Bản dịch của plugin đặt trong gói: locales/vi.json, locales/en.json
 * — CMS tự nạp với namespace = slug plugin:
 *   locales/en.json: { "form.title": "Contact", "form.count": "{count, plural, one {# message} other {# messages}}" }
 *   const t = createT("lien-he");  t("form.title") → "Contact";  t("form.count", { count: 3 }) → "3 messages"
 * Khoá có ":" là khoá đầy đủ ("core:common.save" — nhãn chung của lõi, "plugin-khac:x").
 */
export const t = (key: string, values?: Record<string, unknown>) => (host().i18n.t ? host().i18n.t!(key, values) : key);
/** Hàm dịch gắn sẵn namespace của plugin. */
export const createT = (namespace: string) => (key: string, values?: Record<string, unknown>) => t(key.includes(":") ? key : `${namespace}:${key}`, values);
/** Thêm bản dịch bằng mã (ngoài locales/*.json), vd bản dịch tải từ API. */
export const registerMessages = (namespace: string, locale: string, dict: Record<string, string>) => host().i18n.registerMessages?.(namespace, locale, dict);
/** @deprecated Chuỗi gốc tiếng Việt làm khoá — dùng t()/createT() với locales/*.json. */
export const __ = (text: string, ...args: unknown[]) => host().i18n.__(text, ...args);
/** @deprecated Dùng locales/*.json hoặc registerMessages(). */
export const registerTranslations = (locale: string, dict: Record<string, string>) => host().i18n.registerTranslations(locale, dict);
export const adminLocale = () => host().i18n.locale;

export const api = {
  get: <T = any>(p: string) => host().api.get<T>(p),
  post: <T = any>(p: string, b?: unknown) => host().api.post<T>(p, b),
  put: <T = any>(p: string, b?: unknown) => host().api.put<T>(p, b),
  del: <T = any>(p: string) => host().api.del<T>(p),
  upload: <T = any>(p: string, f: File, field?: string) => host().api.upload<T>(p, f, field),
};

export const notify = {
  success: (m: string) => host().notify.success(m),
  error: (m: string) => host().notify.error(m),
  info: (m: string) => host().notify.info(m),
};

// Component UI: lấy lười từ host để module plugin có thể được import trước khi render.
// `fallback`: dùng khi CMS cũ chưa có component đó (UI kit v2) — plugin vẫn chạy, chỉ giản dị hơn.
const ui = <K extends keyof UiKit>(name: K, fallback?: (props: any) => any): NonNullable<UiKit[K]> => ((props: any) => {
  const C = (host().ui[name] as any) ?? fallback;
  if (!C) { console.warn(`[admin-sdk] CMS chưa có ui.${String(name)} — cần bản CMS mới hơn`); return null; }
  return host().React.createElement(C, props);
}) as any;
const h = (...a: any[]) => (host().React.createElement as any)(...a);

export const registerSlot = (slot: import("./types").AdminSlotItem) => host().registerSlot(slot);
export const getSlots = (slot: string, postType?: string) => (host().getSlots ? host().getSlots(slot, postType) : []);
export const registerPostRowAction = (a: import("./types").PostRowAction) => host().registerPostRowAction(a);
/** Thao tác hàng loạt trên danh sách bài (CMS ≥ 1.2.0). */
export const registerPostBulkAction = (a: import("./types").PostBulkAction) => host().registerPostBulkAction?.(a);
/** Bộ lọc theo meta trên danh sách bài (CMS ≥ 1.2.0). */
export const registerPostListFilter = (f: import("./types").PostListFilter) => host().registerPostListFilter?.(f);
/** Hộp trong trang sửa thành viên / hồ sơ, lưu vào user meta (CMS ≥ 1.2.0). */
export const registerUserProfileBox = (b: import("./types").UserProfileBox) => host().registerUserProfileBox?.(b);
/** Cột / nút trên dòng / thao tác hàng loạt cho danh sách người dùng, bình luận, media (list: "users" | "comments" | "media"). */
export const registerListColumn = (c: import("./types").ListColumn) => host().registerListColumn?.(c);
export const registerListRowAction = (a: import("./types").ListRowAction) => host().registerListRowAction?.(a);
export const registerListBulkAction = (a: import("./types").ListBulkAction) => host().registerListBulkAction?.(a);
export const getPostRowActions = (postType?: string) => (host().getPostRowActions ? host().getPostRowActions(postType) : []);

export const hooks = new Proxy({} as import("./types").AdminHookRegistry, {
  get: (_t, k: string) => (host().hooks as any)?.[k] ?? (() => {}),
});
export const addAction = (hook: string, namespace: string, cb: (...args: any[]) => void, priority?: number) => host().hooks.addAction(hook, namespace, cb, priority);
export const doAction = (hook: string, ...args: any[]) => host().hooks.doAction(hook, ...args);
export const addFilter = <T = any>(filter: string, namespace: string, cb: (v: T, ...args: any[]) => T, priority?: number) => host().hooks.addFilter(filter, namespace, cb, priority);
export const applyFilters = <T = any>(filter: string, value: T, ...args: any[]) => host().hooks.applyFilters(filter, value, ...args);
export const removeAction = (hook: string, namespace: string) => host().hooks.removeAction(hook, namespace);
export const removeFilter = (filter: string, namespace: string) => host().hooks.removeFilter(filter, namespace);
export const hasAction = (hook: string, namespace?: string) => host().hooks.hasAction(hook, namespace);
export const hasFilter = (filter: string, namespace?: string) => host().hooks.hasFilter(filter, namespace);

export const Button = ui("Button");
export const Input = ui("Input");
export const Textarea = ui("Textarea");
export const Select = ui("Select");
export const Checkbox = ui("Checkbox");
export const Field = ui("Field");
export const Card = ui("Card");
export const PageHeader = ui("PageHeader");
export const Table = ui("Table");
export const Badge = ui("Badge");
export const Modal = ui("Modal");
export const Spinner = ui("Spinner");
export const EmptyState = ui("EmptyState");
export const MediaPicker = ui("MediaPicker");
export const Switch = ui("Switch");
export const IconButton = ui("IconButton");
export const Section = ui("Section");
export const Tabs = ui("Tabs");
export const MetaBoxes = ui("MetaBoxes");
export const Slot = ui("Slot");
export const Fill = ui("Fill");

// ----- UI kit v2 (xem trang /ui-kit trong admin) -----
export const Dialog = ui("Dialog", (p) => h(host().ui.Modal, p));
export const Drawer = ui("Drawer", (p) => h(host().ui.Modal, p));
export const Popover = ui("Popover");
export const DropdownMenu = ui("DropdownMenu");
export const MenuItem = ui("MenuItem");
export const MenuSeparator = ui("MenuSeparator", () => null);
export const MenuLabel = ui("MenuLabel");
export const Tooltip = ui("Tooltip", (p) => p.children);
export const Skeleton = ui("Skeleton", (p) => h("div", { className: p.className }));
export const Combobox = ui("Combobox", (p) => h(host().ui.Select, {
  value: p.value ?? "", disabled: p.disabled, "aria-label": p.ariaLabel, onChange: (e: any) => p.onChange(e.target.value || null),
  options: [{ value: "", label: p.placeholder ?? "—" }, ...p.options],
}));
export const TagInput = ui("TagInput", (p) => h(host().ui.Input, {
  defaultValue: p.value.join(", "), placeholder: p.placeholder, "aria-label": p.ariaLabel, disabled: p.disabled,
  onBlur: (e: any) => p.onChange(String(e.target.value).split(",").map((x: string) => x.trim()).filter(Boolean)),
}));
export const DatePicker = ui("DatePicker", (p) => h(host().ui.Input, {
  type: p.withTime ? "datetime-local" : "date", value: p.value ?? "", min: p.min, max: p.max, disabled: p.disabled, "aria-label": p.ariaLabel,
  onChange: (e: any) => p.onChange(e.target.value || null),
}));
export const RadioGroup = ui("RadioGroup", (p) => h(host().ui.Select, {
  value: p.value, disabled: p.disabled, "aria-label": p.ariaLabel, onChange: (e: any) => p.onChange(e.target.value),
  options: p.options.map((o: any) => ({ value: o.value, label: typeof o.label === "string" ? o.label : o.value })),
}));
export const TreeView = ui("TreeView");
export const Pagination = ui("Pagination");
export const TableSettingsMenu = ui("TableSettingsMenu", () => null);

/** Cột ẩn + mật độ của một bảng, nhớ theo `key` (vd "my-plugin:orders"). CMS cũ: không lưu, mọi cột hiện. */
export function useTableSettings(key: string, defaults?: { hidden?: string[]; density?: Density }): TableSettings {
  const fn = host().ui.useTableSettings;
  if (fn) return fn(key, defaults);
  return { hidden: defaults?.hidden ?? [], density: defaults?.density ?? "comfortable", toggleColumn: () => {}, setDensity: () => {} };
}
const pad = (n: number) => String(n).padStart(2, "0");
/** ISO (UTC) → giá trị cho `DatePicker withTime` (giờ địa phương). */
export const isoToLocal = (iso?: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
/** Giá trị của `DatePicker withTime` → ISO (UTC). */
export const localToIso = (v: string | null): string | null => (v ? new Date(v).toISOString() : null);

/** Hỏi xác nhận bằng hộp thoại của admin (CMS cũ: window.confirm). `danger` = nút đỏ, focus mặc định ở "Huỷ". */
export const confirmDialog = (message: string, opts?: AskOptions): Promise<boolean> =>
  host().ui.confirmDialog ? host().ui.confirmDialog!(message, opts) : Promise.resolve(window.confirm(message));
/** Hỏi một chuỗi; null khi huỷ (CMS cũ: window.prompt). */
export const promptDialog = (message: string, opts?: AskOptions & { defaultValue?: string; placeholder?: string }): Promise<string | null> =>
  host().ui.promptDialog ? host().ui.promptDialog!(message, opts) : Promise.resolve(window.prompt(message, opts?.defaultValue ?? ""));
/** Báo một thông điệp, chờ người dùng bấm OK (CMS cũ: window.alert). */
export const alertDialog = (message: string, opts?: AskOptions): Promise<void> =>
  host().ui.alertDialog ? host().ui.alertDialog!(message, opts) : Promise.resolve(window.alert(message));
