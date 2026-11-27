import assert from "node:assert/strict";
import { test } from "node:test";
import { RichTextEditor, hasUi, registerRichTextButton } from "../src/index";

// RichTextEditor / registerRichTextButton là lớp mỏng gọi host; CMS cũ chưa có thì không lỗi và không mất dữ liệu.

const React = { createElement: (type: unknown, props: unknown) => ({ type, props }) };
function withHost(h: Record<string, unknown>, run: () => void) {
  (globalThis as any).__CMS_ADMIN__ = { React, ...h };
  try { run(); } finally { delete (globalThis as any).__CMS_ADMIN__; }
}

test("CMS có RichTextEditor: dùng đúng component của host, giữ nguyên props", () => {
  const Host = () => null;
  withHost({ ui: { RichTextEditor: Host } }, () => {
    assert.equal(hasUi("RichTextEditor"), true);
    const el = (RichTextEditor as any)({ value: "<p>a</p>", onChange() {}, toolbar: "basic" }) as { type: unknown; props: { toolbar: string; value: string } };
    assert.equal(el.type, Host);
    assert.equal(el.props.toolbar, "basic");
    assert.equal(el.props.value, "<p>a</p>");
  });
});

test("CMS cũ: hasUi false; RichTextEditor rơi về ô văn bản thô sửa thẳng HTML", () => {
  const Textarea = () => null;
  const got: string[] = [];
  withHost({ ui: { Textarea } }, () => {
    assert.equal(hasUi("RichTextEditor"), false);
    const outer = (RichTextEditor as any)({ value: "<p>x</p>", onChange: (v: string) => got.push(v), readOnly: false, ariaLabel: "Nội dung" }) as { type: (p: unknown) => { type: unknown; props: any }; props: unknown };
    const el = outer.type(outer.props);   // `ui()` bọc bản dự phòng thành một component: vẽ nó ra mới thấy ô Textarea
    assert.equal(el.type, Textarea);
    assert.equal(el.props.value, "<p>x</p>");
    el.props.onChange({ target: { value: "<p>y</p>" } });
    assert.deepEqual(got, ["<p>y</p>"]);
  });
});

test("registerRichTextButton: chuyển tới host và trả hàm gỡ; CMS cũ trả hàm rỗng", () => {
  const added: unknown[] = [];
  const btn = { id: "sig", title: "Chữ ký", icon: "Ký", run() {} };
  withHost({ ui: {}, registerRichTextButton: (b: unknown) => { added.push(b); return () => added.pop(); } }, () => {
    const off = registerRichTextButton(btn);
    assert.deepEqual(added, [btn]);
    off();
    assert.deepEqual(added, []);
  });
  withHost({ ui: {} }, () => { assert.equal(typeof registerRichTextButton(btn), "function"); registerRichTextButton(btn)(); });
});
