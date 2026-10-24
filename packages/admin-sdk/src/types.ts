import type { ComponentType, ReactNode } from "react";

export interface ApiClient {
  get<T = any>(path: string): Promise<T>;
  post<T = any>(path: string, body?: unknown): Promise<T>;
  put<T = any>(path: string, body?: unknown): Promise<T>;
  del<T = any>(path: string): Promise<T>;
  upload<T = any>(path: string, file: File, field?: string): Promise<T>;
}

export interface MetaBoxProps {
  postType: string;
  post: { id?: number; title: string; slug: string; status: string; meta: Record<string, any>; [k: string]: any };
  /** Giá trị meta hiện tại (đã gồm thay đổi chưa lưu). */
  meta: Record<string, any>;
  /** Đặt meta — được lưu cùng bài viết khi bấm Lưu/Đăng. silent: không đánh dấu bài "Chưa lưu" (giá trị tự tính). */
  setMeta(key: string, value: any, opts?: { silent?: boolean }): void;
  /** Nội dung đang soạn ({ version, blocks }) — cập nhật khi gõ (trễ ~0,4 giây), dùng để phân tích nội dung. */
  content?: { version?: number; blocks: Array<{ type: string; data?: any }> };
  excerpt?: string;
  /** Đường dẫn công khai (xem trước) và địa chỉ website. */
  link?: string;
  siteUrl?: string;
  locale?: string;
  featuredMedia?: { id: number; url: string; alt?: string; width?: number; height?: number } | null;
  /** id chuyên mục/thẻ đang chọn theo taxonomy. */
  terms?: Record<string, number[]>;
}

/** Một dòng trong danh sách bài (kèm meta đã khai báo trong metaKeys của cột). */
export interface PostListRow { id: number; type: string; title: string; slug: string; status: string; locale: string; link: string; meta?: Record<string, any> | null; [k: string]: any }

/** Cột thêm vào danh sách bài viết/trang. */
export interface PostListColumn {
  id: string;
  title: string;
  /** Bỏ trống = mọi post type. */
  postTypes?: string[];
  /** Meta cần tải kèm mỗi dòng (vd ["_ecx_seo"]). */
  metaKeys?: string[];
  width?: number;
  align?: "left" | "right" | "center";
  component: ComponentType<{ row: PostListRow }>;
}

export interface TermMetaBoxProps {
  taxonomy: string;
  term: { id?: number; name: string; slug: string; description: string; meta: Record<string, any> };
  meta: Record<string, any>;
  setMeta(key: string, value: any): void;
}

/** Hộp thêm vào form sửa chuyên mục/thẻ. */
export interface TermMetaBox {
  id: string;
  title: string;
  /** Bỏ trống = mọi taxonomy. */
  taxonomies?: string[];
  component: ComponentType<TermMetaBoxProps>;
}

export interface MetaBox {
  id: string;
  title: string;
  /** Bỏ trống = mọi post type. */
  postTypes?: string[];
  context?: "main" | "side";
  priority?: number;
  component: ComponentType<MetaBoxProps>;
}

/**
 * Sidebar riêng của plugin trong trình soạn bài (ghim được lên thanh đầu trang).
 * Sidebar chỉ hiện một panel mỗi lúc: "Cài đặt" của core hoặc một sidebar plugin; nút trên thanh hành động để chuyển qua lại.
 * Panel luôn được giữ mount (chỉ ẩn khi không mở) nên plugin vẫn phân tích/lưu meta khi người dùng không xem.
 */
export interface EditorSidebar {
  id: string;
  title: string;
  /** Bỏ trống = mọi post type. */
  postTypes?: string[];
  /** Icon cho nút mặc định trên thanh hành động (vd icon lucide). */
  icon?: ComponentType<{ className?: string }>;
  /** Nút tự vẽ trên thanh hành động (vd điểm SEO) — thay cho nút icon mặc định. */
  headerItem?: ComponentType<MetaBoxProps & { active: boolean; toggle(): void }>;
  priority?: number;
  component: ComponentType<MetaBoxProps>;
}

