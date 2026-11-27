import assert from "node:assert/strict";
import { test } from "node:test";
import { formatBytes, kvFromRecord, kvToRecord, matchHotkey, normalizeColor, useDebouncedValue, useDisclosure, validateFiles } from "../src/index";

// ---- hàm thuần ----
test("normalizeColor: #abc → #aabbcc, chữ thường, giữ alpha, mã sai → null", () => {
  assert.equal(normalizeColor("#ABC"), "#aabbcc"); assert.equal(normalizeColor("e53935"), "#e53935"); assert.equal(normalizeColor("#E53935CC"), "#e53935cc");
  for (const bad of ["", "zzzzzz", "#12", "#1234567", null, undefined, "red"]) assert.equal(normalizeColor(bad as string), null);
});

test("kvToRecord / kvFromRecord: bỏ dòng khoá trống, cắt khoảng trắng, đi và về giữ nguyên", () => {
  assert.deepEqual(kvToRecord([{ key: " A ", value: "1" }, { key: "", value: "x" }, { key: "B", value: "" }]), { A: "1", B: "" });
  assert.deepEqual(kvFromRecord({ A: "1", B: "2" }), [{ key: "A", value: "1" }, { key: "B", value: "2" }]);
  assert.deepEqual(kvFromRecord(null), []);
});

const f = (name: string, size: number, type: string) => Object.defineProperty(new File(["x"], name, { type }), "size", { value: size });
test("validateFiles: loại (mime, dải image/*, đuôi), dung lượng, số lượng — kèm lý do", () => {
  const r = validateFiles([f("a.png", 100, "image/png"), f("b.pdf", 100, "application/pdf"), f("c.txt", 100, "text/plain"), f("d.png", 5000, "image/png"), f("e.png", 100, "image/png"), f("g.png", 100, "image/png")],
    { accept: "image/*,.pdf", maxSize: 1000, maxFiles: 3, current: 0 });
  assert.deepEqual(r.accepted.map((x) => x.name), ["a.png", "b.pdf", "e.png"]);
  assert.deepEqual(r.rejected.map((x) => `${x.file.name}:${x.reason}`), ["c.txt:type", "d.png:size", "g.png:count"]);
  assert.equal(validateFiles([f("a.png", 1, "image/png")], { maxFiles: 1, current: 1 }).rejected[0].reason, "count");   // đã có sẵn 1 tệp
});

test("formatBytes", () => { assert.equal(formatBytes(512), "512 B"); assert.match(formatBytes(2048), /^2 KB$/); assert.match(formatBytes(1536), /^1[.,]5 KB$/); assert.match(formatBytes(5 * 1024 * 1024), /^5 MB$/); });

test("matchHotkey: mod+k (Ctrl khi không phải macOS), esc, alt+s, '?' cần Shift, chữ + Shift là tổ hợp khác", () => {
  const ev = (o: Partial<Record<"key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey", unknown>>) => ({ key: "", ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...o }) as never;
  assert.equal(matchHotkey("mod+k", ev({ key: "k", ctrlKey: true })), true);
  assert.equal(matchHotkey("mod+k", ev({ key: "k" })), false);
  assert.equal(matchHotkey("esc", ev({ key: "Escape" })), true);
  assert.equal(matchHotkey("alt+s", ev({ key: "s", altKey: true })), true);
  assert.equal(matchHotkey("alt+s", ev({ key: "s", altKey: true, ctrlKey: true })), false);  // Ctrl thừa → tổ hợp khác
  assert.equal(matchHotkey("k", ev({ key: "k", ctrlKey: true })), false);                    // phím trơn không khớp khi có Ctrl
  assert.equal(matchHotkey("?", ev({ key: "?", shiftKey: true })), true);
  assert.equal(matchHotkey("k", ev({ key: "K", shiftKey: true })), false);
  assert.equal(matchHotkey("shift+k", ev({ key: "K", shiftKey: true })), true);
});

// ---- hook: runtime tối giản (không có DOM) ----
function makeReact() {
  const slots: any[] = []; let i = 0, rerender: () => void = () => {}; const effects: Array<{ fn: () => void | (() => void); deps?: unknown[]; cleanup?: void | (() => void) }> = [];
  const R: any = {
    useState(init: any) { const k = i++; if (!(k in slots)) slots[k] = typeof init === "function" ? init() : init; return [slots[k], (v: any) => { slots[k] = typeof v === "function" ? v(slots[k]) : v; rerender(); }]; },
    useRef(init: any) { const k = i++; if (!(k in slots)) slots[k] = { current: init }; return slots[k]; },
    useCallback(fn: any) { return fn; }, useMemo(fn: any) { return fn(); },
    useEffect(fn: any, deps?: unknown[]) { const k = i++; const prev = slots[k]; const changed = !prev || !deps || deps.some((d, j) => d !== prev.deps?.[j]); if (changed) { slots[k] = { deps }; effects.push({ fn, deps, cleanup: undefined }); effects[effects.length - 1].cleanup = undefined; (effects[effects.length - 1] as any).slot = k; } },
  };
  return {
    R, render<T>(hook: () => T) {
      let out!: T; const run = () => { i = 0; effects.length = 0; out = hook(); for (const e of effects) { const prev = slots[(e as any).slot]; prev.cleanup?.(); prev.cleanup = e.fn(); } };
      rerender = run; run(); return { get current() { return out; } };
    },
  };
}
const withReact = (fn: (mk: ReturnType<typeof makeReact>) => void | Promise<void>) => async () => { const mk = makeReact(); (globalThis as any).__CMS_ADMIN__ = { React: mk.R }; try { await fn(mk); } finally { delete (globalThis as any).__CMS_ADMIN__; } };

test("useDisclosure: mở / đóng / đảo / đặt", withReact((mk) => {
  const r = mk.render(() => useDisclosure());
  assert.equal(r.current.open, false); r.current.onOpen(); assert.equal(r.current.open, true); r.current.toggle(); assert.equal(r.current.open, false);
  r.current.set(true); r.current.onClose(); assert.equal(r.current.open, false);
}));
test("useDisclosure: giá trị khởi tạo true", withReact((mk) => { assert.equal(mk.render(() => useDisclosure(true)).current.open, true); }));

test("useDebouncedValue: giá trị chỉ đổi sau khoảng chờ, lần đổi cuối thắng", withReact(async (mk) => {
  let value = "a";
  const r = mk.render(() => useDebouncedValue(value, 20));
  assert.equal(r.current, "a");
  value = "ab"; mk.render(() => useDebouncedValue(value, 20)); value = "abc";
  const r2 = mk.render(() => useDebouncedValue(value, 20));
  assert.equal(r2.current, "a");                                                    // chưa hết thời gian chờ
  await new Promise((res) => setTimeout(res, 60));
  assert.equal(r2.current, "abc");
}));

test("Đợt 3 lô 3: biểu đồ, bảng lệnh, lịch, vùng cuộn, khung chia được xuất ra và có bản dự phòng", async () => {
  const m = await import("../src/index");
  for (const n of ["BarChart", "LineChart", "DonutChart", "Sparkline", "CommandPalette", "Calendar", "ScrollArea", "ResizablePanels"]) assert.equal(typeof (m as Record<string, unknown>)[n], "function", n);
});
