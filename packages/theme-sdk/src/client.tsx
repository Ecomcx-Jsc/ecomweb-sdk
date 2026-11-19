"use client";

import { carouselData, carouselVars, countdownParts, evergreenWindow, nextTarget, type CountdownRules, SEARCH_ICON_PATH, type CarouselConfig, type CountdownUnit } from "@ecomcx/ecomweb-content";
import { extraFields, useCurrentUser } from "./auth-forms";
import { Component, Suspense, useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import NextLink, { useLinkStatus } from "next/link";
import NextForm from "next/form";
import { cx, formatDate } from "./utils";
import type { Comment, CommentPage } from "./types";
import type { AnchorHTMLAttributes, CSSProperties, ReactNode } from "react";
import { createFetchKit, isFetchKitError } from "next-fetch-kit";
import { emit } from "./browser";
import { CONSENT_META, CONSENT_PREF, decideConsent, parseConsent, serializeConsent, type ConsentCategory } from "./consent";

export { pluginClient, PluginApiError, emit, on, useEvent, TranslationsProvider, useT, onBlockReady, type BlockReadyFn, type PluginClient, type PluginRequestOptions } from "./browser";

/**
 * Bảng tên sự kiện phía trình duyệt → dữ liệu (emit / on / useEvent, core ≥ 1.20.0). Theme / plugin khai báo kiểu cho sự kiện của mình:
 *   declare module "@ecomcx/ecomweb-theme-sdk/client" { interface BrowserEvents { "shop.cart.changed": { count: number } } }
 * Tên nên có tiền tố slug plugin (như hook backend).
 */
export interface BrowserEvents {
  /** Khách vừa đổi lựa chọn cookie (setConsent). */
  "consent.changed": { categories: ConsentCategory[] };
}

// ---------------------------------------------------------------------------
// Cô lập lỗi của plugin/theme: phần nào ném lỗi khi hiển thị thì ẩn phần đó, trang vẫn hiện bình thường
// ---------------------------------------------------------------------------

export class ExtensionBoundary extends Component<{ name: string; children?: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.error(`[cms] ${this.props.name} lỗi khi hiển thị — đã ẩn phần này`, error); }
  // Suspense bên trong: khi render trên server, React không dùng error boundary mà đẩy lỗi lên Suspense gần nhất —
  // không có thì lỗi của một shortcode/slot làm cả trang trả 500 (tuỳ thời điểm khung trang đã gửi hay chưa).
  // Có Suspense: phần lỗi được render lại phía trình duyệt, nơi boundary này bắt và ẩn; trang vẫn 200.
  render() { return this.state.failed ? null : <Suspense fallback={null}>{this.props.children}</Suspense>; }
}

// ---------------------------------------------------------------------------
// Link: điều hướng phía client (SPA) cho link nội bộ, <a> thường cho link ngoài/file
// ---------------------------------------------------------------------------

/** Đường dẫn không phải trang của theme (file, feed, API…) → luôn tải lại bình thường. */
const NON_PAGE = /^\/(uploads|api|_next|extensions)\/|^\/(feed|sitemap\.xml|robots\.txt)(\?|$)|\.[a-z0-9]{2,5}(\?|$)/i;

/** `true` nếu link là trang của website (chuyển trang không tải lại); file, feed, API, link ngoài → `false`. */
export function isInternalHref(href: string) {
  return href.startsWith("/") && !href.startsWith("//") && !NON_PAGE.test(href);
}

export type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  children?: ReactNode;
  /**
   * Prefetch của Next.js. Mặc định false: mọi trang của CMS là trang động, mỗi lần prefetch là một lần render trên server
   * (trang chủ báo có thể có cả trăm link). Bật cho vài link quan trọng nếu muốn chuyển trang tức thì.
   */
  prefetch?: boolean | null;
  /** Đặt aria-current và class này khi URL hiện tại khớp href (dùng cho menu). */
  activeClassName?: string;
  /** Khớp cả trang con (vd /category/a/page/2 vẫn active cho /category/a). Mặc định true, trừ trang chủ. */
  matchNested?: boolean;
};

/**
 * Link của theme/plugin: link nội bộ dùng next/link (không tải lại trang, giữ header/menu, prefetch),
 * link ngoài, file, RSS, target=_blank và nút đổi ngôn ngữ dùng <a> thường. HTML luôn là <a href> (tốt cho SEO).
 */
/** Báo trạng thái đang chuyển trang lên <html data-nav-pending> để core hiện thanh tiến trình. */
function PendingSignal() {
  const { pending } = useLinkStatus();
  useEffect(() => {
    if (!pending) return;
    document.documentElement.dataset.navPending = "";
    return () => { delete document.documentElement.dataset.navPending; };
  }, [pending]);
  return null;
}

/**
 * Link chuyển trang không tải lại (bọc `next/link`); link ngoài, file, RSS tự dùng `<a>` thường.
 * `activeClassName` gắn class khi URL hiện tại khớp (`matchNested`: khớp cả trang con). Prefetch mặc định tắt.
 */