export interface AdminPage {
  /** Khớp với Path khai báo trong IAdminRegistry.AddMenu ở backend, vd "/redirects". */
  path: string;
  title?: string;
  /** Toàn màn hình: không thanh bên, không khung trang của admin (vd trình dựng trang kéo thả). Plugin tự vẽ nút quay lại. */
  fullscreen?: boolean;
  component: ComponentType<{ path: string }>;
}

export interface DashboardWidget { id: string; title: string; component: ComponentType }

export interface Notify {
  success(message: string): void;
  error(message: string): void;
  info(message: string): void;
}

export interface Column<T> {
  key: string; title: ReactNode; render?: (row: T) => ReactNode; width?: number | string; align?: "left" | "right" | "center"; className?: string;
  /** Bấm tiêu đề để sắp xếp: bảng gọi `onSort`, plugin tự sắp xếp / gửi lên máy chủ (CMS có UI kit v2). */
  sortable?: boolean;
}
export type SortState = { key: string; dir: "asc" | "desc" } | null;
export interface UiOption { value: string; label: string; description?: string; disabled?: boolean }
export interface TreeNode { id: string | number; label: ReactNode; text?: string; children?: TreeNode[]; disabled?: boolean }
export type Density = "comfortable" | "compact";
export interface TableSettings {
  hidden: string[]; density: Density;
  toggleColumn(key: string): void; setDensity(d: Density): void;
}
export interface AskOptions { title?: ReactNode; confirmLabel?: string; cancelLabel?: string; danger?: boolean }

export interface AdminSlotItem {
  id?: string;
  slot: string;
  component: ComponentType<any>;
  priority?: number;
  postTypes?: string[];
}

/** Cài đặt › Trang đăng nhập (chuỗi rỗng = mặc định của core). */
export interface LoginBranding {
  layout: "split" | "centered";
  logo: string;
  background: string;
  brandColor: string;
  headline: string;
  message: string;
  siteTitle: string;
}

/**
 * Props của slot "login.page" (bundle admin.loginEntry) — thay cả trang đăng nhập trang quản trị.
 * Giữ form của core: đặt <CoreForm /> trong bố cục riêng, hoặc bọc bằng <Shell branding={branding}>.
 * Tự vẽ form: dùng auth.* (ô name="extra.*" gửi qua tham số extra). Lỗi khi vẽ → core tự hiện trang mặc định;
 * /admin/?core-login=1 luôn bỏ qua giao diện đăng nhập của plugin.
 * Các slot nhỏ hơn (props { branding }): "login.brand" (thay panel thương hiệu), "login.form.before", "login.form.after", "login.footer";
 * "login.form.fields" (props { form }) thêm ô vào form.
 */
export interface LoginPageProps {
  branding: LoginBranding;
  canRegister: boolean;
  CoreForm: ComponentType;
  Shell: ComponentType<{ branding: LoginBranding; children: ReactNode }>;
  auth: {
    /** Tài khoản bật 2 lớp → trả về challenge để gọi verifyTwoFactor. */
    login(login: string, password: string, remember: boolean, extra?: Record<string, string>): Promise<{ challenge?: string }>;
    verifyTwoFactor(challenge: string, code: string, remember: boolean): Promise<void>;
    forgotPassword(login: string, extra?: Record<string, string>): Promise<{ message: string }>;
    register(input: { userName: string; email: string; displayName?: string; password: string; extra?: Record<string, string> }): Promise<{ message: string }>;
  };
}

export interface PostRowAction {
  id: string;
  title: string;
  postTypes?: string[];
  icon?: ComponentType<any>;
  component?: ComponentType<{ row: PostListRow; navigate?: (path: string) => void }>;
  onClick?: (row: PostListRow, navigate: (path: string) => void) => void;
  priority?: number;
}

