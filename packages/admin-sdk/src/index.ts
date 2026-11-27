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
/**
 * Thêm hộp vào trang sửa đối tượng của plugin khác (đơn hàng, mã giảm giá, dòng bảng [PluginTable] có cột [ObjectMeta]…) —
 * giá trị đặt qua setMeta được plugin chủ lưu cùng đối tượng. CMS < 1.18.0: bỏ qua.
 */
export const registerObjectMetaBox = (b: import("./types").ObjectMetaBox) => host().registerObjectMetaBox?.(b);
/** Hộp đã đăng ký cho một đối tượng (bỏ trống = tất cả). */
export const getObjectMetaBoxes = (object?: string) => host().getObjectMetaBoxes?.(object) ?? [];
/** Lấy các MetaBox đã đăng ký trong hệ thống (tùy chọn lọc theo postType). */
export const getMetaBoxes = (postType?: string) => (host().getMetaBoxes ? host().getMetaBoxes!(postType) : []);
/** Hook lấy toàn bộ state plugin UI trong host. */
export const usePluginUi = () => (host().usePluginUi ? host().usePluginUi!() : { metaBoxes: [], pages: {}, dashboardWidgets: [], postListColumns: [], termMetaBoxes: [], loaded: true, errors: [] });
export const useApi = <T = any>(path: string | null) => host().useApi<T>(path);
/**
 * Đường dẫn của trang plugin: tham số theo mẫu đã đăng ký, query, điều hướng (CMS ≥ 1.20.0):
 *   registerPage({ path: "/orders/:id", component: OrderPage });
 *   function OrderPage() { const { params, navigate } = useAdminRoute(); … navigate("/orders"); }
 * CMS cũ: params rỗng, navigate tải lại trang.
 */
export const useAdminRoute = (): import("./types").AdminRoute => host().useAdminRoute?.() ?? {
  path: typeof location === "undefined" ? "/" : location.pathname, params: {},
  query: typeof location === "undefined" ? {} : Object.fromEntries(new URLSearchParams(location.search)),
  navigate: (to: string) => { if (typeof location !== "undefined") location.assign(to); },
};
/** Điều hướng trong admin từ bất kỳ đâu (kể cả ngoài component) — CMS < 1.20.0: tải lại trang. */
export const navigate = (to: string, opts?: { replace?: boolean }) => {
  const h = host();
  if (h.navigate) h.navigate(to, opts);
  else if (typeof location !== "undefined") location.assign(to);
};
/** Loại trường của plugin cho form tự sinh (settings, widget) — CMS < 1.20.0: bỏ qua (form hiện ô chữ). */
export const registerFieldType = (def: import("./types").FieldTypeDefinition) => host().registerFieldType?.(def);
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
/** (CMS ≥ 1.29) Mục trong menu ⋮ của thanh công cụ khối: registerBlockAction({ id: "acme/reset", label: "%reset%", run: (c) => c.setAttrs({ acmeRotate: undefined }) }). */
export const registerBlockAction = (action: import("./types").BlockAction) => host().editor.registerBlockAction?.(action);
/** (CMS ≥ 1.29) Khối có mặt / đổi thuộc tính trong khung soạn → fn(el, attrs); trả hàm dọn. CMS cũ → không làm gì. */
export const onBlockReady = (type: string, fn: (el: HTMLElement, attrs: Record<string, unknown>) => void | (() => void)) => host().editor.onBlockReady?.(type, fn) ?? (() => {});
/** (CMS ≥ 1.29) Script / stylesheet nạp vào khung soạn khi nội dung có khối / class khớp (cùng danh sách definePlugin({ assets }) của website). */
export const registerBlockAssets = (assets: Parameters<NonNullable<import("./types").CmsAdmin["editor"]["registerBlockAssets"]>>[0]) => host().editor.registerBlockAssets?.(assets);
/**
 * Thêm hiệu ứng khi cuộn tới vào danh sách chọn của mọi khối (tab Kiểu dáng › Chuyển động). Plugin cần nạp CSS `@keyframes ecx-in-<id>`
 * cho website (slot "head") và đặt cùng chuỗi đó ở `css` để xem thử trong trình soạn:
 *   registerAnimation({ id: "acme-bounce", label: __("Nảy"), group: "Acme", css: "@keyframes ecx-in-acme-bounce{…}" })
 * CMS cũ → bỏ qua, không lỗi.
 */
export const registerAnimation = (effect: import("./types").MotionEffect) => host().editor.registerAnimation?.(effect);
export const unregisterAnimation = (id: string) => host().editor.unregisterAnimation?.(id);
/**
 * Thêm mẫu (đoạn dựng sẵn) vào tab "Mẫu" của trình chèn:
 *   registerPattern({ name: "shop/product-hero", title: "%pattern.hero%", category: "hero", content: { type: "doc", content: [...] } })
 * CMS cũ (chưa có tab Mẫu) → bỏ qua, không lỗi.
 */
export const registerPattern = (pattern: import("./types").EditorPattern) => host().editor.registerPattern?.(pattern);
/**
 * Nguồn dữ liệu cho mục "Gắn dữ liệu" của trình soạn (đoạn văn, tiêu đề, ảnh, nút…):
 *   registerBindingSource({ name: "shop/product", label: "%binding.product%", fields: [{ value: "price", label: "%binding.price%" }] })
 * Website lấy giá trị bằng definePlugin({ bindingSources: { "shop/product": (args, ctx) => … } }) của theme-sdk.
 * CMS cũ → bỏ qua, không lỗi.
 */
export const registerBindingSource = (source: import("./types").EditorBindingSource) => host().editor.registerBindingSource?.(source);
export { defineBlock, type BlockDefinition, type BlockDefinitionInput, type BlockAttrSpec } from "@ecomcx/ecomweb-content";
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

