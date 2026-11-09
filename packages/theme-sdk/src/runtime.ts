import { cache } from "react";
import type { ComponentType } from "react";
import { getSite, getTemplates } from "./api";
import type { FilterMap, LayoutProps, PluginDefinition, PluginLoader, RegionProps, ShortcodeProps, Site, TemplateProps, ThemeEntry } from "./types";

interface RuntimeConfig {
  themes: Record<string, ThemeEntry>;
  plugins: Record<string, PluginLoader>;
}

// Lưu trên globalThis để mọi bản sao module (server/edge chunk) dùng chung một registry.
const g = globalThis as unknown as { __cmsRuntime?: RuntimeConfig };

/** Frontend core gọi một lần với registry được sinh tự động (generated/registry.ts). */
export function configureRuntime(config: RuntimeConfig) {
  g.__cmsRuntime = config;
}

function runtime(): RuntimeConfig {
  if (!g.__cmsRuntime) throw new Error("CMS runtime chưa được cấu hình (configureRuntime)");
  return g.__cmsRuntime;
}

export const FALLBACK_THEME = "default";

type TemplateModule = { default: ComponentType<TemplateProps>; layout?: boolean };

/** Template có sẵn của SDK, dùng khi cả theme lẫn plugin không có: trang đăng nhập/đăng ký, template trang canvas / full-width. */
const BUILTIN_TEMPLATES: Record<string, () => Promise<TemplateModule>> = {
  auth: () => import("./auth-pages"),
  canvas: () => import("./page-canvas"),
  "full-width": () => import("./page-full-width"),
};

/** Tên template trang có sẵn (theme có template cùng tên thì dùng của theme). */
export const BUILTIN_PAGE_TEMPLATES = ["canvas", "full-width"] as const;

export interface LoadedTheme {
  slug: string;
  chain: ThemeEntry[];
  templateNames: string[];
  /** layout = false: template tự vẽ cả trang, không bọc trong layout của theme (`export const layout = false` trong file template). */
  resolveTemplate(candidates: string[]): Promise<{ name: string; Component: ComponentType<TemplateProps>; layout: boolean }>;
  layout(): Promise<ComponentType<LayoutProps> | null>;
}

/** Theme đang active (kèm theme cha nếu là child theme). Fallback về "default" nếu theme không tồn tại trong bản build. */
export const getActiveTheme = cache(async (site?: Site): Promise<LoadedTheme> => {
  const s = site ?? (await getSite());
  const { themes } = runtime();
  let slug = themes[s.activeTheme] ? s.activeTheme : FALLBACK_THEME;
  if (!themes[slug]) slug = Object.keys(themes)[0];
  const chain: ThemeEntry[] = [];
  let current: string | null | undefined = slug;
  while (current && themes[current] && chain.length < 5) {
    chain.push(themes[current]);
    current = themes[current].manifest.parent;
  }
  const templateNames = [...new Set(chain.flatMap((t) => Object.keys(t.templates)))];

  return {
    slug,
    chain,
    templateNames,
    async resolveTemplate(candidates) {
      // Mỗi tên template theo thứ tự ưu tiên: template khối → theme (con trước cha) → plugin đang bật → template có sẵn của SDK.
      // Theme luôn ghi đè được template của plugin; tên cụ thể hơn (single-product) thắng tên chung (single) dù nằm ở plugin.
      const extensions = await getActiveExtensions(s);
      // Theme dựng bằng khối: template khối (bản sửa trong Trình dựng / templates/*.json) thắng file .tsx cùng tên
      const blockTemplates = chain[0]?.manifest.editing === "blocks" ? (await getTemplates().catch(() => null))?.templates ?? {} : {};
      for (const name of [...candidates, "index"]) {
        if (blockTemplates[name]) return { name, Component: (await import("./template-blocks")).default, layout: true };
        for (const theme of chain) {
          const loader = theme.templates[name];
          if (loader) { const mod = (await loader()) as TemplateModule; return { name, Component: mod.default, layout: mod.layout !== false }; }
        }
        for (const d of extensions) {
          const Component = d.templates?.[name];
          if (Component) return { name, Component, layout: (Component as { layout?: boolean }).layout !== false };
        }
        const builtin = BUILTIN_TEMPLATES[name];
        if (builtin) { const mod = await builtin(); return { name, Component: mod.default, layout: mod.layout !== false }; }
      }
      throw new Error(`Theme "${slug}" thiếu templates/index.tsx`);
    },
    async layout() {
      for (const theme of chain) if (theme.layout) return (await theme.layout()).default;
      return null;
    },
  };
});

/** Định nghĩa của plugin đang bật + phần "extend" của theme. */
export const getActiveExtensions = cache(async (site?: Site): Promise<PluginDefinition[]> => {
  const s = site ?? (await getSite());
  const { plugins } = runtime();
  const defs: PluginDefinition[] = [];
  for (const slug of s.activePlugins ?? []) {
    const loader = plugins[slug];
    if (!loader) continue;
    try { defs.push((await loader()).default); }
    catch (e) { console.error(`[cms] Không nạp được plugin frontend "${slug}"`, e); }
  }
  const theme = await getActiveTheme(s);
  for (const t of [...theme.chain].reverse()) {
    if (t.extend) {
      try { defs.push((await t.extend()).default); }
      catch (e) { console.error(`[cms] Không nạp được extend của theme`, e); }
    }
  }
  return defs;
});