/** Danh sách khác (ngoài bài viết) cho plugin mở rộng: người dùng, bình luận, media. */
export type AdminListName = "users" | "comments" | "media";

/** Mẫu (pattern): đoạn nội dung dựng sẵn, chèn = chép khối vào bài. */
export interface EditorPattern {
  /** "slug-plugin/tên". */
  name: string;
  /** Chuỗi thường hoặc "%khoá%" (locales/ của plugin). */
  title: string;
  description?: string;
  /** hero, features, cta, pricing, testimonials, faq, team, contact, text, gallery, header, footer… */
  category: string;
  keywords?: string;
  /** Cây khối { type: "doc", content }, mảng khối, hoặc { version, blocks } (@ecomcx/nexus-content). */
  content: unknown;
}

/** Cột thêm vào danh sách người dùng / bình luận / media. row = một dòng của API admin. */
export interface ListColumn {
  list: AdminListName;
  id: string;
  title: string;
  width?: number;
  align?: "left" | "right" | "center";
  component: ComponentType<{ row: any }>;
}

/** Nút trên từng dòng của danh sách người dùng / bình luận / media (user_row_actions, comment_row_actions…). */
export interface ListRowAction {
  list: AdminListName;
  id: string;
  title: string;
  icon?: ComponentType<any>;
  component?: ComponentType<{ row: any; navigate?: (path: string) => void }>;
  onClick?: (row: any, navigate: (path: string) => void) => void;
  priority?: number;
}

/** Thao tác hàng loạt trên danh sách người dùng / bình luận / media. */
export interface ListBulkAction {
  list: AdminListName;
  id: string;
  title: string;
  icon?: ComponentType<any>;
  /** Hỏi lại trước khi chạy ({0} = số mục). */
  confirm?: string;
  run(ids: number[]): Promise<void | string>;
  priority?: number;
}

/** Thao tác hàng loạt trên danh sách bài (hiện khi chọn nhiều dòng). */
export interface PostBulkAction {
  id: string;
  title: string;
  postTypes?: string[];
  icon?: ComponentType<any>;
  /** Hỏi lại trước khi chạy (vd "Đặt hết hàng cho {0} sản phẩm?" — {0} = số mục). */
  confirm?: string;
  /** Gọi API của plugin; ném lỗi để báo thất bại. Xong thì danh sách tự tải lại. */
  run(ids: number[]): Promise<void | string>;
  priority?: number;
}

/** Bộ lọc thêm vào danh sách bài: chọn một giá trị → chỉ hiện bài có meta[metaKey] == giá trị đó. */
export interface PostListFilter {
  id: string;
  /** Nhãn của lựa chọn "tất cả", vd "Mọi tình trạng kho". */
  label: string;
  postTypes?: string[];
  metaKey: string;
  /** value là JSON ("true", "12", "\"instock\"") hoặc chuỗi thường. */
  options: Array<{ value: string; label: string }>;
}

export interface UserProfileBoxProps {
  user: { id: number; userName: string; email: string; displayName: string; roles: string[] };
  /** Meta của người dùng (trừ khoá bắt đầu bằng "_" — dữ liệu riêng của plugin). */
  meta: Record<string, any>;
  /** Lưu ngay các khoá (null = xoá). Trả về meta mới. */
  saveMeta(patch: Record<string, any>): Promise<Record<string, any>>;
  /** Đang xem hồ sơ của chính mình. */
  isSelf: boolean;
}

/** Hộp thêm vào trang sửa thành viên và "Hồ sơ của bạn" (dữ liệu lưu trong user meta). */
export interface UserProfileBox {
  id: string;
  title: string;
  description?: string;
  /** Chỉ hiện với thành viên có một trong các vai trò này (bỏ trống = mọi người). */
  roles?: string[];
  component: ComponentType<UserProfileBoxProps>;
  priority?: number;
}

