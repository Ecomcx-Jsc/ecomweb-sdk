import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDocumentMetadata } from "../src/metadata";
import { configureRuntime } from "../src/runtime";
import type { ResolveResult, Site } from "../src/types";

const site = { title: "S", tagline: "", url: "https://example.com", locale: "vi", activePlugins: [] } as unknown as Site;
const data = (extra: Record<string, unknown>) => ({ kind: "category", title: "Cat", basePath: "/category/a", page: 1, ...extra }) as unknown as ResolveResult;

test("canonical của trang phân trang trỏ về chính nó, không dồn về trang 1", async () => {
  configureRuntime({ themes: {}, plugins: {} });
  assert.equal((await buildDocumentMetadata(data({ page: 1 }), site)).canonical, "/category/a");
  assert.equal((await buildDocumentMetadata(data({ page: 2 }), site)).canonical, "/category/a/page/2");
  assert.equal((await buildDocumentMetadata(data({ kind: "home", basePath: "/", page: 3 }), site)).canonical, "/page/3");
});