/** Việc AI có sẵn của core (Cài đặt › AI): chữ, tiêu đề, slug, thẻ, mô tả SEO, dịch… */
export type AiTask = "rewrite" | "shorten" | "expand" | "fix" | "summarize" | "excerpt" | "seo_description" | "title" | "titles" | "slug" | "tags" | "write" | "translate" | "custom";

/**
 * AI của core cho plugin (CMS ≥ 1.26.0): dùng khoá API, giới hạn lượt/tháng và nhà cung cấp mà chủ site đã cài —
 * plugin không giữ khoá riêng. Plugin phải khai quyền "ai" trong plugin.json (CMS ≥ 1.26.2; chủ site đồng ý khi cài, tắt / đặt hạn mức riêng
 * ở Cài đặt › AI). AI chỉ nhận đúng đoạn chữ plugin gửi — không có công cụ, không đọc được dữ liệu của website. Mỗi lượt gọi tính vào giới hạn tháng; lỗi (chưa bật, sai khoá, hết lượt) ném Error có thông báo dễ hiểu.
 * Người dùng cần quyền sửa bài. Hiện nút AI chỉ khi `enabled`.
 */
/** Plugin nào đang chạy mã này: ghi nhận lúc bundle nạp (host đặt owner). Máy chủ kiểm quyền "ai" + chính sách của plugin đó. */
const AI_OWNER = (() => { try { const o = host().currentOwner?.(); return o && o !== "core" ? o : undefined; } catch { return undefined; } })();

export const ai = {
  status: () => api.get<{ enabled: boolean; provider?: string; model?: string; used: number; limit: number }>("/admin/ai/status"),
  /** `slot`: chỗ dùng AI (skill của slot được ghép vào lời nhắc); bỏ trống = suy ra từ việc. */
  run: async (task: AiTask, text: string, opts?: { language?: string; instruction?: string; slot?: import("./types").AiSlot }) => (await api.post<{ text: string }>("/admin/ai/run", { task, text, ...opts, plugin: AI_OWNER })).text,
  /** Yêu cầu tự do: instruction = việc cần làm, text = nội dung đầu vào. */
  ask: (instruction: string, text: string, opts?: { slot?: import("./types").AiSlot }) => ai.run("custom", text, { instruction, ...opts }),
  /**
   * Đề xuất thay đổi (không ghi thẳng): tạo một bộ thay đổi để người dùng duyệt ở `<ChangesetReview id>` hoặc AI › Thay đổi.
   * Nguồn = "plugin:<slug>" của plugin đang gọi (hoặc "chat" ngoài plugin).
   */
  proposeChanges: (title: string, items: import("./types").ChangeInput[]) =>
    api.post<import("./types").Changeset>("/admin/changesets", { title, source: AI_OWNER ? `plugin:${AI_OWNER}` : "chat", items: items.map((i) => ({ ...i, target: String(i.target) })) }),
};
/**
 * Hook: `{ enabled, reason, run, ask }` — `enabled` false khi AI của website tắt / thiếu cấu hình, hoặc (CMS ≥ 1.26.11) chủ site
 * tắt AI cho plugin này / plugin hết lượt tháng. `reason`: "site" | "plugin" | "limit" (null khi dùng được) — để hiện một dòng
 * hướng dẫn thay vì ẩn hẳn, vd "Bật AI cho plugin ở Cài đặt › AI".
 */
export const useAi = () => {
  const status = useApi<{ enabled: boolean; pluginEnabled?: boolean | null; reason?: "site" | "plugin" | "limit" | null }>(
    AI_OWNER ? `/admin/ai/status?plugin=${encodeURIComponent(AI_OWNER)}` : "/admin/ai/status");
  const d = status.data;
  const enabled = !!d?.enabled && d.pluginEnabled !== false;
  return { enabled, reason: d ? (enabled ? null : d.reason ?? "site") : null, run: ai.run, ask: ai.ask };
};