export interface MetaBoxesProps {
  postType: string;
  context?: "main" | "side" | "normal" | "all";
  post: { id?: number; title: string; slug: string; status: string; meta: Record<string, any>; [k: string]: any };
  meta: Record<string, any>;
  setMeta(key: string, value: any, opts?: { silent?: boolean }): void;
  content?: any;
  excerpt?: string;
  link?: string;
  siteUrl?: string;
  locale?: string;
  featuredMedia?: any;
  terms?: Record<string, number[]>;
  excludeIds?: string[];
  className?: string;
}

export interface AdminHookRegistry {
  addAction(hook: string, namespace: string, callback: (...args: any[]) => void, priority?: number): void;
  doAction(hook: string, ...args: any[]): void;
  addFilter<T = any>(filter: string, namespace: string, callback: (value: T, ...args: any[]) => T, priority?: number): void;
  applyFilters<T = any>(filter: string, value: T, ...args: any[]): T;
  removeAction(hook: string, namespace: string): void;
  removeFilter(filter: string, namespace: string): void;
  hasAction(hook: string, namespace?: string): boolean;
  hasFilter(filter: string, namespace?: string): boolean;
}

type Placement = "top" | "bottom" | "left" | "right" | "top-start" | "top-end" | "bottom-start" | "bottom-end" | "left-start" | "left-end" | "right-start" | "right-end";

/**
 * Bộ component UI của admin — plugin dùng để giao diện đồng bộ với admin. Xem trực tiếp mọi component tại trang /ui-kit trong admin.
 * Mục đánh dấu "UI kit v2" chỉ có trên CMS mới (từ 22/10/2026); SDK tự thay bằng bản đơn giản khi CMS cũ chưa có.
 */
