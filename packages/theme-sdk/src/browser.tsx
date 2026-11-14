"use client";

import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import type { IntlMessageFormat } from "intl-messageformat";
import { formatMessage } from "./i18n-format";
import type { ClientMessages, Translator } from "./i18n";
import type { BrowserEvents } from "./client";

// ---------------------------------------------------------------------------
// Gọi endpoint của plugin từ trình duyệt (core ≥ 1.20.0)
// ---------------------------------------------------------------------------

/** Lỗi trả về từ endpoint của plugin: status HTTP, lời nhắn (title), lỗi theo từng trường (422), mã lỗi (code). */
export class PluginApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly errors?: Record<string, string[]>, public readonly code?: string, public readonly data?: unknown) {
    super(message);
    this.name = "PluginApiError";
  }
}

export interface PluginRequestOptions {
  query?: Record<string, string | number | boolean | null | undefined>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface PluginClient {
  get<T = unknown>(path: string, opts?: PluginRequestOptions): Promise<T>;
  post<T = unknown>(path: string, body?: unknown, opts?: PluginRequestOptions): Promise<T>;
  put<T = unknown>(path: string, body?: unknown, opts?: PluginRequestOptions): Promise<T>;
  delete<T = unknown>(path: string, opts?: PluginRequestOptions): Promise<T>;
}

/**
 * Gọi endpoint của plugin từ component client — cùng endpoint với `pluginFetch` phía server, qua proxy của website
 * (`/api/cms/plugins/{slug}/…`): gửi kèm phiên của người đang đăng nhập (ICurrentUser ở backend), chặn gọi từ trang khác.
 * Lỗi → `PluginApiError` (status, title, errors theo trường).
 *
 *   const shop = pluginClient("shop");
 *   const cart = await shop.post<Cart>("/cart/items", { productId, qty: 1 });
 */
export function pluginClient(slug: string): PluginClient {
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(slug)) throw new Error(`pluginClient: slug không hợp lệ "${slug}"`);
  async function send<T>(method: string, path: string, body: unknown, opts: PluginRequestOptions = {}): Promise<T> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined && v !== null) qs.set(k, String(v));
    const url = `/api/cms/plugins/${slug}${path.startsWith("/") ? path : `/${path}`}${qs.size ? `?${qs}` : ""}`;
    const res = await fetch(url, {
      method, signal: opts.signal, credentials: "same-origin", cache: "no-store",
      headers: { accept: "application/json", ...(body !== undefined ? { "content-type": "application/json" } : {}), ...opts.headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let data: unknown = undefined;
    if (text) { try { data = JSON.parse(text); } catch { data = text; } }
    if (!res.ok) {
      const d = (typeof data === "object" && data) as { title?: string; detail?: string; errors?: Record<string, string[]>; code?: string } | false;
      throw new PluginApiError(res.status, (d && (d.title ?? d.detail)) || res.statusText || `HTTP ${res.status}`, d ? d.errors : undefined, d ? d.code : undefined, data);
    }
    return data as T;
  }
  return {
    get: (path, opts) => send("GET", path, undefined, opts),
    post: (path, body, opts) => send("POST", path, body, opts),
    put: (path, body, opts) => send("PUT", path, body, opts),
    delete: (path, opts) => send("DELETE", path, undefined, opts),
  };
}

// ---------------------------------------------------------------------------
// Sự kiện phía trình duyệt giữa theme và plugin (core ≥ 1.20.0)
// ---------------------------------------------------------------------------

type EventName = keyof BrowserEvents extends never ? string : keyof BrowserEvents | (string & {});
type EventData<K> = K extends keyof BrowserEvents ? BrowserEvents[K] : unknown;

const PREFIX = "ecx:";
let channel: BroadcastChannel | null | undefined;
function tabs() {
  if (channel === undefined) {
    channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("ecx-events");
    // Node (test, render phía server): kênh không được giữ tiến trình sống
    (channel as unknown as { unref?: () => void } | null)?.unref?.();
  }
  return channel;
}

/**
 * Phát sự kiện cho mọi component trên trang (vd plugin giỏ hàng báo "đã thêm" để mini-cart của theme cập nhật).
 * `crossTab: true`: các tab khác của cùng website cũng nhận (BroadcastChannel).
 */
export function emit<K extends EventName>(name: K, detail?: EventData<K>, opts?: { crossTab?: boolean }) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PREFIX + String(name), { detail }));
  if (opts?.crossTab) tabs()?.postMessage({ name: String(name), detail });
}

/** Nghe sự kiện; trả hàm huỷ. Nhận cả sự kiện từ tab khác nếu bên phát dùng crossTab. */
export function on<K extends EventName>(name: K, handler: (detail: EventData<K>) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const local = (e: Event) => handler((e as CustomEvent).detail as EventData<K>);
  const remote = (e: MessageEvent) => { if (e.data?.name === name) handler(e.data.detail as EventData<K>); };
  window.addEventListener(PREFIX + String(name), local);
  tabs()?.addEventListener("message", remote);
  return () => { window.removeEventListener(PREFIX + String(name), local); tabs()?.removeEventListener("message", remote); };
}

/** Hook React của `on`: tự huỷ khi component gỡ; handler mới nhất luôn được gọi (không cần useCallback). */
export function useEvent<K extends EventName>(name: K, handler: (detail: EventData<K>) => void) {
  const ref = useRef(handler);
  useEffect(() => { ref.current = handler; });
  useEffect(() => on(name, (d) => ref.current(d)), [name]);
}

// ---------------------------------------------------------------------------
// Dịch chữ trong component client (core ≥ 1.20.0)
// ---------------------------------------------------------------------------