/**
 * Hàm mà plugin đang bật công bố qua definePlugin({ exports }). null nếu plugin chưa cài/chưa bật — luôn kiểm tra:
 *   const shop = await getPlugin<ShopApi>("shop");
 *   if (shop) cart = await shop.getCart();
 * Chỉ dùng phía server (Server Component, route, generateMetadata). Component client nhận dữ liệu qua props.
 */
export async function getPlugin<T = Record<string, unknown>>(slug: string, site?: Site): Promise<T | null> {
  const s = site ?? (await getSite());
  if (!s.activePlugins.includes(slug)) return null;
  const loader = runtime().plugins[slug];
  if (!loader) return null;
  try { return ((await loader()).default.exports ?? {}) as T; }
  catch (e) { console.error(`[cms] Không nạp được plugin frontend "${slug}"`, e); return null; }
}

/** Plugin có đang bật không. */
export async function hasPlugin(slug: string, site?: Site): Promise<boolean> {
  return (site ?? (await getSite())).activePlugins.includes(slug);
}

/** Shortcode có sẵn của SDK (plugin cùng tên được ưu tiên): [cms-form plugin="…" table="…" submit="…"]. */
const BUILTIN_SHORTCODES: Record<string, () => Promise<ComponentType<ShortcodeProps>>> = {
  "cms-form": async () => (await import("./plugin-form")).CmsFormShortcode,
};

export async function findShortcode(name: string, site?: Site) {
  for (const d of await getActiveExtensions(site)) if (d.shortcodes?.[name]) return d.shortcodes[name];
  return BUILTIN_SHORTCODES[name] ? await BUILTIN_SHORTCODES[name]() : null;
}
export async function findWidget(type: string, site?: Site) {
  for (const d of await getActiveExtensions(site)) if (d.widgets?.[type]) return d.widgets[type];
  return null;
}
/** Route gốc của plugin đang bật (vd "/news-sitemap.xml"). */
export async function findRoute(path: string, site?: Site) {
  for (const d of await getActiveExtensions(site)) if (d.routes?.[path]) return d.routes[path];
  return null;
}
export async function findBlock(type: string, site?: Site) {
  for (const d of await getActiveExtensions(site)) if (d.blocks?.[type]) return d.blocks[type];
  return null;
}

/** Component thay vùng (definePlugin → regions): priority nhỏ nhất thắng, bằng nhau thì plugin trước theme. */
export async function findRegion(name: string, site?: Site): Promise<ComponentType<RegionProps> | null> {
  let best: { Component: ComponentType<RegionProps>; priority: number } | null = null;
  for (const d of await getActiveExtensions(site)) {
    const raw = d.regions?.[name];
    if (!raw) continue;
    const item = typeof raw === "function" ? { Component: raw, priority: 10 } : { Component: raw.component, priority: raw.priority ?? 10 };
    if (item.Component && (!best || item.priority < best.priority)) best = item;
  }
  return best?.Component ?? null;
}

export interface LoadedSlotItem {
  Component: ComponentType<any>;
  priority: number;
}

export async function getSlotItems(name: string, site?: Site): Promise<LoadedSlotItem[]> {
  const defs = await getActiveExtensions(site);
  const items: LoadedSlotItem[] = [];

  for (const d of defs) {
    const raw = d.slots?.[name];
    if (!raw) continue;
    const list = Array.isArray(raw) ? raw : [raw];
    for (const item of list) {
      if (!item) continue;
      if (typeof item === "function") {
        items.push({ Component: item as ComponentType<any>, priority: 10 });
      } else if (typeof item === "object" && "component" in item) {
        items.push({ Component: item.component, priority: item.priority ?? 10 });
      }
    }
  }

  return items.sort((a, b) => a.priority - b.priority);
}

/** Lấy các component gắn vào slot, đã sắp xếp theo priority */
export async function getSlotComponents(name: string, site?: Site): Promise<ComponentType<any>[]> {
  const items = await getSlotItems(name, site);
  return items.map((x) => x.Component);
}

/** Chạy filter của các plugin/theme đang bật theo thứ tự, bỏ qua filter bị lỗi. */
export async function applyFilters<K extends keyof FilterMap>(
  name: K,
  value: Parameters<NonNullable<FilterMap[K]>>[0],
  ctx?: Parameters<NonNullable<FilterMap[K]>>[1],
  site?: Site,
): Promise<Parameters<NonNullable<FilterMap[K]>>[0]>;
export async function applyFilters<T = any>(
  name: string,
  value: T,
  ctx?: any,
  site?: Site,
): Promise<T>;
export async function applyFilters(name: string, value: any, ctx?: any, site?: Site): Promise<any> {
  let v = value;
  for (const d of await getActiveExtensions(site)) {
    const fn = (d.filters as any)?.[name];
    if (!fn) continue;
    try {
      v = await fn(v, ctx);
    } catch (e) {
      console.error(`[cms] filter ${String(name)} lỗi:`, e);
    }
  }
  return v;
}

/** Phát action tới các plugin/theme đang bật. */
export async function doAction(name: string, arg?: any, site?: Site): Promise<void> {
  for (const d of await getActiveExtensions(site)) {
    const raw = (d as any).actions?.[name];
    if (!raw) continue;
    const list = Array.isArray(raw) ? raw : [raw];
    for (const item of list) {
      const fn = typeof item === "function" ? item : item?.handler;
      if (!fn) continue;
      try {
        await fn(arg);
      } catch (e) {
        console.error(`[cms] action ${name} lỗi:`, e);
      }
    }
  }
}

/** Dùng trong file entry của plugin/theme: export default definePlugin({...}). */
export function definePlugin(def: PluginDefinition): PluginDefinition {
  return def;
}