export interface UiKit {
  Button: ComponentType<{ variant?: "primary" | "secondary" | "danger" | "ghost"; size?: "sm" | "md"; loading?: boolean; icon?: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>>;
  Input: ComponentType<React.InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> }>;
  Textarea: ComponentType<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: React.Ref<HTMLTextAreaElement> }>;
  Select: ComponentType<React.SelectHTMLAttributes<HTMLSelectElement> & { options: Array<{ value: string; label: string }> }>;
  /** `ariaLabel` khi không có nhãn hiện; `indeterminate` = chọn một phần. */
  Checkbox: ComponentType<{ checked: boolean; onChange(checked: boolean): void; label?: ReactNode; disabled?: boolean; description?: ReactNode; ariaLabel?: string; indeterminate?: boolean }>;
  /** Nhãn + chú thích/lỗi tự gắn vào ô nhập đầu tiên bên trong (trình đọc màn hình). */
  Field: ComponentType<{ label: ReactNode; help?: ReactNode; error?: ReactNode; children: ReactNode; className?: string }>;
  Card: ComponentType<{ title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean }>;
  PageHeader: ComponentType<{ title: ReactNode; description?: ReactNode; actions?: ReactNode }>;
  /** Bảng. Sắp xếp: cột `sortable` + `sort`/`onSort`; ẩn cột + mật độ: lấy từ `useTableSettings`. */
  Table: ComponentType<{
    columns: Column<any>[]; rows: any[]; rowKey?: (row: any) => string | number; empty?: ReactNode; loading?: boolean;
    selectable?: boolean; selected?: Set<string | number>; onSelect?(s: Set<string | number>): void; onRowClick?(row: any): void;
    sort?: SortState; onSort?(s: SortState): void; hiddenColumns?: string[]; density?: Density; ariaLabel?: string;
  }>;
  Badge: ComponentType<{ tone?: "gray" | "green" | "yellow" | "red" | "blue" | "purple"; children: ReactNode; dot?: boolean }>;
  /** Hộp thoại (= Dialog): giữ focus bên trong, Esc / bấm ra ngoài để đóng, trả focus khi đóng. */
  Modal: ComponentType<{ open: boolean; title: ReactNode; onClose(): void; children: ReactNode; footer?: ReactNode; width?: number; description?: ReactNode; dismissOnBackdrop?: boolean }>;
  Spinner: ComponentType<{ className?: string }>;
  EmptyState: ComponentType<{ title: ReactNode; description?: ReactNode; action?: ReactNode; icon?: ReactNode }>;
  MediaPicker: ComponentType<{ value?: { id: number; url: string } | null; onChange(value: { id: number; url: string } | null): void; accept?: string }>;
  /** Có `children` thì hiện nhãn bên cạnh; không thì cần `label` (đọc cho trình đọc màn hình). */
  Switch: ComponentType<{ checked: boolean; onChange(v: boolean): void; disabled?: boolean; label?: string; children?: ReactNode; description?: ReactNode }>;
  IconButton: ComponentType<{ label: string; active?: boolean; children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>>;
  Section: ComponentType<{ title: ReactNode; children: ReactNode; defaultOpen?: boolean; actions?: ReactNode }>;
  Tabs: ComponentType<{ value: string; onChange(v: string): void; items: Array<{ value: string; label: ReactNode; count?: number }> }>;
  MetaBoxes: ComponentType<MetaBoxesProps>;
  Slot: ComponentType<{ name: string; props?: any; fallback?: ReactNode; postType?: string; className?: string }>;
  Fill: ComponentType<{ name: string; priority?: number; children: ReactNode }>;

  // ----- UI kit v2 -----
  Dialog?: UiKit["Modal"];
  Drawer?: ComponentType<{ open: boolean; title: ReactNode; onClose(): void; children: ReactNode; footer?: ReactNode; width?: number; side?: "left" | "right"; description?: ReactNode }>;
  Popover?: ComponentType<{ trigger: (p: { open: boolean; toggle(): void }) => ReactNode; children: (close: () => void) => ReactNode; align?: "start" | "end"; className?: string; placement?: Placement }>;
  /** Menu thả xuống chuẩn bàn phím: `trigger` là một phần tử (Button/IconButton). */
  DropdownMenu?: ComponentType<{ trigger: React.ReactElement; children: ReactNode; align?: "start" | "end"; className?: string; placement?: Placement }>;
  MenuItem?: ComponentType<{ icon?: ReactNode; children: ReactNode; onClick?(): void; danger?: boolean; shortcut?: ReactNode; disabled?: boolean; keepOpen?: boolean }>;
  MenuSeparator?: ComponentType<{}>;
  MenuLabel?: ComponentType<{ children: ReactNode }>;
  /** Chú thích khi rê chuột / focus bàn phím; con phải nhận focus được. */
  Tooltip?: ComponentType<{ content: ReactNode; children: React.ReactElement; placement?: Placement; delay?: number }>;
  Skeleton?: ComponentType<{ className?: string }>;
  /** Chọn một trong danh sách dài, gõ để lọc (không dấu). `onSearch` để tải gợi ý từ máy chủ. */
  Combobox?: ComponentType<{ value: string | null; onChange(v: string | null): void; options: UiOption[]; placeholder?: string; disabled?: boolean; ariaLabel?: string; onSearch?(q: string): void; clearable?: boolean; className?: string; emptyText?: ReactNode }>;
  /** Chọn nhiều / nhập thẻ: có `options` là MultiSelect, `creatable` cho gõ giá trị mới (Enter hoặc dấu phẩy). */
  TagInput?: ComponentType<{ value: string[]; onChange(v: string[]): void; options?: UiOption[]; creatable?: boolean; placeholder?: string; ariaLabel?: string; disabled?: boolean; max?: number; onSearch?(q: string): void }>;
  /** Ngày "YYYY-MM-DD"; `withTime`: "YYYY-MM-DDTHH:mm" giờ địa phương (đổi với ISO bằng `isoToLocal` / `localToIso`). */
  DatePicker?: ComponentType<{ value: string | null; onChange(v: string | null): void; withTime?: boolean; placeholder?: string; ariaLabel?: string; disabled?: boolean; min?: string; max?: string; clearable?: boolean }>;
  RadioGroup?: ComponentType<{ value: string; onChange(v: string): void; options: Array<{ value: string; label: ReactNode; description?: ReactNode; disabled?: boolean }>; ariaLabel?: string; variant?: "list" | "cards" | "segmented"; disabled?: boolean }>;
  TreeView?: ComponentType<{ nodes: TreeNode[]; ariaLabel: string; checkable?: boolean; checked?: Array<string | number>; onCheck?(id: string | number, value: boolean): void; selected?: string | number | null; onSelect?(id: string | number): void; defaultExpanded?: "all" | "none" | Array<string | number>; className?: string }>;
  Pagination?: ComponentType<{ page: number; totalPages: number; onPage(p: number): void; total?: number; pageSize?: number; onPageSize?(n: number): void; pageSizes?: number[] }>;
  TableSettingsMenu?: ComponentType<{ columns: Array<{ key: string; title: ReactNode }>; settings: TableSettings }>;
  useTableSettings?: (key: string, defaults?: Partial<Pick<TableSettings, "hidden" | "density">>) => TableSettings;
  isoToLocal?: (iso?: string | null) => string | null;
  localToIso?: (value: string | null) => string | null;
  confirmDialog?: (message: ReactNode, opts?: AskOptions) => Promise<boolean>;
  promptDialog?: (message: ReactNode, opts?: AskOptions & { defaultValue?: string; placeholder?: string }) => Promise<string | null>;
  alertDialog?: (message: ReactNode, opts?: AskOptions) => Promise<void>;
}