export function Link({ href, prefetch = false, activeClassName, matchNested = true, className, children, ...rest }: LinkProps) {
  const pathname = usePathname();
  const path = href.split(/[?#]/)[0];
  const active = activeClassName !== undefined && (pathname === path || (matchNested && path !== "/" && pathname.startsWith(path.endsWith("/") ? path : path + "/")));
  const cls = cx(className, active && activeClassName);
  const ariaCurrent = active ? "page" : rest["aria-current"];
  if (!isInternalHref(href) || rest.target === "_blank" || rest.download !== undefined)
    return <a href={href} className={cls || undefined} {...rest} aria-current={ariaCurrent}>{children}</a>;
  return (
    <NextLink href={href} prefetch={prefetch} className={cls || undefined} {...rest} aria-current={ariaCurrent}
      onClick={(e) => {
        rest.onClick?.(e);
        // Trang không tải lại → tự đóng menu dạng <details> (menu mobile) chứa link vừa bấm
        e.currentTarget.closest("details[open]")?.removeAttribute("open");
      }}>
      {children}<PendingSignal />
    </NextLink>
  );
}

/** Form tìm kiếm (GET) chuyển trang phía client. */
export function SearchFormClient({ action, defaultValue, placeholder, label, buttonLabel, postType, showLabel, buttonPosition = "right", buttonIcon, scopes, scopeAllLabel, scopeLabel, scopeValue, collapse }: { collapse?: "tablet" | "mobile"; scopes?: Array<{ value: string; label: string }>; scopeAllLabel?: string; scopeLabel?: string; scopeValue?: string; buttonIcon?: boolean; action: string; defaultValue?: string | null; placeholder: string; label: string; buttonLabel: string; postType?: string; showLabel?: boolean; buttonPosition?: "right" | "left" | "below" }) {
  const id = useId();
  const button = buttonIcon
    ? <button type="submit" aria-label={buttonLabel} title={buttonLabel}><svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={SEARCH_ICON_PATH} /></svg></button>
    : <button type="submit">{buttonLabel}</button>;
  const form = (
    <NextForm action={action} role="search" style={buttonPosition === "below" ? { display: "flex", flexDirection: "column", gap: 8 } : undefined} className={`search-form${buttonPosition !== "right" ? ` search-button-${buttonPosition}` : ""}`}>
      {showLabel && <label htmlFor={id} className="search-label">{label}</label>}
      {buttonPosition === "left" && button}
      <input id={id} type="search" name="s" defaultValue={defaultValue ?? ""} placeholder={placeholder} aria-label={showLabel ? undefined : label} required />
      {scopes && scopes.length > 0
        ? <select name="type" className="search-scope" aria-label={scopeLabel} defaultValue={scopeValue ?? "any"}><option value="any">{scopeAllLabel}</option>{scopes.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
        : postType && <input type="hidden" name="type" value={postType} />}
      {buttonPosition !== "left" && button}
    </NextForm>
  );
  if (!collapse) return form;
  return <SearchCollapse collapse={collapse} label={buttonLabel}>{form}</SearchCollapse>;
}

/** Ô tìm kiếm thu thành nút kính lúp ở tablet / điện thoại (CSS quyết định ngưỡng); bấm mở ô nhập thả xuống, Esc hoặc bấm ra ngoài để đóng. */
function SearchCollapse({ collapse, label, children }: { collapse: "tablet" | "mobile"; label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div ref={ref} className={cx("ecx-search-collapse", `collapse-${collapse}`, open && "is-open")}>
      <button type="button" className="ecx-search-toggle" aria-label={label} aria-expanded={open} onClick={() => setOpen((o) => !o)}><svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={SEARCH_ICON_PATH} /></svg></button>
      <div className="ecx-search-panel">{children}</div>
    </div>
  );
}

/** Ghi tuỳ chọn hiển thị của người đọc (xem getPreference). value = null để xoá. */
export function setPreference(key: string, value: string | null, maxAgeDays = 365) {
  if (!/^[a-z0-9-]{1,32}$/.test(key) || (value !== null && !/^[A-Za-z0-9_-]{0,64}$/.test(value))) throw new Error("Tuỳ chọn không hợp lệ");
  document.cookie = `cms-pref-${key}=${value ?? ""}; path=/; max-age=${value === null ? 0 : maxAgeDays * 86400}; samesite=lax`;
}

/** Lựa chọn cookie của khách (xem consent.ts); undefined = chưa trả lời. "functional" luôn có. Chỉ chạy ở trình duyệt. */
export function getConsent(): ConsentCategory[] | undefined {
  if (typeof document === "undefined") return undefined;
  const raw = document.cookie.split("; ").find((c) => c.startsWith(`cms-pref-${CONSENT_PREF}=`))?.split("=")[1];
  const choice = parseConsent(raw);
  return choice && ["functional", ...choice];
}

/**
 * Khách đã cho phép nhóm cookie này chưa (gọi trong useEffect / handler — không gọi lúc render để HTML giống nhau cho mọi khách).
 * Chưa chọn: theo <meta name="cms-consent" content="optin"> của plugin banner; không có banner → true.
 */
export function hasConsent(category: ConsentCategory): boolean {
  if (typeof document === "undefined") return false;
  const optIn = document.querySelector<HTMLMetaElement>(`meta[name="${CONSENT_META}"]`)?.content === "optin";
  const choice = getConsent();
  return decideConsent(category, choice, !optIn);
}

/** Plugin banner ghi lựa chọn của khách rồi phát "consent.changed" (cả tab khác) để bên hỏi nạp / báo lại script ngay. */
export function setConsent(categories: readonly ConsentCategory[]) {
  setPreference(CONSENT_PREF, serializeConsent(categories));
  emit("consent.changed", { categories: getConsent() ?? ["functional"] }, { crossTab: true });
}

/** Client phía trình duyệt: gọi các route proxy /api/cms/* của frontend. */
const browserApi = createFetchKit({ baseURL: "/api/cms", timeout: 15_000 });

function errorMessage(e: unknown, fallback: string) {
  if (isFetchKitError(e)) {
    const d = e.data as { title?: string; errors?: Record<string, string[]> } | undefined;
    if (d?.errors) return Object.values(d.errors).flat().join(". ");
    return d?.title ?? fallback;
  }
  return (e as Error)?.message ?? fallback;
}

/** Form gửi bình luận. Gửi qua route /api/cms/comments của frontend (proxy sang CMS API). */
export { browserApi };

type CommentLabels = Record<"title" | "content" | "name" | "email" | "website" | "submit" | "sending" | "approved" | "pending" | "error", string>;
const DEFAULT_LABELS: CommentLabels = {
  title: "Để lại bình luận", content: "Bình luận", name: "Tên", email: "Email", website: "Website", submit: "Gửi bình luận",
  sending: "Đang gửi…", approved: "Cảm ơn bạn! Bình luận đã được đăng (tải lại trang để xem).", pending: "Cảm ơn bạn! Bình luận đang chờ duyệt.",
  error: "Không gửi được bình luận",
};

/** fields: ô thêm của plugin (captcha…) — Comments của SDK truyền <Slot name="comment_form.fields" />. Ô name="extra.*" gửi kèm trong "extra". */
export function CommentForm({ postId, parentId, labels, fields }: { postId: number; parentId?: number; labels?: Partial<CommentLabels>; fields?: ReactNode }) {
  const L = { ...DEFAULT_LABELS, ...labels };
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setState("sending");
    try {
      const { data } = await browserApi.post<{ status: string }>("/comments", {
        body: {
          postId, parentId,
          authorName: fd.get("authorName"), authorEmail: fd.get("authorEmail"),
          authorUrl: fd.get("authorUrl"), content: fd.get("content"), website2: fd.get("website2"), extra: extraFields(fd),
        },
      });
      form.reset();
      setState("done");
      setMessage(data.status === "approved" ? L.approved : L.pending);
    } catch (err) {
      setState("error");
      setMessage(errorMessage(err, L.error));
    }
  }

  return (
    <form className="comment-form" onSubmit={onSubmit}>
      <h3>{L.title}</h3>
      <p><label>{L.content} *<textarea name="content" required rows={5} maxLength={5000} /></label></p>
      <p className="comment-form-row">
        <label>{L.name} *<input name="authorName" required maxLength={100} /></label>
        <label>{L.email} *<input name="authorEmail" type="email" required maxLength={200} /></label>
      </p>
      <p><label>{L.website}<input name="authorUrl" type="url" maxLength={200} /></label></p>
      <input name="website2" tabIndex={-1} autoComplete="off" style={{ position: "absolute", left: "-9999px" }} aria-hidden />
      {fields}
      <p><button type="submit" disabled={state === "sending"}>{state === "sending" ? L.sending : L.submit}</button></p>
      {message && <p className={state === "error" ? "form-error" : "form-success"} role="status">{message}</p>}
    </form>
  );
}

type DateSite = { dateFormat: string; timezone: string; locale?: string };

/** Danh sách bình luận lồng nhau (render được cả ở server lẫn client). */
export function CommentList({ comments, site, avatarSize = 40, showDate = true }: { comments: Comment[]; site: DateSite; avatarSize?: number; showDate?: boolean }) {
  return (
    <ol className="comment-list">
      {comments.map((c) => (
        <li key={c.id} id={`comment-${c.id}`} className="comment">
          <article>
            <header className="comment-meta">
              {c.avatarUrl && <img className="comment-avatar avatar" src={c.avatarUrl} alt="" width={avatarSize} height={avatarSize} loading="lazy" decoding="async" />}
              <b className="comment-author">{c.authorUrl ? <a href={c.authorUrl} rel="nofollow ugc">{c.authorName}</a> : c.authorName}</b>
              {showDate && <>{" · "}<time dateTime={c.createdAt}>{formatDate(c.createdAt, site)}</time></>}
            </header>
            <div className="comment-content">{c.content.split("\n").map((l, i) => <p key={i}>{l}</p>)}</div>
          </article>
          {c.replies.length > 0 && <CommentList comments={c.replies} site={site} avatarSize={avatarSize} showDate={showDate} />}
        </li>
      ))}
    </ol>
  );
}

/** Nút "Xem thêm bình luận": tải các trang tiếp theo qua /api/cms/comments. */
export function CommentsMore({ postId, totalPages, site, labels, perPage, order, avatarSize, showDate }: { postId: number; totalPages: number; site: DateSite; labels: { more: string; loading: string; error: string }; perPage?: number; order?: "asc" | "desc"; avatarSize?: number; showDate?: boolean }) {
  const [pages, setPages] = useState<Comment[][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const next = pages.length + 2;
  async function load() {
    setLoading(true); setError("");
    try {
      const { data } = await browserApi.get<CommentPage>("/comments", { query: { postId, page: next, ...(perPage ? { perPage } : {}), ...(order ? { order } : {}) } });
      setPages((p) => [...p, data.items]);
    } catch (e) { setError(errorMessage(e, labels.error)); } finally { setLoading(false); }
  }
  return (
    <>
      {pages.map((items, i) => <CommentList key={i} comments={items} site={site} avatarSize={avatarSize} showDate={showDate} />)}
      {next <= totalPages && <p className="comments-more"><button type="button" onClick={load} disabled={loading}>{loading ? labels.loading : labels.more}</button></p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </>
  );
}

/** Form mật khẩu của bài được bảo vệ. Đúng mật khẩu → cookie httpOnly, tải lại nội dung trang. */
export function PostPasswordForm({ postId, labels }: { postId: number; labels: { intro: string; label: string; submit: string; wrong: string } }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await browserApi.post("/unlock", { body: { postId, password: new FormData(e.currentTarget).get("password") } });
      router.refresh();
    } catch (err) { setError(errorMessage(err, labels.wrong)); setBusy(false); }
  }
  return (
    <form className="post-password-form" onSubmit={onSubmit}>
      <p>{labels.intro}</p>
      <p><label>{labels.label} <input name="password" type="password" required autoComplete="off" maxLength={100} /></label> <button type="submit" disabled={busy}>{labels.submit}</button></p>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}

type Lang = { code: string; name: string; flag?: string };

/** Phần client của LanguageSwitcher: lấy link bản dịch từ <link rel="alternate" hreflang> do metadata của trang sinh ra. */
export function LanguageSwitcherClient({ languages, current, defaultLocale, label, className, variant }: {
  languages: Lang[]; current: string; defaultLocale: string; label: string; className?: string; variant: "list" | "select";
}) {
  const pathname = usePathname();
  const home = (code: string) => (code === defaultLocale ? "/" : `/${code}`);
  const [links, setLinks] = useState<Record<string, string>>({});
  useEffect(() => {
    const read = () => {
      const map: Record<string, string> = {};
      document.querySelectorAll<HTMLLinkElement>('link[rel="alternate"][hreflang]').forEach((l) => {
        const lang = l.getAttribute("hreflang");
        if (lang && lang !== "x-default") { try { map[lang] = new URL(l.href).pathname; } catch { /* bỏ qua */ } }
      });
      setLinks(map);
    };
    read();
    const t = setTimeout(read, 150); // metadata có thể được chèn sau khi chuyển trang
    return () => clearTimeout(t);
  }, [pathname]);
  const href = (code: string) => links[code] ?? home(code);

  if (variant === "select")
    return (
      <select className={className ?? "lang-switcher"} aria-label={label} value={current} onChange={(e) => { window.location.href = href(e.target.value); }}>
        {languages.map((l) => <option key={l.code} value={l.code}>{l.flag ? `${l.flag} ` : ""}{l.name}</option>)}
      </select>
    );
  return (
    <nav className={className ?? "lang-switcher"} aria-label={label}>
      <ul>
        {languages.map((l) => (
          <li key={l.code} className={l.code === current ? "current-lang" : undefined}>
            <a href={href(l.code)} hrefLang={l.code} lang={l.code} aria-current={l.code === current ? "true" : undefined}>
              {l.flag && <span aria-hidden>{l.flag} </span>}{l.code.toUpperCase()}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export { LoginForm, RegisterForm, ForgotPasswordForm, ResetPasswordForm, LogoutButton, LoginOutLink, useCurrentUser, extraFields, ProfileForm, ChangePasswordForm, DeleteAccountForm, AUTH_LABELS, AUTH_PATHS, type AuthLabels, type AuthPaths, type SignInProvider } from "./auth-forms";
export { safeRedirect, type CurrentUser } from "./auth-shared";

/** Khối countdown: đếm ngược tới `target` (ms). Dựng lần đầu cùng giá trị trên máy chủ, rồi cập nhật mỗi giây. */
export function CountdownClient({ target, label, expiredText, units, serverNow, rules, storageKey, attrs = {} }: { target: number; label?: string; expiredText?: string; units?: Partial<Record<CountdownUnit, string>>; serverNow?: number; rules?: CountdownRules; storageKey?: string; attrs?: Record<string, unknown> }) {
  // Lần render đầu của client dùng ĐÚNG thời điểm máy chủ đã dùng (serverNow) để khớp HTML dựng sẵn / cache; sau đó lấy giờ thật ngay (tránh hydration mismatch #418)
  const [now, setNow] = useState(() => serverNow ?? Date.now());
  const [paused, setPaused] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Evergreen: mốc bắt đầu của RIÊNG người xem này nằm trong localStorage (không có thì bắt đầu từ lúc vào trang)
  const [end, setEnd] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now()); setMounted(true);
    if (rules?.evergreenMs && storageKey) {
      let saved: number | null = null;
      try { const v = localStorage.getItem(`ecx-cd:${storageKey}`); saved = v ? Number(v) : null; } catch { /* trình duyệt chặn lưu: đếm từ lúc vào trang */ }
      const [start, finish] = evergreenWindow(saved, Date.now(), rules.evergreenMs, rules.evergreenResetDays);
      try { if (start !== saved) localStorage.setItem(`ecx-cd:${storageKey}`, String(start)); } catch { /* bỏ qua */ }
      setEnd(finish);
    }
  }, [rules?.evergreenMs, rules?.evergreenResetDays, storageKey]);
  useEffect(() => { if (paused) return; const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, [paused]);
  const evergreen = !!rules?.evergreenMs;
  const base = evergreen ? (end ?? (serverNow ?? now) + rules!.evergreenMs!) : target;
  const live = rules && !evergreen ? nextTarget(base, rules.repeat, now) : base;
  const left = Math.max(0, live - now);
  const action = rules?.action ?? (expiredText ? "message" : "zero");
  const expired = left === 0 && mounted;
  const url = rules?.redirectUrl;
  useEffect(() => { if (expired && action === "redirect" && url) location.assign(url); }, [expired, action, url]);
  if (left === 0 && action === "hide") return null;
  if (left === 0 && action === "message" && expiredText) return <div className="ecx-countdown is-expired">{expiredText}</div>;
  const post = typeof attrs.postText === "string" && attrs.postText ? attrs.postText : null;
  return (
    <div className={cx("ecx-countdown", attrs.layout === "inline" && "is-inline", attrs.divider === true && "has-divider", rules?.pause && "has-pause")} role="timer" aria-live="off" suppressHydrationWarning>
      {label && <p className="ecx-countdown-label">{label}</p>}
      <div className="ecx-countdown-parts">{countdownParts(attrs, left, units).map((p) => <span key={p.u} className={`ecx-countdown-${p.u}`}><strong>{p.value}</strong><small>{p.label}</small></span>)}</div>
      {post && <p className="ecx-countdown-post">{post}</p>}
      {rules?.pause && mounted && <button type="button" className="ecx-countdown-pause" aria-pressed={paused} aria-label={paused ? "▶" : "⏸"} onClick={() => { if (paused) setNow(Date.now()); setPaused(!paused); }}>{paused ? "▶" : "⏸"}</button>}
    </div>
  );
}

/** Mục lục: tô đậm mục của tiêu đề đang đọc (tiêu đề cuối cùng đã cuộn qua mép trên 120px) — aria-current="location". */
export function TocSpy() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const nav = ref.current?.closest("nav");
    if (!nav) return;
    const links = [...nav.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];
    const targets = links.map((l) => document.getElementById(decodeURIComponent(l.hash.slice(1))));
    let raf = 0;
    const update = () => {
      raf = 0;
      let cur = -1;
      targets.forEach((t, i) => { if (t && t.getBoundingClientRect().top < 120) cur = i; });
      links.forEach((l, i) => (i === cur ? l.setAttribute("aria-current", "location") : l.removeAttribute("aria-current")));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);
  return <span ref={ref} hidden />;
}

/** Nút ☰ của menu trên điện thoại: <details> gốc + Escape đóng menu và trả focus về nút. */
export function NavToggle({ label, children, className = "ecx-navigation-toggle" }: { label: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { const d = ref.current; if (e.key === "Escape" && d?.open) { d.open = false; d.querySelector("summary")?.focus(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return <details ref={ref} className={className}><summary aria-label={label}>☰</summary>{children}</details>;
}

/**
 * Khối tabs: các panel đã vẽ sẵn trên máy chủ (nội dung vẫn có trong HTML cho SEO); chỉ đổi panel đang hiện.
 * Tab dọc (`vertical`), thành accordion trên điện thoại (`mobileAccordion`, chỉ CSS: tiêu đề nằm ngay trên panel của nó);
 * tab có neo → panel mang id = neo, mở thẳng bằng #neo.
 */
export function TabsClient({ titles, panels, initial = 0, icons, subtitles, anchors, vertical, mobileAccordion, extraClass }: {
  titles: string[]; panels: ReactNode[]; initial?: number; icons?: Array<ReactNode | undefined>; subtitles?: Array<string | undefined>; anchors?: Array<string | undefined>; vertical?: boolean; mobileAccordion?: boolean; /** Class đầy đủ của khối (tabsClass): thay cho class tự ghép. */ extraClass?: string;
}) {
  const [active, setActive] = useState(initial < titles.length ? initial : 0);
  const id = useId();
  useEffect(() => {
    if (!anchors?.some(Boolean)) return;
    const open = () => { const i = anchors.indexOf(decodeURIComponent(location.hash.slice(1))); if (i >= 0) setActive(i); };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, [anchors]);
  const move = (e: React.KeyboardEvent, i: number) => {
    const n = titles.length;
    const fwd = vertical ? "ArrowDown" : "ArrowRight", back = vertical ? "ArrowUp" : "ArrowLeft";
    const next = e.key === fwd ? (i + 1) % n : e.key === back ? (i + n - 1) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (next < 0) return;
    e.preventDefault(); setActive(next);
    document.getElementById(`${id}-t${next}`)?.focus();
  };
  return (
    <div className={extraClass ?? cx("ecx-tabs", vertical && "is-vertical", mobileAccordion && "has-mobile-accordion")}>
      <div role="tablist" className="ecx-tabs-list" aria-orientation={vertical ? "vertical" : undefined}>
        {titles.map((t, i) => (
          <button key={i} type="button" role="tab" id={`${id}-t${i}`} aria-selected={i === active} aria-controls={anchors?.[i] ?? `${id}-p${i}`} tabIndex={i === active ? 0 : -1}
            className={cx("ecx-tab-button", i === active && "is-active")} style={{ "--i": i } as CSSProperties} onClick={() => setActive(i)} onKeyDown={(e) => move(e, i)}>
            {icons?.[i]}
            <span className="ecx-tab-label">{t}{subtitles?.[i] && <small className="ecx-tab-subtitle">{subtitles[i]}</small>}</span>
          </button>
        ))}
      </div>
      {panels.map((p, i) => <div key={i} role="tabpanel" id={anchors?.[i] ?? `${id}-p${i}`} aria-labelledby={`${id}-t${i}`} hidden={i !== active} className="ecx-tab-panel" style={{ "--i": i } as CSSProperties}>{p}</div>)}
    </div>
  );
}

/** Phóng to ảnh: bấm ảnh mở lớp phủ (Esc hoặc bấm nền để đóng). `src` đã qua safeUrl ở máy chủ. */
export function LightboxClient({ src, alt, children }: { src: string; alt: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <>
      <button type="button" className="ecx-lightbox-trigger" aria-haspopup="dialog" onClick={() => setOpen(true)} style={{ all: "unset", display: "block", cursor: "zoom-in" }}>{children}</button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label={alt || "Image"} className="ecx-lightbox" onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,.85)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out" }}>
          <img src={src} alt={alt} style={{ maxWidth: "95vw", maxHeight: "95vh", objectFit: "contain" }} />
        </div>
      )}
    </>
  );
}

/**
 * Khối form cơ bản của lõi (1.39): các ô đã vẽ sẵn ở máy chủ (children), phần này gửi bài qua /api/cms/forms, báo lỗi đúng ô (422),
 * hiện lời cảm ơn. Chống spam: ô bẫy ẩn (_hp) + thời gian điền (máy chủ kiểm), máy chủ còn giới hạn theo IP.
 */
export function FormBlockClient({ formId, source, successMessage, labels, button, className, children, fields: extraUi }: {
  formId: string; source: string; successMessage?: string; labels: { submit: string; sending: string; error: string; next?: string; back?: string; step?: string };
  /** Ô thêm của plugin (captcha…): <Slot name="form.fields" />. Ô name="extra.*" gửi kèm trong "extra" (hook form.submitting). */
  fields?: ReactNode;
  /** Vỏ nút gửi = nút "primary" của nội dung (cùng màu / bo góc với nút của theme). */
  button?: { className?: string; style?: CSSProperties }; className?: string; children?: ReactNode;
}) {
  const started = useRef(Date.now());
  const [state, setState] = useState<{ status: "idle" | "sending" | "done" | "error"; message?: string }>({ status: "idle" });
  const formEl = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(1);
  const [maxStep, setMaxStep] = useState(1);
  // Hiện / ẩn ô theo điều kiện (data-showif) và theo bước (data-step); ô đang ẩn không gửi lên
  const sync = useCallback((cur: number) => {
    const form = formEl.current; if (!form) return;
    const value = (name: string) => {
      const els = Array.from(form.elements).filter((e): e is HTMLInputElement => (e as HTMLInputElement).name === name);
      if (!els.length) return "";
      const first = els[0];
      if (first.type === "checkbox") return first.checked ? "1" : "";
      if (first.type === "radio") return els.find((r) => r.checked)?.value ?? "";
      return first.value.trim();
    };
    let max = 1;
    form.querySelectorAll<HTMLElement>("[data-field]").forEach((el) => {
      const s = Number(el.dataset.step) || 1; if (s > max) max = s;
      let condOff = false;
      const m = /^([a-z][a-z0-9_]*)(!?=)?(.*)$/.exec(el.dataset.showif ?? "");
      if (m) { const v = value(m[1]); condOff = m[2] === "=" ? v !== m[3] : m[2] === "!=" ? v === m[3] : !v; }
      el.hidden = condOff || s !== cur; // ô ở bước khác chỉ ẩn (giữ giá trị); ô bị điều kiện ẩn thì tắt hẳn để không gửi và không bắt buộc
      if (condOff) el.dataset.condOff = "1"; else delete el.dataset.condOff;
      el.querySelectorAll<HTMLInputElement>("input, textarea, select").forEach((i) => { i.disabled = condOff; });
    });
    setMaxStep((x) => (x === max ? x : max));
  }, []);
  useEffect(() => { sync(step); }, [sync, step, state.status]);
  const goNext = () => {
    const form = formEl.current; if (!form) return;
    const bad = Array.from(form.querySelectorAll<HTMLInputElement>("[data-field]:not([hidden]) input:not([type=hidden]), [data-field]:not([hidden]) textarea, [data-field]:not([hidden]) select")).find((i) => !i.checkValidity());
    if (bad) { bad.reportValidity(); return; }
    setStep((s) => Math.min(maxStep, s + 1));
  };

  function showErrors(form: HTMLFormElement, errors: Record<string, string[]>) {
    form.querySelectorAll<HTMLElement>("[data-field]").forEach((el) => {
      const msg = errors[el.dataset.field ?? ""]?.join(" ") ?? "";
      const out = el.querySelector(".ecx-field-error");
      if (out) out.textContent = msg;
      el.querySelectorAll("input, textarea, select").forEach((i) => { if (msg) i.setAttribute("aria-invalid", "true"); else i.removeAttribute("aria-invalid"); });
    });
    const first = Object.keys(errors)[0];
    if (first) form.querySelector<HTMLElement>(`[data-field="${CSS.escape(first)}"] input, [data-field="${CSS.escape(first)}"] textarea, [data-field="${CSS.escape(first)}"] select`)?.focus();
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step < maxStep) { goNext(); return; }
    const form = e.currentTarget;
    const data = new FormData(form);
    const fields: Record<string, string | boolean> = {};
    form.querySelectorAll<HTMLElement>("[data-field]").forEach((el) => {
      const name = el.dataset.field!;
      if (el.dataset.condOff) return; // ô bị điều kiện ẩn không gửi
      const box = el.querySelector<HTMLInputElement>("input[type=checkbox]");
      fields[name] = box ? box.checked : String(data.get(name) ?? "");
    });
    setState({ status: "sending" }); showErrors(form, {});
    try {
      const res = await fetch("/api/cms/forms", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ formId, source, fields, hp: String(data.get("_hp") ?? ""), ms: Date.now() - started.current, page: location.pathname, extra: extraFields(data) }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { showErrors(form, json.errors ?? {}); setState({ status: "error", message: json.title ?? labels.error }); return; }
      form.reset();
      // 1.26: chuyển trang sau khi gửi (máy chủ chỉ trả đường dẫn trong site hoặc http(s))
      if (typeof json.redirect === "string" && /^(\/(?![\/\\])|https?:\/\/)/.test(json.redirect)) { window.location.assign(json.redirect); return; }
      setState({ status: "done", message: json.message || successMessage || "" });
    } catch { setState({ status: "error", message: labels.error }); }
  }

  if (state.status === "done") return <p className="ecx-form-status is-success" role="status" data-form-done={formId}>{state.message}</p>;
  return (
    <form ref={formEl} className={cx("ecx-form-blocks", className)} onSubmit={submit} onChange={() => sync(step)} onInput={() => sync(step)} noValidate data-form={formId}>
      {maxStep > 1 && <p className="ecx-form-step" role="status">{(labels.step ?? "{n}/{total}").replace("{n}", String(step)).replace("{total}", String(maxStep))}</p>}
      {children}
      {extraUi}
      <p className="ecx-form-hp" aria-hidden="true"><label>Website<input type="text" name="_hp" tabIndex={-1} autoComplete="off" /></label></p>
      {state.status === "error" && <p className="ecx-form-status is-error" role="alert">{state.message}</p>}
      <div className="ecx-form-actions">
        {step > 1 && <button type="button" className="ecx-form-back" onClick={() => setStep((s) => Math.max(1, s - 1))}>{labels.back ?? "←"}</button>}
        <button type="submit" className={button?.className ?? "ecx-button"} style={{ border: 0, cursor: "pointer", font: "inherit", ...button?.style }} disabled={state.status === "sending"}>{state.status === "sending" ? labels.sending : step < maxStep ? (labels.next ?? "→") : labels.submit}</button>
      </div>
    </form>
  );
}


/**
 * Khối Carousel (slider): track cuộn ngang bám mép slide (vuốt được trên điện thoại, không JS vẫn cuộn), nút trước / sau, chấm theo vị trí,
 * tự chạy tuỳ chọn (dừng khi rê chuột / đang focus / tab ẩn / người dùng tắt hiệu ứng chuyển động, có nút Tạm dừng). Số slide thấy cùng lúc theo khổ máy do CSS (style.css).
 */
export function CarouselClient({ children, count, config: c, label }: { children: ReactNode; count: number; config: CarouselConfig; label?: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ index: 0, visible: c.per });
  const [held, setHeld] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(true);
  const fade = c.effect === "fade";
  const [ready, setReady] = useState(false);
  const measure = useCallback(() => {
    const el = track.current;
    const first = el?.children[0] as HTMLElement | undefined;
    if (!el || !first || fade) return;
    const step = ((el.children[1] as HTMLElement | undefined)?.offsetLeft ?? first.offsetLeft + first.offsetWidth) - first.offsetLeft || first.offsetWidth || 1;
    const gap = Math.max(0, step - first.offsetWidth);
    const visible = Math.max(1, Math.min(count, Math.round((el.clientWidth + gap) / step)));
    setPos((p) => { const index = Math.max(0, Math.min(count - visible, Math.round(el.scrollLeft / step))); return p.index === index && p.visible === visible ? p : { index, visible }; });
  }, [count, fade]);
  useEffect(() => {
    setReady(true);
    setReduced(typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
    measure();
    const el = track.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);
  // Mờ dần: không cuộn — đổi chỉ số, slide đang hiện nhận class is-active (CSS lo phần mờ)
  useEffect(() => {
    if (!fade) return;
    Array.from(track.current?.children ?? []).forEach((k, i) => { k.classList.toggle("is-active", i === pos.index); k.classList.toggle("is-off", i !== pos.index); k.setAttribute("aria-hidden", i === pos.index ? "false" : "true"); });
  }, [fade, pos.index, count]);
  const goTo = useCallback((i: number) => {
    if (fade) { setPos((p) => ({ ...p, index: Math.max(0, Math.min(count - 1, i)) })); return; }
    const el = track.current, kid = el?.children[i] as HTMLElement | undefined;
    if (el && kid) el.scrollTo({ left: kid.offsetLeft - (el.children[0] as HTMLElement).offsetLeft, behavior: reduced ? "auto" : "smooth" });
  }, [reduced, fade, count]);
  const last = Math.max(0, count - (fade ? 1 : pos.visible));
  const next = useCallback(() => { if (pos.index >= last) { if (c.loop) goTo(0); } else goTo(pos.index + 1); }, [pos.index, last, c.loop, goTo]);
  const prev = useCallback(() => { if (pos.index <= 0) { if (c.loop) goTo(last); } else goTo(pos.index - 1); }, [pos.index, last, c.loop, goTo]);
  const running = c.autoplay && !reduced && !paused && !held && last > 0;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => { if (document.visibilityState === "visible") next(); }, c.interval * 1000);
    return () => clearInterval(t);
  }, [running, next, c.interval]);
  const chevron = (d: string) => <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
  const many = last > 0;
  return (
    <div className="ecx-carousel" role="region" aria-roledescription="carousel" aria-label={label} style={carouselVars(c) as CSSProperties} {...carouselData(c)} data-ready={ready ? "" : undefined}
      onMouseEnter={() => c.hoverPause && setHeld(true)} onMouseLeave={() => setHeld(false)} onFocus={() => c.hoverPause && setHeld(true)} onBlur={() => setHeld(false)}>
      <div className="ecx-carousel-track" ref={track} onScroll={measure} tabIndex={0} aria-live={running ? "off" : "polite"}
        onKeyDown={(e) => { if (e.key === "ArrowRight") { e.preventDefault(); next(); } else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); } }}>{children}</div>
      {c.arrows && many && <>
        <button type="button" className="ecx-carousel-arrow is-prev" aria-label="←" disabled={!c.loop && pos.index <= 0} onClick={prev}>{chevron("m15 18-6-6 6-6")}</button>
        <button type="button" className="ecx-carousel-arrow is-next" aria-label="→" disabled={!c.loop && pos.index >= last} onClick={next}>{chevron("m9 18 6-6-6-6")}</button>
      </>}
      {many && (c.dots || c.autoplay) && (
        <div className="ecx-carousel-dots">
          {c.dots && Array.from({ length: last + 1 }, (_, i) => <button key={i} type="button" className="ecx-carousel-dot" aria-label={`${i + 1} / ${last + 1}`} aria-current={i === pos.index ? "true" : undefined} onClick={() => goTo(i)} />)}
          {c.autoplay && !reduced && <button type="button" className="ecx-carousel-pause" aria-label={paused ? "▶" : "⏸"} aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? "▶" : "⏸"}</button>}
        </div>
      )}
    </div>
  );
}

/**
 * Popup: nút mở + hộp thoại <dialog> gốc của trình duyệt (khoá focus trong hộp, Esc đóng, trả focus về nút) — nội dung nằm sẵn trong HTML.
 * Bấm nền tối để đóng (khi cho phép), khoá cuộn trang khi mở.
 */
export function PopupClient({ trigger, triggerClass, triggerStyle, className, style, label, closeButton, closeOnOverlay, children, popupId, auto, autoDelay = 5, autoScroll = 50, onceDays = 0 }: {
  popupId?: string; auto?: "none" | "delay" | "scroll" | "exit" | "idle"; autoDelay?: number; autoScroll?: number; onceDays?: number;
  trigger: ReactNode; triggerClass: string; triggerStyle?: CSSProperties; className: string; style?: CSSProperties; label?: string; closeButton: boolean; closeOnOverlay: boolean; children: ReactNode;
}) {
  const dlg = useRef<HTMLDialogElement>(null);
  const root = typeof document !== "undefined" ? document.documentElement : null;
  const close = useCallback(() => dlg.current?.close(), []);
  const onClose = useCallback(() => root?.classList.remove("ecx-popup-open"), [root]);
  useEffect(() => () => root?.classList.remove("ecx-popup-open"), [root]);
  const open = useCallback(() => { const d = dlg.current; if (d && !d.open) { d.showModal(); root?.classList.add("ecx-popup-open"); } }, [root]);
  // Mở bằng liên kết #popup-<id> / phần tử data-popup-open="<id>" ở bất kỳ đâu, và khi địa chỉ trang có #popup-<id>
  useEffect(() => {
    if (!popupId) return;
    const hash = `#popup-${popupId}`;
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.(`a[href="${hash}"], [data-popup-open="${popupId}"]`);
      if (el) { e.preventDefault(); open(); }
    };
    document.addEventListener("click", onClick);
    if (location.hash === hash) open();
    return () => document.removeEventListener("click", onClick);
  }, [popupId, open]);
  // Tự mở (một lần theo ngày nếu đặt): trễ / cuộn % / thoát trang / không hoạt động
  useEffect(() => {
    if (!auto || auto === "none") return;
    const key = popupId ? `ecx-popup:${popupId}` : "";
    if (key && onceDays > 0) { try { const t = Number(localStorage.getItem(key)); if (t && Date.now() - t < onceDays * 864e5) return; } catch { /* trình duyệt chặn lưu trữ: coi như chưa hiện */ } }
    let done = false;
    const fire = () => { if (done) return; done = true; open(); if (key && onceDays > 0) { try { localStorage.setItem(key, String(Date.now())); } catch { /* bỏ qua */ } } };
    const off: Array<() => void> = [];
    if (auto === "delay") { const t = setTimeout(fire, autoDelay * 1000); off.push(() => clearTimeout(t)); }
    if (auto === "scroll") { const on = () => { const h = document.documentElement; const pct = ((h.scrollTop + window.innerHeight) / Math.max(1, h.scrollHeight)) * 100; if (pct >= autoScroll) fire(); }; window.addEventListener("scroll", on, { passive: true }); on(); off.push(() => window.removeEventListener("scroll", on)); }
    if (auto === "exit") { const on = (e: MouseEvent) => { if (e.clientY <= 0 && !e.relatedTarget) fire(); }; document.addEventListener("mouseout", on); off.push(() => document.removeEventListener("mouseout", on)); }
    if (auto === "idle") {
      let t = setTimeout(fire, autoDelay * 1000);
      const reset = () => { clearTimeout(t); t = setTimeout(fire, autoDelay * 1000); };
      for (const ev of ["mousemove", "keydown", "scroll", "touchstart", "click"]) window.addEventListener(ev, reset, { passive: true });
      off.push(() => { clearTimeout(t); for (const ev of ["mousemove", "keydown", "scroll", "touchstart", "click"]) window.removeEventListener(ev, reset); });
    }
    return () => off.forEach((f) => f());
  }, [auto, autoDelay, autoScroll, onceDays, popupId, open]);
  return (
    <div className={className} style={style}>
      {trigger !== null && trigger !== undefined && trigger !== "" && <button type="button" className={triggerClass} style={triggerStyle} aria-haspopup="dialog" onClick={(e) => { const d = dlg.current; if (d && !d.open) { e.currentTarget.focus(); /* Safari không lấy nét nút khi bấm chuột → đóng popup không có chỗ trả focus */ d.showModal(); root?.classList.add("ecx-popup-open"); } }}>{trigger}</button>}
      <dialog ref={dlg} id={popupId ? `popup-${popupId}` : undefined} className="ecx-popup-dialog" aria-label={label || undefined} onClose={onClose} onClick={(e) => { if (closeOnOverlay && e.target === dlg.current) close(); }}>
        {closeButton && <button type="button" className="ecx-popup-close" aria-label="×" onClick={close}><svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg></button>}
        <div className="ecx-popup-body">{children}</div>
      </dialog>
    </div>
  );
}