type NotifyArg = import("./types").NotifyOptions | { label: string; onClick(): void };
export const notify = {
  success: (m: string, o?: NotifyArg) => host().notify.success(m, o),
  error: (m: string, o?: NotifyArg) => host().notify.error(m, o),
  info: (m: string, o?: NotifyArg) => host().notify.info(m, o),
  /** Cảnh báo. CMS cũ: hiện như thông báo thường. */
  warning: (m: string, o?: NotifyArg) => (host().notify.warning ?? host().notify.info)(m, o),
  /** Thông báo "đang chạy"; gọi `.success()` / `.error()` trên kết quả khi xong. CMS cũ: hiện một thông báo, rồi thông báo kết quả riêng. */
  loading: (m: string, o?: import("./types").NotifyOptions): import("./types").LoadingToast => {
    const n = host().notify;
    if (n.loading) return n.loading(m, o);
    n.info(m);
    return { id: 0, update: () => {}, dismiss: () => {}, success: (m2) => n.success(m2), error: (m2) => n.error(m2) };
  },
  /** Theo dõi một Promise: "đang chạy" → thành công / lỗi. Trả lại chính Promise đó. */
  promise: <T,>(p: Promise<T>, msgs: { loading: string; success: string | ((v: T) => string); error: string | ((e: unknown) => string) }, o?: import("./types").NotifyOptions): Promise<T> => {
    const n = host().notify;
    if (n.promise) return n.promise(p, msgs, o);
    n.info(msgs.loading);
    p.then((v) => n.success(typeof msgs.success === "function" ? msgs.success(v) : msgs.success), (e) => n.error(typeof msgs.error === "function" ? msgs.error(e) : msgs.error));
    return p;
  },
  /** Đóng một thông báo (theo id) hoặc tất cả. CMS cũ: không làm gì. */
  dismiss: (id?: number | string) => host().notify.dismiss?.(id),
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
/** Ẩn bớt phần trình soạn bài (CMS ≥ 1.35.0; CMS cũ bỏ qua). */
export const registerEditorPanelFilter = (f: import("./types").EditorPanelFilter) => host().registerEditorPanelFilter?.(f);
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
/** Icon AI chuẩn: `<Button icon={<AiIcon />}>` (CMS < 1.26.11: không vẽ gì). */
export const AiIcon = ui("AiIcon", () => null);
/** Xem trước và áp dụng một bộ thay đổi AI: `<ChangesetReview id={cs.id} onDone={...} />` (CMS cũ: không vẽ gì). */
export const ChangesetReview = ui("ChangesetReview", () => null);
/** Ô giữ chỗ trong `edit` của khối (CMS ≥ 1.31; CMS cũ: không vẽ gì): thả media, gõ chữ có gợi ý, dán link, chọn từ danh sách, "+ Thêm khối". */
export const MediaPlaceholder = ui("MediaPlaceholder", () => null);
export const TextPlaceholder = ui("TextPlaceholder", () => null);
export const LinkPlaceholder = ui("LinkPlaceholder", () => null);
export const PickPlaceholder = ui("PickPlaceholder", () => null);
export const AddBlockButton = ui("AddBlockButton", () => null);
export const Section = ui("Section");
export const Tabs = ui("Tabs");
export const MetaBoxes = ui("MetaBoxes");
/** Plugin chủ vẽ chỗ cho hộp của plugin khác trong trang sửa đối tượng của mình (CMS < 1.18.0: không vẽ gì). */
export const ObjectMetaBoxes = ui("ObjectMetaBoxes", () => null);
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
// Menu nâng cao (CMS mới). CMS cũ: bản gần đúng dựng từ MenuItem / MenuLabel, không mất chức năng chọn.
export const MenuCheckboxItem = ui("MenuCheckboxItem", (p) => h(host().ui.MenuItem, { onClick: () => p.onCheckedChange(!p.checked), icon: p.icon, disabled: p.disabled, keepOpen: p.keepOpen }, `${p.checked ? "✓ " : ""}`, p.children));
export const MenuRadioGroup = ui("MenuRadioGroup", (p) => h(host().React.Fragment, null, p.label ? h(host().ui.MenuLabel, null, p.label) : null, p.children));
export const MenuRadioItem = ui("MenuRadioItem", (p) => h(host().ui.MenuItem, { icon: p.icon, disabled: p.disabled, keepOpen: p.keepOpen }, p.children));
export const MenuGroup = ui("MenuGroup", (p) => h(host().React.Fragment, null, h(host().ui.MenuLabel, null, p.label), p.children));
export const MenuSub = ui("MenuSub", (p) => h(host().React.Fragment, null, h(host().ui.MenuLabel, null, p.label), p.children));
export const ContextMenu = ui("ContextMenu", (p) => h(host().React.Fragment, null, p.children));
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

// ----- Bộ component bán hàng / quản trị (CMS ≥ 1.39; CMS cũ dùng bản thay thế đơn giản hoặc không vẽ gì) -----
export const MoneyInput = ui("MoneyInput", (p) => h(host().ui.Input, {
  value: p.value ?? "", disabled: p.disabled, "aria-label": p.ariaLabel, inputMode: "numeric",
  onChange: (e: any) => { const n = Number(String(e.target.value).replace(/[^\d-]/g, "")); p.onChange(e.target.value === "" || !Number.isSafeInteger(n) ? null : n); },
}));
export const NumberInput = ui("NumberInput", (p) => h(host().ui.Input, {
  value: p.value ?? "", disabled: p.disabled, "aria-label": p.ariaLabel, inputMode: "decimal",
  onChange: (e: any) => { const n = Number(String(e.target.value).replace(",", ".")); p.onChange(e.target.value === "" || !Number.isFinite(n) ? null : n); },
}));
export const FilterChips = ui("FilterChips", () => null);
export const StickyActionBar = ui("StickyActionBar", (p) => h("div", { style: { display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap" } },
  h("span", null, p.title), h("span", null, p.children,
    h(host().ui.Button, { onClick: p.onSave, loading: p.saving, variant: "primary" }, p.saveLabel ?? "Save"))));
export const ResourceList = ui("ResourceList", (p) => h(host().ui.Table, { columns: p.columns, rows: p.rows, rowKey: p.rowKey, loading: p.loading, empty: p.empty, onRowClick: p.onRowClick }));
export const MediaGallery = ui("MediaGallery", () => null);
export const SortableList = ui("SortableList", () => null) as NonNullable<import("./types").UiKit["SortableList"]>;
export const SortableBoard = ui("SortableBoard", () => null);
export const SortableHandle = ui("SortableHandle", () => null);
export const DropZone = ui("DropZone", () => null);
export const Lightbox = ui("Lightbox", () => null);
export const ContentEditor = ui("ContentEditor", () => null);
/** Ô nhập HTML dùng chung. CMS cũ chưa có thì hiện ô văn bản thô (sửa thẳng HTML) để không mất dữ liệu. */
export const RichTextEditor = ui("RichTextEditor", (p) => h(host().ui.Textarea, { value: p.value ?? "", rows: 8, onChange: (e: any) => p.onChange(e.target.value), disabled: p.readOnly, "aria-label": p.ariaLabel }));
/** Host có sẵn thành phần UI này chưa (CMS cũ thì chưa): để plugin chọn ô nhập dự phòng thay vì bản rút gọn của SDK. */
export const hasUi = (name: keyof import("./types").UiKit) => !!host().ui[name];
// Nền tảng form + phản hồi. CMS cũ: bản đơn giản bằng thẻ gốc, không mất nội dung.
export const Alert = ui("Alert", (p) => h("div", { role: p.tone === "danger" || p.tone === "warning" ? "alert" : "status", className: p.className, style: { padding: 12, borderRadius: 8, border: "1px solid var(--app-border, #ddd)", background: "var(--app-subtle, #f5f5f5)", fontSize: 13 } },
  p.title ? h("div", { style: { fontWeight: 600 } }, p.title) : null, p.children, p.action ? h("div", { style: { marginTop: 8 } }, p.action) : null));
export const Progress = ui("Progress", (p) => h("div", null, p.label ? h("div", { style: { fontSize: 12 } }, p.label) : null,
  h("progress", { max: p.max ?? 100, value: p.indeterminate ? undefined : p.value, "aria-label": p.ariaLabel ?? (typeof p.label === "string" ? p.label : undefined), style: { width: "100%" } })));
export const SearchInput = ui("SearchInput", (p) => h(host().ui.Input, { type: "search", ...p }));
export const SkeletonText = ui("SkeletonText", (p) => h("div", { "aria-hidden": true }, ...Array.from({ length: p.lines ?? 3 }, (_: unknown, i: number) => h("div", { key: i, style: { height: 12, margin: "6px 0", width: i === (p.lines ?? 3) - 1 ? "60%" : "100%", background: "var(--app-hover, #eee)", borderRadius: 4 } }))));
export const CheckboxGroup = ui("CheckboxGroup", (p) => h("div", { role: "group", "aria-label": p.ariaLabel, style: { display: "flex", flexDirection: p.direction === "horizontal" ? "row" : "column", flexWrap: "wrap", gap: 8 } },
  ...p.options.map((o: any) => h(host().ui.Checkbox, { key: o.value, checked: p.value.includes(o.value), label: o.label, description: o.description, disabled: p.disabled || o.disabled,
    onChange: (on: boolean) => p.onChange(on ? [...p.value, o.value] : p.value.filter((v: string) => v !== o.value)) }))));

/** Xác nhận ngay cạnh nút. CMS cũ: bấm nút thì hiện hộp thoại xác nhận (`confirm`) rồi gọi `onConfirm`. */
export const Popconfirm = ui("Popconfirm", (p) => {
  const child = p.children;
  return host().React.cloneElement(child, { onClick: async (e: unknown) => {
    child.props.onClick?.(e);
    const msg = typeof p.title === "string" ? p.title : String(p.description ?? "");
    const ask = host().ui.confirmDialog;
    const ok = await (ask ? ask(msg, { danger: p.danger, confirmLabel: p.confirmLabel, cancelLabel: p.cancelLabel }) : Promise.resolve(window.confirm(msg)));
    if (ok) await p.onConfirm(); else p.onCancel?.();
  } });
});
/** Chọn giờ "HH:mm". CMS cũ: ô `<input type="time">`. */
export const TimePicker = ui("TimePicker", (p) => h("input", { type: "time", value: p.value ?? "", disabled: p.disabled, "aria-label": p.ariaLabel, min: p.min, max: p.max, step: (p.step ?? 5) * 60, onChange: (e: any) => p.onChange(e.target.value || null) }));
/** Chọn khoảng ngày. CMS cũ: hai ô `DatePicker` (từ — đến). */
export const DateRangePicker = ui("DateRangePicker", (p) => h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
  h(host().ui.DatePicker, { value: p.value?.from ?? null, max: p.value?.to ?? p.max, min: p.min, ariaLabel: p.ariaLabel, disabled: p.disabled, onChange: (v: string | null) => p.onChange({ from: v, to: p.value?.to ?? null }) }),
  h(host().ui.DatePicker, { value: p.value?.to ?? null, min: p.value?.from ?? p.min, max: p.max, disabled: p.disabled, onChange: (v: string | null) => p.onChange({ from: p.value?.from ?? null, to: v }) })));
// Thành phần hiển thị / tiện ích (CMS mới). CMS cũ: bản gần đúng bằng thẻ gốc của trình duyệt, không mất nội dung.
const ini = (n?: string) => { const w = (n ?? "").trim().split(/\s+/).filter(Boolean); return w.length === 0 ? "" : (w.length === 1 ? w[0].slice(0, 2) : w[0][0] + w[w.length - 1][0]).toUpperCase(); };
const dim = { xs: 20, sm: 24, md: 32, lg: 40, xl: 56 } as const;
const fbAvatar = (p: any) => p.src ? h("img", { src: p.src, alt: p.name ?? "", style: { width: dim[p.size as keyof typeof dim] ?? 32, height: dim[p.size as keyof typeof dim] ?? 32, borderRadius: p.shape === "square" ? 6 : "50%", objectFit: "cover" } })
  : h("span", { role: "img", "aria-label": p.name, style: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: dim[p.size as keyof typeof dim] ?? 32, height: dim[p.size as keyof typeof dim] ?? 32, borderRadius: p.shape === "square" ? 6 : "50%", background: "var(--app-accent-soft, #eee)", fontSize: 12 } }, ini(p.name));
export const Avatar = ui("Avatar", fbAvatar);
export const AvatarGroup = ui("AvatarGroup", (p) => h("div", { role: "group", style: { display: "flex", gap: 4 } }, ...p.items.slice(0, p.max ?? 4).map((a: any, i: number) => h(Avatar as any, { key: i, ...a, size: p.size })), p.items.length > (p.max ?? 4) ? h("span", null, `+${p.items.length - (p.max ?? 4)}`) : null));
export const Breadcrumb = ui("Breadcrumb", (p) => h("nav", { "aria-label": "Breadcrumb" }, h("ol", { style: { display: "flex", gap: 6, listStyle: "none", padding: 0, margin: 0, flexWrap: "wrap" } },
  ...p.items.map((it: any, i: number) => h("li", { key: i }, i === p.items.length - 1 ? h("span", { "aria-current": "page" }, it.label) : it.href ? h("a", { href: it.href, onClick: it.onClick ? (e: any) => { e.preventDefault(); it.onClick(); } : undefined }, it.label) : h("span", null, it.label), i < p.items.length - 1 ? " / " : null)))));
export const Accordion = ui("Accordion", (p) => h("div", { className: p.className }, ...p.items.map((it: any) => h("details", { key: it.value, open: (p.value ?? p.defaultValue ?? []).includes(it.value) }, h("summary", null, it.title), h("div", null, it.content)))));
export const Steps = ui("Steps", (p) => h("ol", { style: { display: "flex", gap: 12, listStyle: "none", padding: 0, flexWrap: "wrap" } }, ...p.items.map((it: any, i: number) => h("li", { key: i, "aria-current": i === p.current ? "step" : undefined, style: { fontWeight: i === p.current ? 600 : 400 } }, `${i + 1}. `, it.title))));
export const Divider = ui("Divider", (p) => (p.orientation === "vertical" ? h("span", { role: "separator", "aria-orientation": "vertical", style: { display: "inline-block", width: 1, height: 16, background: "var(--app-border, #ddd)", margin: "0 4px" } }) : h("hr", { className: p.className })));
export const CopyButton = ui("CopyButton", (p) => h(host().ui.Button, { onClick: () => navigator.clipboard?.writeText(p.value), "aria-label": "Copy" }, p.label ?? "Copy"));
export const CodeBlock = ui("CodeBlock", (p) => h("pre", { className: p.className, style: { overflow: "auto", maxHeight: p.maxHeight, whiteSpace: p.wrap ? "pre-wrap" : "pre" } }, h("code", null, p.code)));
export const Slider = ui("Slider", (p) => h("input", { type: "range", value: p.value, min: p.min ?? 0, max: p.max ?? 100, step: p.step ?? 1, disabled: p.disabled, "aria-label": p.ariaLabel, onChange: (e: any) => p.onChange(Number(e.target.value)) }));
export const RangeSlider = ui("RangeSlider", (p) => h("div", { style: { display: "flex", gap: 8 } },
  h("input", { type: "range", value: p.value[0], min: p.min ?? 0, max: p.value[1], step: p.step ?? 1, "aria-label": p.ariaLabel, onChange: (e: any) => p.onChange([Number(e.target.value), p.value[1]]) }),
  h("input", { type: "range", value: p.value[1], min: p.value[0], max: p.max ?? 100, step: p.step ?? 1, "aria-label": p.ariaLabel, onChange: (e: any) => p.onChange([p.value[0], Number(e.target.value)]) })));
// ---- Ô nhập nâng cao (CMS mới). CMS cũ: bản gần đúng bằng thẻ gốc. Các hàm thuần dưới đây chạy trên mọi CMS. ----
/** Chuẩn hoá mã màu về "#rrggbb" / "#rrggbbaa" (chữ thường); không hợp lệ thì null. */
export function normalizeColor(v: string | null | undefined): string | null {
  const m = (v ?? "").trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(m)) return "#" + [...m].map((c) => c + c).join("");
  return /^([0-9a-f]{6}|[0-9a-f]{8})$/.test(m) ? "#" + m : null;
}
/** Danh sách khoá – giá trị → object (bỏ dòng khoá trống). */
export const kvToRecord = (list: import("./types").KV[]): Record<string, string> => Object.fromEntries(list.filter((r) => r.key.trim()).map((r) => [r.key.trim(), r.value]));
export const kvFromRecord = (rec: Record<string, string> | null | undefined): import("./types").KV[] => Object.entries(rec ?? {}).map(([key, value]) => ({ key, value }));
/** Lọc tệp theo loại (`accept` như thuộc tính HTML) / dung lượng / số lượng: trả về tệp hợp lệ và tệp bị loại kèm lý do. */
export function validateFiles(files: File[], o: { accept?: string; maxSize?: number; maxFiles?: number; current?: number }): { accepted: File[]; rejected: import("./types").RejectedFile[] } {
  const typeOk = (f: File) => !o.accept || o.accept.split(",").some((a) => { a = a.trim().toLowerCase(); return a.endsWith("/*") ? f.type.startsWith(a.slice(0, -1)) : a.startsWith(".") ? f.name.toLowerCase().endsWith(a) : f.type === a; });
  const accepted: File[] = [], rejected: import("./types").RejectedFile[] = [];
  for (const f of files) {
    if (!typeOk(f)) rejected.push({ file: f, reason: "type" });
    else if (o.maxSize !== undefined && f.size > o.maxSize) rejected.push({ file: f, reason: "size" });
    else if (o.maxFiles !== undefined && (o.current ?? 0) + accepted.length >= o.maxFiles) rejected.push({ file: f, reason: "count" });
    else accepted.push(f);
  }
  return { accepted, rejected };
}
/** 1536 → "1.5 KB" (theo ngôn ngữ trình duyệt). */
export const formatBytes = (n: number) => { const u = ["B", "KB", "MB", "GB"]; let i = 0, v = n; while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; } return `${v.toLocaleString(undefined, { maximumFractionDigits: i ? 1 : 0 })} ${u[i]}`; };