export interface CmsAdmin {
  version: string;
  React: typeof import("react");
  jsxRuntime: typeof import("react/jsx-runtime");
  api: ApiClient;
  notify: Notify;
  ui: UiKit;
  hooks: AdminHookRegistry;
  registerPage(page: AdminPage): void;
  registerMetaBox(box: MetaBox): void;
  /** Sidebar riêng trong trình soạn bài. */
  registerEditorSidebar?(sidebar: EditorSidebar): void;
  registerDashboardWidget(widget: DashboardWidget): void;
  registerPostListColumn(column: PostListColumn): void;
  registerTermMetaBox(box: TermMetaBox): void;
  registerSlot(slot: AdminSlotItem): void;
  getSlots(slot: string, postType?: string): Array<AdminSlotItem>;
  registerPostRowAction(action: PostRowAction): void;
  registerPostBulkAction?(action: PostBulkAction): void;
  registerPostListFilter?(filter: PostListFilter): void;
  registerUserProfileBox?(box: UserProfileBox): void;
  registerListColumn?(column: ListColumn): void;
  registerListRowAction?(action: ListRowAction): void;
  registerListBulkAction?(action: ListBulkAction): void;
  getPostRowActions(postType?: string): Array<PostRowAction>;
  getMetaBoxes?(postType?: string): MetaBox[];
  usePluginUi?(): any;
  /** Hook React lấy dữ liệu đơn giản: const { data, loading, error, reload } = useApi("/admin/...") */
  useApi<T = any>(path: string | null): { data: T | undefined; loading: boolean; error: Error | null; reload(): void };
  currentUser(): { id: number; displayName: string; capabilities: string[] } | null;
  can(capability: string): boolean;
  /** Hàm công bố cho plugin khác dùng trong admin (xem exposeApi/getPluginApi). */
  plugins?: {
    expose(slug: string, api: Record<string, unknown>): void;
    get<T = Record<string, unknown>>(slug: string): T | undefined;
    wait<T = Record<string, unknown>>(slug: string, timeoutMs?: number): Promise<T | undefined>;
  };
  /** Dịch giao diện: ngôn ngữ admin hiện tại ("vi" | "en"), hàm dịch theo khoá (ICU) và bổ sung bản dịch của plugin. */
  i18n: {
    locale: string;
    /** "slug:khoá" của plugin, hoặc khoá của lõi. Thiếu bản dịch: ngôn ngữ đang chọn → en → vi → hiện khoá. */
    t?(key: string, values?: Record<string, unknown>): string;
    registerMessages?(namespace: string, locale: string, dict: Record<string, string>): void;
    /** @deprecated Chuỗi gốc làm khoá — dùng t(). */
    __(text: string, ...args: unknown[]): string;
    /** @deprecated Dùng registerMessages / locales/*.json. */
    registerTranslations(locale: string, dict: Record<string, string>): void;
  };
  /** Trình soạn nội dung (@ecomcx/nexus-editor): thêm khối/lệnh chèn; dùng chung TipTap của admin. */
  editor: {
    register(pack: EditorExtensionPack): void;
    /** Khối khai báo bằng defineBlock (CMS ≥ 1.8.0 / admin có @ecomcx/nexus-editor ≥ 1.1). */
    registerBlock?(def: import("@ecomcx/nexus-content").BlockDefinition, options?: RegisterBlockOptions): void;
    /** Panel trong tab "Khối" của trình soạn (CMS ≥ 1.10.0). */
    registerBlockPanel?(panel: BlockPanel): void;
    /** Mẫu — đoạn nội dung dựng sẵn trong tab "Mẫu" của trình chèn (CMS ≥ 1.12.0). */
    registerPattern?(pattern: EditorPattern): void;
    tiptap: { Node: any; Mark: any; Extension: any; mergeAttributes: (...attrs: any[]) => Record<string, any> };
  };
}

