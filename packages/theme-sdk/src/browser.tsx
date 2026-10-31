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
