import { createElement, type ReactNode } from "react";
import { resolveIcon, type SvgIconNode } from "@ecomcx/ecomweb-content";

const camel = (props: Record<string, string>): Record<string, string> => Object.fromEntries(Object.entries(props).map(([k, v]) => [k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()), v]));
const node = (n: SvgIconNode, key: number): ReactNode => createElement(n.tag, { key, ...camel(n.props) }, ...n.children.map(node));

/**
 * Vẽ icon theo giá trị lưu (tên trong bảng / thư viện, hoặc SVG riêng `svg:…` đã lọc lại ở đây). Không có icon → null.
 * Dùng cho khối Icon, icon của tab… (server và client).
 */
export function iconSvg(value: unknown, o: { size?: number; stroke?: number; className?: string; label?: string; key?: string } = {}): ReactNode {
  const r = resolveIcon(value);
  if (!r) return null;
  const size = o.size ?? 24;
  const a11y = o.label ? { role: "img", "aria-label": o.label } : { "aria-hidden": true as const, focusable: "false" as const };
  if (r.kind === "svg") {
    const root = camel(r.icon.root);
    return <svg key={o.key} className={o.className} width={size} height={size} viewBox={r.icon.viewBox} fill={root.fill ?? "currentColor"} {...(root.stroke ? { stroke: root.stroke } : {})} {...(root.strokeWidth ? { strokeWidth: root.strokeWidth } : {})} {...(root.strokeLinecap ? { strokeLinecap: root.strokeLinecap as "round" } : {})} {...(root.strokeLinejoin ? { strokeLinejoin: root.strokeLinejoin as "round" } : {})} {...a11y}>{r.icon.children.map(node)}</svg>;
  }
  return <svg key={o.key} className={o.className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={o.stroke ?? 2} strokeLinecap="round" strokeLinejoin="round" {...a11y}><path d={r.d} /></svg>;
}