/** Tuỳ chọn khi đăng ký khối: biểu tượng (component lucide), phần xem trước tuỳ chỉnh trong trình soạn. */
export interface RegisterBlockOptions {
  icon?: any;
  edit?: import("react").ComponentType<{ attrs: Record<string, any>; setAttrs(attrs: Record<string, unknown>): void; selected: boolean; children?: import("react").ReactNode }>;
}

/** Props của panel plugin trong tab "Khối". */
export interface BlockPanelProps {
  /** Loại khối đang chọn (vd "image", "button", "shop/product"). */
  type: string;
  attrs: Record<string, any>;
  /** Đổi thuộc tính của khối (thuộc tính sẵn có hoặc đã khai báo ở `attributes`). */
  setAttrs(attrs: Record<string, unknown>): void;
}

/**
 * Panel thêm vào tab "Khối" của trình soạn khi chọn một khối — cho khối của chính plugin
 * hoặc khối lõi / khối plugin khác.
 */
export interface BlockPanel {
  /** Mã duy nhất dạng "slug-plugin/tên" — tiền tố slug dùng để dịch nhãn "%khoá%". */
  id: string;
  /** Tiêu đề mục ("%khoá%" dịch theo locales của plugin). */
  title: string;
  /** Loại khối áp dụng; bỏ trống = mọi khối. */
  blocks?: string[];
  /** Thứ tự (nhỏ đứng trước, mặc định 10). */
  order?: number;
  /** Thuộc tính thêm vào khối, vd { lazy: { default: true } } — cần khai báo để trình soạn lưu được (bắt buộc có `blocks`). */
  attributes?: Record<string, { default?: unknown }>;
  component: import("react").ComponentType<BlockPanelProps>;
}

/** Gói mở rộng trình soạn: node/mark TipTap + lệnh chèn trong slash menu "/". */
export interface EditorExtensionPack {
  name: string;
  extensions?: any[];
  insertItems?: Array<{ key: string; title: string; hint: string; icon: any; keywords: string; run(editor: any, range?: any): void }>;
}