const TranslationsContext = createContext<ClientMessages | null>(null);

/**
 * Chuyển chuỗi đã dịch xuống component client. Server Component lấy bằng `getClientMessages(["cart."])` rồi bọc:
 *   <TranslationsProvider value={await getClientMessages(["cart."])}><CartButton /></TranslationsProvider>
 * Nhiều provider lồng nhau được gộp (provider trong thắng).
 */
export function TranslationsProvider({ value, children }: { value: ClientMessages; children: ReactNode }) {
  const parent = useContext(TranslationsContext);
  const merged = useMemo<ClientMessages>(() => parent ? { locale: value.locale, messages: { ...parent.messages, ...value.messages } } : value, [parent, value]);
  return <TranslationsContext.Provider value={merged}>{children}</TranslationsContext.Provider>;
}

/** Hàm dịch trong component client — cùng cú pháp ICU với `getT`. Khoá không có trong provider → trả lại chính khoá. */
export function useT(): Translator {
  const ctx = useContext(TranslationsContext);
  return useMemo(() => {
    const compiled = new Map<string, IntlMessageFormat | null>();
    const t = ((key: string, vars?: Record<string, string | number>) => {
      const hit = ctx?.messages[key];
      return hit ? formatMessage(hit.text, hit.code, vars, compiled, `${hit.code}\0${key}`) : key;
    }) as Translator;
    t.locale = ctx?.locale ?? "en";
    return t;
  }, [ctx]);
}

// ---------------------------------------------------------------------------
// Chỗ cắm cho plugin (core ≥ 1.29): nạp script theo nhu cầu, khối sẵn sàng phía trình duyệt
// ---------------------------------------------------------------------------

/** Nạp một script của plugin đúng một lần cho cả phiên (thẻ <script> do React chèn khi chuyển trang bằng Link không tự chạy). */
export function AssetScript({ src }: { src: string }) {
  useEffect(() => {
    if ([...document.scripts].some((s) => s.dataset.ecxAsset === src)) return;
    const s = document.createElement("script");
    s.src = src; s.async = true; s.dataset.ecxAsset = src;
    document.head.append(s);
  }, [src]);
  return null;
}

export type BlockReadyFn = (el: HTMLElement, attrs: Record<string, unknown>) => void | (() => void);
const readyFns = new Set<{ type: string; fn: BlockReadyFn }>();
const applied = new WeakMap<HTMLElement, Map<BlockReadyFn, (() => void) | void>>();
let readyObserver: MutationObserver | null = null;

const readyEls = (root: ParentNode): HTMLElement[] => [
  ...((root as HTMLElement).dataset?.ecxReady ? [root as HTMLElement] : []),
  ...root.querySelectorAll<HTMLElement>("[data-ecx-ready]"),
];
function attach(el: HTMLElement) {
  const type = el.dataset.ecxReady!;
  let attrs: Record<string, unknown> = {};
  try { attrs = JSON.parse(el.dataset.ecxAttrs || "{}"); } catch { /* thuộc tính hỏng: gọi với {} */ }
  const done = applied.get(el) ?? new Map();
  applied.set(el, done);
  for (const r of readyFns) {
    if ((r.type !== "*" && r.type !== type) || done.has(r.fn)) continue;
    try { done.set(r.fn, r.fn(el, attrs)); } catch (e) { console.warn("[cms] onBlockReady", type, e); done.set(r.fn, undefined); }
  }
}
function detach(el: HTMLElement) {
  applied.get(el)?.forEach((cleanup) => { try { cleanup?.(); } catch { /* bỏ qua */ } });
  applied.delete(el);
}

/**
 * Gọi `fn(el, attrs)` cho mỗi khối loại `type` ("*" = mọi khối mà website gắn dấu) đang có / sẽ xuất hiện trên trang (kể cả sau
 * khi chuyển trang bằng Link); hàm dọn trả về được gọi khi khối rời trang. Website chỉ gắn dấu cho loại khối plugin khai ở
 * `definePlugin({ readyBlocks })` — `attrs` gồm các thuộc tính liệt kê ở đó. Trả hàm huỷ đăng ký.
 *   onBlockReady("image", (img) => { const z = startZoom(img); return () => z.stop(); });
 */
export function onBlockReady(type: string, fn: BlockReadyFn): () => void {
  const entry = { type, fn };
  readyFns.add(entry);
  if (typeof document === "undefined") return () => { readyFns.delete(entry); };
  readyEls(document).forEach(attach);
  readyObserver ??= new MutationObserver((ms) => {
    for (const m of ms) {
      m.removedNodes.forEach((n) => { if (n.nodeType === 1) readyEls(n as Element).forEach((el) => { if (!el.isConnected) detach(el); }); });
      m.addedNodes.forEach((n) => { if (n.nodeType === 1) readyEls(n as Element).forEach(attach); });
    }
  });
  readyObserver.observe(document.body, { childList: true, subtree: true });
  return () => {
    readyFns.delete(entry);
    readyEls(document).forEach((el) => { const c = applied.get(el)?.get(fn); try { c?.(); } catch { /* bỏ qua */ } applied.get(el)?.delete(fn); });
  };
}

declare global {
  interface Window {
    /** API ổn định cho script thuần nạp bằng `assets` (không qua bundle Next) — theme-sdk 1.41 / CMS ≥ 1.30. */
    ecx?: { onBlockReady?: typeof onBlockReady };
  }
}
// Có sẵn trước khi script của `assets` chạy (AssetScript chèn script sau khi module này nạp)
if (typeof window !== "undefined") (window.ecx ??= {}).onBlockReady ??= onBlockReady;
