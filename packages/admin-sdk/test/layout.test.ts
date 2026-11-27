import assert from "node:assert/strict";
import { test } from "node:test";
import { Grid, Page, Row, SplitView, Stack, Stat, Toolbar, hasUi } from "../src/index";

// Bộ layout là lớp mỏng gọi host; CMS cũ chưa có thì rơi về bản flex / lưới tự chia, không lỗi và không mất nội dung.

const React = { createElement: (type: unknown, props: any, ...kids: unknown[]) => ({ type, props: { ...props, children: kids.length ? kids : props?.children } }) };
const withHost = (ui: Record<string, unknown>, run: () => void) => {
  (globalThis as any).__CMS_ADMIN__ = { React, ui };
  try { run(); } finally { delete (globalThis as any).__CMS_ADMIN__; }
};

// Bọc của SDK trả element của hàm dự phòng; dựng tiếp để xem nội dung thật.
const render = (el: any): any => (typeof el?.type === "function" ? el.type(el.props) : el);

test("CMS có Grid: dùng đúng component của host, giữ nguyên props", () => {
  const Host = () => null;
  withHost({ Grid: Host }, () => {
    assert.equal(hasUi("Grid"), true);
    const el = (Grid as any)({ cols: { base: 1, md: 2 }, gap: 6, children: "x" }) as { type: unknown; props: { cols: unknown; gap: number } };
    assert.equal(el.type, Host);
    assert.deepEqual(el.props.cols, { base: 1, md: 2 });
    assert.equal(el.props.gap, 6);
  });
});

test("CMS cũ: Grid / Stack / Row rơi về style flex hoặc lưới tự chia", () => {
  withHost({}, () => {
    assert.equal(hasUi("Grid"), false);
    const g = render((Grid as any)({ min: 180, gap: 2, children: "x" })) as { type: string; props: { style: Record<string, string> } };
    assert.equal(g.type, "div");
    assert.match(g.props.style.gridTemplateColumns, /minmax\(min\(100%, 180px\), 1fr\)/);
    const s = render((Stack as any)({ gap: 3, children: "x" })) as { props: { style: Record<string, unknown> } };
    assert.equal(s.props.style.flexDirection, "column"); assert.equal(s.props.style.gap, 12);
    const r = render((Row as any)({ justify: "between", children: "x" })) as { props: { style: Record<string, unknown> } };
    assert.equal(r.props.style.flexWrap, "wrap"); assert.equal(r.props.style.justifyContent, "space-between");
  });
});

test("CMS cũ: Page theo width, SplitView và Toolbar vẫn dựng đủ nội dung", () => {
  withHost({ PageHeader: () => null }, () => {
    const narrow = render((Page as any)({ width: "narrow", children: "x" })) as { props: { style: Record<string, unknown> } };
    assert.equal(narrow.props.style.maxWidth, 768);
    const full = render((Page as any)({ width: "full", children: "x" })) as { props: { style: Record<string, unknown> } };
    assert.equal(full.props.style.maxWidth, undefined);
    const sv = render((SplitView as any)({ main: "m", aside: "a", asideWidth: 300 })) as { props: { children: Array<{ props: { style: { flex: string } } }> } };
    assert.equal(sv.props.children.length, 2); assert.match(sv.props.children[1].props.style.flex, /300px/);
    const tb = render((Toolbar as any)({ start: "s", end: "e" })) as { props: { children: unknown[] } };
    assert.equal(tb.props.children.filter(Boolean).length, 2);
    const st = render((Stat as any)({ label: "Đơn", value: 3 })) as { type: string };
    assert.equal(st.type, "div");
  });
});
