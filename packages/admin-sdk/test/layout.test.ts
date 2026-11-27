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

// ---- Nền tảng form + phản hồi (Alert, Progress, SearchInput, CheckboxGroup, SkeletonText) ----

test("CMS có Alert / Progress: dùng đúng component của host, giữ nguyên props", async () => {
  const { Alert, Progress, CheckboxGroup } = await import("../src/index");
  const A = () => null, P = () => null;
  withHost({ Alert: A, Progress: P }, () => {
    assert.equal(hasUi("Alert"), true);
    const a = (Alert as any)({ tone: "danger", title: "Lỗi" }) as { type: unknown; props: { tone: string } };
    assert.equal(a.type, A); assert.equal(a.props.tone, "danger");
    const p = (Progress as any)({ value: 40 }) as { type: unknown; props: { value: number } };
    assert.equal(p.type, P); assert.equal(p.props.value, 40);
    assert.equal(typeof CheckboxGroup, "function");
  });
});

test("CMS cũ: Alert báo đúng role, Progress là <progress>, CheckboxGroup tự thêm / bớt giá trị", async () => {
  const { Alert, Progress, CheckboxGroup, SkeletonText } = await import("../src/index");
  const Checkbox = () => null;
  withHost({ Checkbox, Input: () => null }, () => {
    assert.equal(hasUi("Alert"), false);
    assert.equal(render((Alert as any)({ tone: "danger", children: "x" })).props.role, "alert");
    assert.equal(render((Alert as any)({ tone: "info", children: "x" })).props.role, "status");
    const bar = render((Progress as any)({ value: 30, label: "Tải lên" }));
    const progress = (bar.props.children as any[]).find((c) => c?.type === "progress");
    assert.equal(progress.props.value, 30); assert.equal(progress.props["aria-label"], "Tải lên");
    const indet = render((Progress as any)({ indeterminate: true, value: 30 }));
    assert.equal((indet.props.children as any[]).find((c) => c?.type === "progress").props.value, undefined);
    let got: string[] = [];
    const g = render((CheckboxGroup as any)({ value: ["a"], onChange: (v: string[]) => { got = v; }, options: [{ value: "a", label: "A" }, { value: "b", label: "B" }] }));
    const boxes = g.props.children as any[];
    assert.equal(boxes.length, 2); assert.equal(boxes[0].props.checked, true); assert.equal(boxes[1].props.checked, false);
    boxes[1].props.onChange(true); assert.deepEqual(got, ["a", "b"]);
    boxes[0].props.onChange(false); assert.deepEqual(got, []);
    assert.equal((render((SkeletonText as any)({ lines: 4 })).props.children as any[]).length, 4);
  });
});

// ---- UiLabelsProvider và prop `labels` ----

test("CMS có UiLabelsProvider: dùng đúng component của host, giữ nguyên labels", async () => {
  const { UiLabelsProvider } = await import("../src/index");
  const P = () => null;
  withHost({ UiLabelsProvider: P }, () => {
    assert.equal(hasUi("UiLabelsProvider"), true);
    const el = (UiLabelsProvider as any)({ labels: { clear: "Gỡ" }, children: "x" }) as { type: unknown; props: { labels: { clear: string } } };
    assert.equal(el.type, P); assert.equal(el.props.labels.clear, "Gỡ");
  });
});

test("CMS cũ: UiLabelsProvider chỉ hiện nội dung bên trong, không lỗi", async () => {
  const { UiLabelsProvider } = await import("../src/index");
  withHost({}, () => {
    assert.equal(hasUi("UiLabelsProvider"), false);
    const out = render((UiLabelsProvider as any)({ labels: { clear: "Gỡ" }, children: "nội dung" }));
    assert.deepEqual(out.props.children, ["nội dung"]);
  });
});

// ---- useTableState ----

test("useTableState: CMS có hook thì dùng đúng hook của host, truyền nguyên tuỳ chọn", async () => {
  const { useTableState } = await import("../src/index");
  const seen: unknown[] = [];
  const state = { page: 1, query: { page: 1 } };
  withHost({ useTableState: (o: unknown) => { seen.push(o); return state; } }, () => {
    assert.equal(hasUi("useTableState"), true);
    assert.equal(useTableState({ url: "orders", pageSize: 10 }), state as never);
    assert.deepEqual(seen, [{ url: "orders", pageSize: 10 }]);
  });
});

// ---- Hiển thị / tiện ích: Avatar, Breadcrumb, Accordion, Slider… ----

test("CMS có Avatar / Slider: dùng đúng component của host", async () => {
  const { Avatar, Slider } = await import("../src/index");
  const A = () => null, S = () => null;
  withHost({ Avatar: A, Slider: S }, () => {
    assert.equal(hasUi("Avatar"), true);
    assert.equal(((Avatar as any)({ name: "An" }) as { type: unknown }).type, A);
    assert.equal(((Slider as any)({ value: 3, onChange() {} }) as { type: unknown }).type, S);
  });
});

test("CMS cũ: Avatar rơi về chữ cái đầu, Slider là <input type=range>, Breadcrumb đánh dấu trang hiện tại, Accordion là <details>", async () => {
  const { Avatar, Slider, Breadcrumb, Accordion } = await import("../src/index");
  withHost({}, () => {
    assert.equal(hasUi("Avatar"), false);
    const av = render((Avatar as any)({ name: "Nguyễn Văn An" })) as { props: { children: unknown[] } };
    assert.deepEqual(av.props.children, ["NA"]);
    let got = -1;
    const sl = render((Slider as any)({ value: 5, min: 0, max: 10, onChange: (v: number) => { got = v; } })) as { type: string; props: { type: string; onChange(e: unknown): void } };
    assert.equal(sl.type, "input"); assert.equal(sl.props.type, "range"); sl.props.onChange({ target: { value: "7" } }); assert.equal(got, 7);
    const bc = render((Breadcrumb as any)({ items: [{ label: "A", href: "#" }, { label: "B" }] })) as { type: string };
    assert.equal(bc.type, "nav");
    const ac = render((Accordion as any)({ items: [{ value: "a", title: "T", content: "C" }], defaultValue: ["a"] })) as { props: { children: Array<{ type: string; props: { open: boolean } }> } };
    assert.equal(ac.props.children[0].type, "details"); assert.equal(ac.props.children[0].props.open, true);
  });
});