export const ColorPicker = ui("ColorPicker", (p) => h("input", { type: "color", value: normalizeColor(p.value)?.slice(0, 7) ?? "#000000", disabled: p.disabled, "aria-label": p.ariaLabel, onChange: (e: any) => p.onChange(e.target.value) }));
export const KeyValueEditor = ui("KeyValueEditor", (p) => h("textarea", { rows: 4, disabled: p.disabled, "aria-label": p.ariaLabel, value: p.value.map((r: any) => `${r.key}=${r.value}`).join("\n"),
  onChange: (e: any) => p.onChange(String(e.target.value).split(/\r?\n/).filter(Boolean).map((l: string) => { const m = l.match(/^([^=]*)=(.*)$/); return m ? { key: m[1], value: m[2] } : { key: l, value: "" }; })) }));
export const FileUpload = ui("FileUpload", (p) => h("input", { type: "file", accept: p.accept, multiple: p.multiple ?? true, disabled: p.disabled, "aria-label": p.ariaLabel,
  onChange: (e: any) => { const { accepted, rejected } = validateFiles([...e.target.files], p); if (rejected.length) p.onReject?.(rejected); if (accepted.length) p.onFiles(accepted); e.target.value = ""; } }));
export const PinInput = ui("PinInput", (p) => h("input", { value: p.value, maxLength: p.length ?? 6, inputMode: p.type === "text" ? "text" : "numeric", autoComplete: "one-time-code", disabled: p.disabled, "aria-label": p.ariaLabel,
  onChange: (e: any) => { const v = String(e.target.value); p.onChange(v); if (v.length === (p.length ?? 6)) p.onComplete?.(v); } }));