/**
 * Chữ gõ ở cuối Tiêu đề: gõ từng ký tự, dừng, xoá, sang từ kế (lặp hoặc dừng ở từ cuối). HTML dựng sẵn là từ đầu tiên;
 * người xem bật giảm chuyển động thì giữ nguyên từ đầu. Trình đọc màn hình đọc cả nhóm từ một lần (aria-label), không đọc từng ký tự.
 */
export function TypedText({ words, speed, pause, loop }: { words: string[]; speed: number; pause: number; loop: boolean }) {
  const [text, setText] = useState(words[0] ?? "");
  useEffect(() => {
    if (words.length < 2 || (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
    let i = 0, len = words[0].length, deleting = true, stop = false;
    let t: ReturnType<typeof setTimeout> = setTimeout(function tick() {
      if (stop) return;
      const w = words[i];
      if (deleting) {
        len--; setText(w.slice(0, Math.max(0, len)));
        if (len <= 0) { deleting = false; i = (i + 1) % words.length; if (!loop && i === 0) { setText(words[words.length - 1]); return; } }
        t = setTimeout(tick, speed / 2);
      } else {
        len++; setText(words[i].slice(0, len));
        if (len >= words[i].length) { deleting = true; if (!loop && i === words.length - 1) return; t = setTimeout(tick, pause); return; }
        t = setTimeout(tick, speed);
      }
    }, pause);
    return () => { stop = true; clearTimeout(t); };
  }, [words, speed, pause, loop]);
  return <span className="ecx-typed" aria-label={words.join(", ")}><span aria-hidden="true">{text}</span></span>;
}

/** Video nền (Ảnh bìa): tự phát, tắt tiếng, lặp, không có điều khiển; người xem bật "giảm chuyển động" thì dừng và chỉ hiện ảnh (poster). */
export function BgVideo({ src, poster, className, style }: { src: string; poster?: string; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || typeof matchMedia !== "function") return;
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => { if (mq.matches) v.pause(); else void v.play().catch(() => { /* trình duyệt chặn tự phát: giữ poster */ }); };
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);
  return <video ref={ref} className={className} style={style} src={src} poster={poster} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" tabIndex={-1} />;
}

/** Hàng cuộn ngang có nút trước / sau (Query dạng carousel): cuộn đúng một "trang" mỗi lần bấm, ẩn nút ở hai đầu. Không có JS vẫn vuốt / cuộn được. */
export function ScrollRow({ children, arrows = true }: { children: ReactNode; arrows?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const update = useCallback(() => {
    const el = ref.current;
    if (el) setEdge({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  }, []);
  useEffect(() => {
    update();
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update]);
  const go = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth, behavior: "smooth" });
  return (
    <div className="ecx-scroller">
      <div className="ecx-scroller-track" ref={ref} onScroll={update} tabIndex={0}>{children}</div>
      {arrows && !edge.start && <button type="button" className="ecx-scroller-arrow is-prev" aria-label="←" onClick={() => go(-1)}><svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg></button>}
      {arrows && !edge.end && <button type="button" className="ecx-scroller-arrow is-next" aria-label="→" onClick={() => go(1)}><svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg></button>}
    </div>
  );
}

const BURGER = <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true" focusable="false"><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
const CLOSE = <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true" focusable="false"><path d="M18 6 6 18M6 6l12 12" /></svg>;

/**
 * Menu di động của khối Menu: nút burger mở ngăn trượt từ trái (nền mờ, nút đóng, khoá cuộn trang, Esc / bấm nền / bấm liên kết để đóng,
 * trả focus về nút). Menu con hiện thụt vào ngay dưới mục cha. Khác NavToggle (giữ nguyên cho theme cũ dùng <details>).
 */
export function NavDrawer({ label, closeLabel, children }: { label: string; closeLabel: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => { setOpen(false); button.current?.focus(); }, []);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [open, close]);
  return (
    <div className={cx("ecx-nav-drawer", open && "is-open")}>
      <button ref={button} type="button" className="ecx-nav-burger" aria-label={label} aria-expanded={open} aria-controls={id} onClick={() => setOpen(true)}>{BURGER}</button>
      {/* Ngăn trượt gắn vào <body>: khối chứa (group có container-type, sticky, transform…) sẽ nhốt phần tử fixed lại trong khung của nó */}
      {mounted && createPortal(
        <div className={cx("ecx-nav-drawer", "is-portal", open && "is-open")}>
          <div className="ecx-nav-backdrop" onClick={close} aria-hidden="true" />
          <div id={id} className="ecx-nav-panel" role="dialog" aria-modal="true" aria-label={label} aria-hidden={!open} {...(!open ? { inert: true } : {})}>
            <button type="button" className="ecx-nav-close" aria-label={closeLabel} onClick={close}>{CLOSE}</button>
            <div className="ecx-nav-panel-body" onClick={(e) => { if ((e.target as Element).closest("a")) setOpen(false); }}>{children}</div>
          </div>
        </div>, document.body)}
    </div>
  );
}

/**
 * Thanh lọc của khối Query (GET): ô tìm, mục phân loại (liên kết tới trang mục / nút lọc / ô chọn), sắp xếp.
 * Giá trị lên URL dạng ?fq_s, ?fq_sort, ?fq_<phân loại>; khối Query bật "Nhận bộ lọc từ thanh lọc" đọc lại. Ô chọn tự gửi khi đổi.
 */
export function QueryFilterBar({ action, taxonomy, termStyle, terms, currentTerm, values, showSearch, showSort, showYear, showReset, years, sorts, labels, range }: {
  range?: { param: string; label?: string; max?: number };
  action: string; taxonomy?: string; termStyle: "none" | "links" | "chips" | "select" | "checks"; terms: Array<{ slug: string; name: string; link: string }>; currentTerm?: string; values: Record<string, string>;
  showSearch: boolean; showSort: boolean; showYear: boolean; showReset: boolean; years: number[]; sorts: Array<{ value: string; label: string }>; labels: { all: string; search: string; placeholder: string; submit: string; sort: string; year: string; reset: string; from?: string; to?: string };
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const termKey = taxonomy ? `fq_${taxonomy}` : "";
  const picked = termKey ? values[termKey] ?? "" : "";
  const submit = () => formRef.current?.requestSubmit();
  // Checkbox nhiều lựa chọn: giữ tập đã chọn, gửi dạng ?fq_<phân loại>=a,b,c
  const [checked, setChecked] = useState<string[]>(() => picked.split(",").map((x) => x.trim()).filter(Boolean));
  const toggle = (slug: string) => setChecked((c) => (c.includes(slug) ? c.filter((x) => x !== slug) : [...c, slug]));
  return (
    <NextForm ref={formRef as never} action={action} className="ecx-query-filter" role="search">
      {termStyle === "links" && terms.length > 0 && (
        <nav className="ecx-filter-terms" aria-label={taxonomy}>
          <NextLink href={action} className={!currentTerm ? "is-active" : undefined} aria-current={!currentTerm ? "true" : undefined}>{labels.all}</NextLink>
          {terms.map((t) => <NextLink key={t.slug} href={t.link} className={t.slug === currentTerm ? "is-active" : undefined} aria-current={t.slug === currentTerm ? "true" : undefined}>{t.name}</NextLink>)}
        </nav>
      )}
      {termStyle === "chips" && terms.length > 0 && (
        <fieldset className="ecx-filter-terms"><legend className="ecx-visually-hidden">{taxonomy}</legend>
          <label className={!picked ? "is-active" : undefined}><input type="radio" name={termKey} value="" defaultChecked={!picked} onChange={submit} />{labels.all}</label>
          {terms.map((t) => <label key={t.slug} className={picked === t.slug ? "is-active" : undefined}><input type="radio" name={termKey} value={t.slug} defaultChecked={picked === t.slug} onChange={submit} />{t.name}</label>)}
        </fieldset>
      )}
      {termStyle === "checks" && terms.length > 0 && (
        <fieldset className="ecx-filter-terms is-checks"><legend className="ecx-visually-hidden">{taxonomy}</legend>
          {terms.map((t) => <label key={t.slug} className={checked.includes(t.slug) ? "is-active" : undefined}><input type="checkbox" checked={checked.includes(t.slug)} onChange={() => { toggle(t.slug); setTimeout(submit, 0); }} />{t.name}</label>)}
          <input type="hidden" name={termKey} value={checked.join(",")} />
        </fieldset>
      )}
      {range && (
        <fieldset className="ecx-filter-range"><legend>{range.label ?? ""}</legend>
          <input type="number" inputMode="numeric" min={0} max={range.max} name={`fq_${range.param}_min`} defaultValue={values[`fq_${range.param}_min`] ?? ""} placeholder={labels.from ?? "Từ"} aria-label={`${range.label ?? range.param}: ${labels.from ?? "Từ"}`} />
          <span aria-hidden="true">–</span>
          <input type="number" inputMode="numeric" min={0} max={range.max} name={`fq_${range.param}_max`} defaultValue={values[`fq_${range.param}_max`] ?? ""} placeholder={labels.to ?? "Đến"} aria-label={`${range.label ?? range.param}: ${labels.to ?? "Đến"}`} />
        </fieldset>
      )}
      {termStyle === "select" && terms.length > 0 && (
        <select name={termKey} aria-label={taxonomy} defaultValue={picked} onChange={submit}><option value="">{labels.all}</option>{terms.map((t) => <option key={t.slug} value={t.slug}>{t.name}</option>)}</select>
      )}
      {showSearch && <input type="search" name="fq_s" defaultValue={values.fq_s ?? ""} placeholder={labels.placeholder} aria-label={labels.search} />}
      {showSort && sorts.length > 0 && <select name="fq_sort" aria-label={labels.sort} defaultValue={values.fq_sort ?? sorts[0].value} onChange={submit}>{sorts.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>}
      {showYear && years.length > 0 && <select name="fq_year" aria-label={labels.year} defaultValue={values.fq_year ?? ""} onChange={submit}><option value="">{labels.year}</option>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>}
      {(showSearch || termStyle === "chips" || !!range) && <button type="submit">{labels.submit}</button>}
      {showReset && (Object.keys(values).some((k) => k.startsWith("fq_")) || !!currentTerm) && <NextLink href={action} className="ecx-filter-reset">{labels.reset}</NextLink>}
    </NextForm>
  );
}

/** Khối theo nhóm người xem: kiểm ở trình duyệt (trang vẫn cache được). Chưa biết người xem → ẩn; khớp nhóm → hiện. */
export function AudienceGate({ audience, children }: { audience: "guest" | "user"; children: ReactNode }) {
  const user = useCurrentUser();
  const show = user !== undefined && (audience === "user") === !!user;
  return <div className="ecx-aud" data-aud={audience} hidden={!show}>{children}</div>;
}

/** Gallery dạng thumbnail slider: ảnh lớn + dải ảnh nhỏ bấm / bàn phím (← → Home End) đổi ảnh lớn. */
export function GalleryThumbsClient({ mains, thumbs, label }: { mains: ReactNode[]; thumbs: ReactNode[]; label?: string }) {
  const [active, setActive] = useState(0);
  const go = (n: number) => setActive(((n % mains.length) + mains.length) % mains.length);
  return (
    <div className="ecx-gallery-thumbs" aria-roledescription="carousel" aria-label={label}>
      <div className="ecx-gt-main" role="tabpanel" aria-live="polite">{mains[active]}</div>
      <div className="ecx-gt-strip" role="tablist" aria-label={label}
        onKeyDown={(e) => { const k = e.key; if (k === "ArrowRight" || k === "ArrowDown") { e.preventDefault(); go(active + 1); } else if (k === "ArrowLeft" || k === "ArrowUp") { e.preventDefault(); go(active - 1); } else if (k === "Home") { e.preventDefault(); go(0); } else if (k === "End") { e.preventDefault(); go(mains.length - 1); } }}>
        {thumbs.map((t, i) => <button key={i} type="button" role="tab" className="ecx-gt-thumb" aria-selected={i === active} tabIndex={i === active ? 0 : -1} aria-label={`${i + 1} / ${thumbs.length}`} onClick={() => setActive(i)}>{t}</button>)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lottie (khối "lottie", content ≥ 1.29): thư viện @lottiefiles/dotlottie-web là TUỲ CHỌN
// ---------------------------------------------------------------------------

/** Nơi website phục vụ thư viện (route /ecx-lottie của core); không có thư viện → 404 → khối chỉ hiện poster. */
export const LOTTIE_BASE = "/ecx-lottie";
type DotLottieCtor = new (cfg: Record<string, unknown>) => { play(): void; pause(): void; destroy(): void; addEventListener(ev: string, fn: () => void): void; isPlaying?: boolean };
type DotLottieModule = { DotLottie: DotLottieCtor & { setWasmUrl?(url: string): void } };

/**
 * Nạp thư viện một lần cho cả trang, từ cùng nguồn (CSP 'self') chứ không gộp vào gói của website — nên gỡ thư viện đi thì
 * website vẫn build và chạy bình thường. Lỗi ở bất kỳ bước nào (404, wasm bị chặn, trình duyệt cũ) → null.
 */
export function loadDotLottie(base = LOTTIE_BASE): Promise<DotLottieModule | null> {
  const g = globalThis as { __ecxLottie?: Promise<DotLottieModule | null> };
  g.__ecxLottie ??= (async () => {
    try {
      const mod = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ /* @vite-ignore */ `${base}/index.js`)) as DotLottieModule;
      mod.DotLottie.setWasmUrl?.(`${base}/player.wasm`);
      return mod;
    } catch { return null; }
  })();
  return g.__ecxLottie;
}

/**
 * Hoạt ảnh Lottie: poster (ảnh tĩnh) hiện sẵn từ máy chủ; thư viện chỉ nạp khi khối gần vào màn hình; chạy theo `trigger`
 * (auto / hover / click / scroll). Tôn trọng "giảm chuyển động" (không tự chạy). Mọi lỗi → giữ poster, trang không hỏng.
 */
export function LottieClient({ src, poster, label, loop, autoplay, speed, trigger, className, style }: {
  src: string; poster?: string; label?: string; loop: boolean; autoplay: boolean; speed: number; trigger: "auto" | "hover" | "click" | "scroll";
  className: string; style?: CSSProperties;
}) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const el = box.current, cv = canvas.current;
    if (!src || !el || !cv) return;
    let dead = false;
    let player: InstanceType<DotLottieCtor> | undefined;
    const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const visible = { now: false };
    const io = typeof IntersectionObserver === "function" ? new IntersectionObserver(([e]) => {
      visible.now = e.isIntersecting;
      if (e.isIntersecting && !player) void start();
      if (player) { if (e.isIntersecting && (trigger === "scroll" || (trigger === "auto" && autoplay && !reduce))) player.play(); else if (!e.isIntersecting) player.pause(); }
    }, { rootMargin: "200px" }) : null;
    async function start() {
      const mod = await loadDotLottie();
      if (dead || !mod || player) return;
      try {
        const p = new mod.DotLottie({ canvas: cv, src, loop, speed, autoplay: !reduce && visible.now && (trigger === "scroll" || (trigger === "auto" && autoplay)) });
        player = p;
        p.addEventListener("load", () => { if (!dead) setReady(true); });
        p.addEventListener("loadError", () => { if (!dead) setReady(false); });
      } catch { /* giữ poster */ }
    }
    if (io) io.observe(el); else void start();
    const on = () => player?.play(), off = () => player?.pause();
    const toggle = () => (player?.isPlaying ? player.pause() : player?.play());
    if (trigger === "hover") { el.addEventListener("mouseenter", on); el.addEventListener("mouseleave", off); }
    if (trigger === "click") el.addEventListener("click", toggle);
    return () => {
      dead = true; io?.disconnect();
      el.removeEventListener("mouseenter", on); el.removeEventListener("mouseleave", off); el.removeEventListener("click", toggle);
      try { player?.destroy(); } catch { /* bỏ qua */ }
    };
  }, [src, loop, autoplay, speed, trigger]);
  return (
    <div ref={box} className={cx(className, ready && "is-ready")} style={style} data-trigger={trigger} role="img" aria-label={label || undefined} aria-hidden={label ? undefined : true}>
      {poster && <img className="ecx-lottie-poster" src={poster} alt="" loading="lazy" decoding="async" />}
      <canvas ref={canvas} className="ecx-lottie-canvas" />
    </div>
  );
}
