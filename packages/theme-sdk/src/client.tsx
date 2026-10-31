"use client";

import { extraFields } from "./auth-forms";
import { Component, Suspense, useEffect, useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import NextLink, { useLinkStatus } from "next/link";
import NextForm from "next/form";
import { cx, formatDate } from "./utils";
import type { Comment, CommentPage } from "./types";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { createFetchKit, isFetchKitError } from "next-fetch-kit";

export { pluginClient, PluginApiError, emit, on, useEvent, TranslationsProvider, useT, type PluginClient, type PluginRequestOptions } from "./browser";

/**
 * Bảng tên sự kiện phía trình duyệt → dữ liệu (emit / on / useEvent, core ≥ 1.20.0). Theme / plugin khai báo kiểu cho sự kiện của mình:
 *   declare module "@ecomcx/ecomweb-theme-sdk/client" { interface BrowserEvents { "shop.cart.changed": { count: number } } }
 * Tên nên có tiền tố slug plugin (như hook backend).
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface BrowserEvents {}

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
export function SearchFormClient({ action, defaultValue, placeholder, label, buttonLabel }: { action: string; defaultValue?: string | null; placeholder: string; label: string; buttonLabel: string }) {
  return (
    <NextForm action={action} role="search" className="search-form">
      <input type="search" name="s" defaultValue={defaultValue ?? ""} placeholder={placeholder} aria-label={label} required />
      <button type="submit">{buttonLabel}</button>
    </NextForm>
  );
}

/** Ghi tuỳ chọn hiển thị của người đọc (xem getPreference). value = null để xoá. */
export function setPreference(key: string, value: string | null, maxAgeDays = 365) {
  if (!/^[a-z0-9-]{1,32}$/.test(key) || (value !== null && !/^[A-Za-z0-9_-]{0,64}$/.test(value))) throw new Error("Tuỳ chọn không hợp lệ");
  document.cookie = `cms-pref-${key}=${value ?? ""}; path=/; max-age=${value === null ? 0 : maxAgeDays * 86400}; samesite=lax`;
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
export function CommentList({ comments, site }: { comments: Comment[]; site: DateSite }) {
  return (
    <ol className="comment-list">
      {comments.map((c) => (
        <li key={c.id} id={`comment-${c.id}`} className="comment">
          <article>
            <header className="comment-meta">
              {c.avatarUrl && <img className="comment-avatar avatar" src={c.avatarUrl} alt="" width={40} height={40} loading="lazy" decoding="async" />}
              <b className="comment-author">{c.authorUrl ? <a href={c.authorUrl} rel="nofollow ugc">{c.authorName}</a> : c.authorName}</b>
              {" · "}<time dateTime={c.createdAt}>{formatDate(c.createdAt, site)}</time>
            </header>
            <div className="comment-content">{c.content.split("\n").map((l, i) => <p key={i}>{l}</p>)}</div>
          </article>
          {c.replies.length > 0 && <CommentList comments={c.replies} site={site} />}
        </li>
      ))}
    </ol>
  );
}

/** Nút "Xem thêm bình luận": tải các trang tiếp theo qua /api/cms/comments. */
export function CommentsMore({ postId, totalPages, site, labels }: { postId: number; totalPages: number; site: DateSite; labels: { more: string; loading: string; error: string } }) {
  const [pages, setPages] = useState<Comment[][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const next = pages.length + 2;
  async function load() {
    setLoading(true); setError("");
    try {
      const { data } = await browserApi.get<CommentPage>("/comments", { query: { postId, page: next } });
      setPages((p) => [...p, data.items]);
    } catch (e) { setError(errorMessage(e, labels.error)); } finally { setLoading(false); }
  }
  return (
    <>
      {pages.map((items, i) => <CommentList key={i} comments={items} site={site} />)}
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

export { LoginForm, RegisterForm, ForgotPasswordForm, ResetPasswordForm, LogoutButton, useCurrentUser, extraFields, AUTH_LABELS, AUTH_PATHS, type AuthLabels, type AuthPaths } from "./auth-forms";
export { safeRedirect, type CurrentUser } from "./auth-shared";