export const Editable = ui("Editable", (p) => h("input", { defaultValue: p.value, placeholder: p.placeholder, disabled: p.disabled, "aria-label": p.ariaLabel, onBlur: (e: any) => { if (e.target.value !== p.value) void p.onCommit(e.target.value); } }));

// ---- Hook tiện ích (viết trong SDK nên chạy trên mọi CMS) ----
/** Bật / tắt một trạng thái (hộp thoại, ngăn trượt, menu…): `{ open, onOpen, onClose, toggle, set }`. */
export function useDisclosure(initial = false) {
  const R = host().React as typeof import("react");
  const [open, set] = R.useState(initial);
  return { open, set, onOpen: R.useCallback(() => set(true), []), onClose: R.useCallback(() => set(false), []), toggle: R.useCallback(() => set((v) => !v), []) };
}
/** Sao chép chữ vào clipboard: `copy(text)` trả true / false; `copied` bật ~`timeout` ms rồi tự tắt. */
export function useClipboard({ timeout = 1500 }: { timeout?: number } = {}) {
  const R = host().React as typeof import("react");
  const [copied, setCopied] = R.useState(false);
  const timer = R.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  R.useEffect(() => () => clearTimeout(timer.current), []);
  const copy = R.useCallback(async (text: string) => {
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch {
      const ta = document.createElement("textarea"); ta.value = text; ta.style.cssText = "position:fixed;opacity:0"; document.body.append(ta); ta.select();
      try { ok = document.execCommand("copy"); } finally { ta.remove(); }
    }
    if (ok) { setCopied(true); clearTimeout(timer.current); timer.current = setTimeout(() => setCopied(false), timeout); }
    return ok;
  }, [timeout]);
  return { copy, copied };
}
/** Giá trị trễ `ms` mili giây sau lần đổi cuối (ô tìm kiếm gọi máy chủ). */
export function useDebouncedValue<T>(value: T, ms = 300): T {
  const R = host().React as typeof import("react");
  const [v, setV] = R.useState(value);
  R.useEffect(() => { const id = setTimeout(() => setV(value), ms); return () => clearTimeout(id); }, [value, ms]);
  return v;
}
/** Trạng thái của một media query (`"(min-width: 768px)"`). Máy chủ / không có `matchMedia` thì false. */
export function useMediaQuery(query: string): boolean {
  const R = host().React as typeof import("react");
  const get = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false);
  const [m, setM] = R.useState(get);
  R.useEffect(() => { if (typeof window === "undefined" || !window.matchMedia) return; const mq = window.matchMedia(query); const on = () => setM(mq.matches); on(); mq.addEventListener("change", on); return () => mq.removeEventListener("change", on); }, [query]);
  return m;
}
export type Breakpoint = "base" | "sm" | "md" | "lg" | "xl" | "2xl";
/** Mốc màn hình hiện tại theo Tailwind: base < 640 ≤ sm < 768 ≤ md < 1024 ≤ lg < 1280 ≤ xl < 1536 ≤ 2xl. */
export function useBreakpoint(): Breakpoint {
  const [sm, md, lg, xl, x2] = [useMediaQuery("(min-width: 640px)"), useMediaQuery("(min-width: 768px)"), useMediaQuery("(min-width: 1024px)"), useMediaQuery("(min-width: 1280px)"), useMediaQuery("(min-width: 1536px)")];
  return x2 ? "2xl" : xl ? "xl" : lg ? "lg" : md ? "md" : sm ? "sm" : "base";
}
/** Chuỗi phím tắt → có khớp sự kiện không. `mod` = Ctrl (Windows / Linux) hoặc ⌘ (macOS). Vd "mod+k", "shift+/", "escape", "alt+s". */
export function matchHotkey(combo: string, e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">): boolean {
  const parts = combo.toLowerCase().split("+").map((x) => x.trim()), key = parts.pop() ?? "";
  const want = { mod: parts.includes("mod"), ctrl: parts.includes("ctrl"), meta: parts.includes("meta"), alt: parts.includes("alt"), shift: parts.includes("shift") };
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  const modOk = want.mod ? (isMac ? e.metaKey : e.ctrlKey) : true;
  const ctrlOk = want.ctrl ? e.ctrlKey : want.mod ? true : !e.ctrlKey;
  const metaOk = want.meta ? e.metaKey : want.mod ? true : !e.metaKey;
  const k = e.key.toLowerCase(), kk = key === "esc" ? "escape" : key;
  // Không đòi Shift thì chỉ chấp nhận Shift khi phím là ký hiệu cần Shift để gõ ("?" "/"…): chữ và số mà có Shift là tổ hợp khác
  const shiftOk = want.shift ? e.shiftKey : e.shiftKey ? !/^[a-z0-9]$/.test(k) : true;
  return modOk && ctrlOk && metaOk && e.altKey === want.alt && shiftOk && k === kk;
}
/**
 * Đăng ký phím tắt: `useHotkeys({ "mod+k": openPalette, "escape": close })`. Mặc định bỏ qua khi đang gõ trong ô nhập (trừ tổ hợp có mod / alt).
 * `enabled: false` tạm tắt; `target` mặc định là `document`.
 */
export function useHotkeys(map: Record<string, (e: KeyboardEvent) => void>, o: { enabled?: boolean; allowInInputs?: boolean; target?: EventTarget | null } = {}) {
  const R = host().React as typeof import("react");
  const ref = R.useRef(map); ref.current = map;
  const { enabled = true, allowInInputs = false } = o;
  R.useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    const t = o.target ?? document;
    const on = (ev: Event) => {
      const e = ev as KeyboardEvent, el = e.target as HTMLElement | null;
      const typing = !!el?.closest?.('input,textarea,select,[contenteditable="true"]');
      for (const [combo, fn] of Object.entries(ref.current)) {
        if (!matchHotkey(combo, e)) continue;
        if (typing && !allowInInputs && !/(mod|alt|ctrl|meta)\+/i.test(combo) && !/^(escape|esc)$/i.test(combo)) continue;
        e.preventDefault(); fn(e); return;
      }
    };
    t.addEventListener("keydown", on);
    return () => t.removeEventListener("keydown", on);
  }, [enabled, allowInInputs, o.target]);
}
export const UiLabelsProvider = ui("UiLabelsProvider", (p) => h(host().React.Fragment, null, p.children));
// Bộ layout (CMS ≥ 1.42). CMS cũ: bản đơn giản bằng flex / lưới tự chia — vẫn co giãn được, chỉ không theo mốc khung chứa.
const gapPx = (g: number = 4) => g * 4;
export const Stack = ui("Stack", (p) => h("div", { className: p.className, style: { display: "flex", flexDirection: "column", gap: gapPx(p.gap), minWidth: 0 } }, p.children));
export const Row = ui("Row", (p) => h("div", { className: p.className, style: { display: "flex", flexWrap: p.wrap === false ? "nowrap" : "wrap", gap: gapPx(p.gap ?? 2), alignItems: ({ start: "flex-start", center: "center", end: "flex-end", stretch: "stretch", baseline: "baseline" } as any)[p.align ?? "center"], justifyContent: ({ start: "flex-start", center: "center", end: "flex-end", between: "space-between" } as any)[p.justify ?? "start"], minWidth: 0 } }, p.children));
export const Grid = ui("Grid", (p) => h("div", { className: p.className, style: { display: "grid", gap: gapPx(p.gap), minWidth: 0, gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${p.min ?? 220}px), 1fr))` } }, p.children));
export const Col = ui("Col", (p) => h("div", { className: p.className, style: { minWidth: 0 } }, p.children));
export const SplitView = ui("SplitView", (p) => h("div", { className: p.className, style: { display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" } },
  h("div", { style: { flex: "1 1 360px", minWidth: 0 } }, p.main), h("div", { style: { flex: `0 1 ${p.asideWidth ?? 340}px`, minWidth: 0 } }, p.aside)));
export const Page = ui("Page", (p) => h("div", { className: p.className, style: { minWidth: 0, margin: p.width === "full" ? undefined : "0 auto", maxWidth: p.width === "narrow" ? 768 : p.width === "full" ? undefined : 1152 } },
  p.title ? h(host().ui.PageHeader, { title: p.title, description: p.description, actions: p.actions }) : null,
  p.aside ? h(SplitView, { main: p.children, aside: p.aside, asideWidth: p.asideWidth }) : p.children));
export const Toolbar = ui("Toolbar", (p) => h("div", { className: p.className, style: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 } },
  p.start ? h("div", { style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, flex: "1 1 0", minWidth: 0 } }, p.start) : null,
  p.end ? h("div", { style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 } }, p.end) : null));
export const DefinitionList = ui("DefinitionList", (p) => h("dl", { className: p.className, style: { display: "grid", gap: "12px 24px", margin: 0, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))" } },
  ...p.items.map((it: any, i: number) => h("div", { key: i, style: { minWidth: 0 } }, h("dt", { style: { fontSize: 12, opacity: 0.7 } }, it.label), h("dd", { style: { margin: "2px 0 0", overflowWrap: "anywhere" } }, it.value)))));
export const Stat = ui("Stat", (p) => h("div", { style: { minWidth: 0, border: "1px solid var(--app-border, #ddd)", borderRadius: 8, padding: 16 } },
  h("div", { style: { fontSize: 12, opacity: 0.7 } }, p.label), h("div", { style: { fontSize: 24, fontWeight: 600, marginTop: 4 } }, p.value), p.hint ? h("div", { style: { fontSize: 12, opacity: 0.7, marginTop: 4 } }, p.hint) : null));

/** Thêm nút vào thanh công cụ của RichTextEditor. CMS cũ: không làm gì, trả hàm rỗng. */
export const registerRichTextButton = (button: import("./types").RichTextButton): (() => void) => host().registerRichTextButton?.(button) ?? (() => {});
export const TreeSelect = ui("TreeSelect", () => null);
export const ActivityLog = ui("ActivityLog", () => null);
/** Cảnh báo khi đóng tab / bấm link nội bộ lúc `dirty`. CMS cũ: chỉ cảnh báo khi đóng tab. */
export function useUnsavedGuard(dirty: boolean) {
  const fn = host().ui.useUnsavedGuard;
  if (fn) { fn(dirty); return; }
  const R = host().React as any;
  R.useEffect(() => {
    if (!dirty) return;
    const before = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty]);
}

/** Cột ẩn + mật độ của một bảng, nhớ theo `key` (vd "my-plugin:orders"). CMS cũ: không lưu, mọi cột hiện. */
export function useTableSettings(key: string, defaults?: { hidden?: string[]; density?: Density }): TableSettings {
  const fn = host().ui.useTableSettings;
  if (fn) return fn(key, defaults);
  return { hidden: defaults?.hidden ?? [], density: defaults?.density ?? "comfortable", toggleColumn: () => {}, setDensity: () => {} };
}
/**
 * Trạng thái của một bảng đọc dữ liệu từ máy chủ: trang, cỡ trang, sắp xếp, bộ lọc cột, tìm kiếm (đổi bất cứ cái nào trừ trang thì về trang 1).
 * `const t = useTableState({ url: "orders" })` → `useQuery({ queryKey: ["orders", t.query], … })`, `<Table {...t.tableProps} />`, `<Pagination {...t.paginationProps(total)} />`.
 * CMS cũ: bản đơn giản (không đồng bộ URL, không debounce).
 */
export function useTableState(opts?: import("./types").TableStateOptions): import("./types").TableState {
  const fn = host().ui.useTableState;
  if (fn) return fn(opts);
  const R = host().React as typeof import("react");
  const size = opts?.pageSize ?? 25;
  const [page, setPageRaw] = R.useState(1);
  const [pageSize, setPageSizeRaw] = R.useState(size);
  const [sort, setSortRaw] = R.useState<import("./types").SortState>(opts?.sort ?? null);
  const [filters, setFilters] = R.useState<import("./types").FilterMap>(opts?.filters ?? {});
  const [search, setSearchRaw] = R.useState(opts?.search ?? "");
  const empty = (v: unknown) => v === undefined || v === "" || (Array.isArray(v) && !v.length) || (typeof v === "object" && v !== null && !Array.isArray(v) && Object.values(v).every((x) => x === undefined || x === ""));
  const clean = R.useMemo(() => Object.fromEntries(Object.entries(filters).filter(([, v]) => !empty(v))) as import("./types").FilterMap, [filters]);
  const sig = JSON.stringify([page, pageSize, sort, clean, search]);
  const query = R.useMemo(() => ({ page, pageSize, sort, filters: clean, search }), [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  const setFilter = (key: string, v: import("./types").FilterValue | undefined) => { setFilters((f) => { const n = { ...f }; if (empty(v)) delete n[key]; else n[key] = v as import("./types").FilterValue; return n; }); setPageRaw(1); };
  const clearFilters = () => { setFilters({}); setPageRaw(1); };
  const setSort = (s: import("./types").SortState) => { setSortRaw(s); setPageRaw(1); };
  return {
    page, pageSize, sort, filters: clean, search, query, activeFilterCount: Object.keys(clean).length,
    setPage: (p) => setPageRaw(Math.max(1, p)), setPageSize: (n) => { setPageSizeRaw(n); setPageRaw(1); }, setSort, setFilter, clearFilters, setSearch: (q) => { setSearchRaw(q); setPageRaw(1); },
    reset: () => { setPageRaw(1); setPageSizeRaw(size); setSortRaw(opts?.sort ?? null); setFilters(opts?.filters ?? {}); setSearchRaw(opts?.search ?? ""); },
    tableProps: { sort, onSort: setSort, filters: clean, onFilterChange: setFilter, onClearFilters: clearFilters },
    paginationProps: (total) => ({ page, totalPages: Math.max(1, Math.ceil(total / pageSize)), onPage: (p: number) => setPageRaw(Math.max(1, p)), total, pageSize, onPageSize: (n: number) => { setPageSizeRaw(n); setPageRaw(1); } }),
  };
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

// ---------------------------------------------------------------------------------------------
// Tuỳ chọn giao diện theo tài khoản (CMS ≥ 1.40: lưu phía máy chủ, đổi máy vẫn còn; CMS cũ: lưu trên trình duyệt)
// ---------------------------------------------------------------------------------------------
let prefsLoad: Promise<Record<string, unknown>> | null = null;
const prefsMem: Record<string, unknown> = {};
const prefsSubs = new Set<() => void>();
const localKey = (k: string) => `ecx-prefs:${currentUser()?.id ?? 0}:${k}`;
const readLocal = (k: string): unknown => { try { const v = localStorage.getItem(localKey(k)); return v === null ? undefined : JSON.parse(v); } catch { return undefined; } };

function loadPrefs(): Promise<Record<string, unknown>> {
  if (!prefsLoad) prefsLoad = api.get<Record<string, unknown>>("/auth/prefs").then((r) => { Object.assign(prefsMem, r ?? {}); return prefsMem; }).catch(() => prefsMem);
  return prefsLoad;
}

/**
 * Giá trị tuỳ chọn của người dùng hiện tại theo khoá (bố cục khối, cột bảng, bộ lọc đã chọn…). `set(undefined)` / `reset()` xoá.
 * Giá trị JSON, tối đa 32KB mỗi khoá. Tên khoá nên có tiền tố của plugin, vd "ecomcx-ecommerce.product-layout".
 */
export function useUserPrefs<T>(key: string, initial: T): { value: T; set(v: T | undefined): void; reset(): void; loaded: boolean } {
  const R = host().React;
  const [, tick] = R.useState(0);
  const [loaded, setLoaded] = R.useState(false);
  R.useEffect(() => {
    const sub = () => tick((n: number) => n + 1);
    prefsSubs.add(sub);
    let alive = true;
    void loadPrefs().then(() => { if (alive) setLoaded(true); });
    return () => { alive = false; prefsSubs.delete(sub); };
  }, []);
  const stored = key in prefsMem ? prefsMem[key] : readLocal(key);
  const set = (v: T | undefined) => {
    if (v === undefined) { delete prefsMem[key]; try { localStorage.removeItem(localKey(key)); } catch { /* bỏ qua */ } }
    else { prefsMem[key] = v; try { localStorage.setItem(localKey(key), JSON.stringify(v)); } catch { /* bỏ qua */ } }
    prefsSubs.forEach((f) => f());
    void api.put(`/auth/prefs/${encodeURIComponent(key)}`, v === undefined ? null : v).catch(() => { /* CMS cũ: giữ ở trình duyệt */ });
  };
  return { value: (stored === undefined ? initial : stored) as T, set, reset: () => set(undefined), loaded };
}
