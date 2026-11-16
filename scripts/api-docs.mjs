#!/usr/bin/env node
// Sinh tài liệu tham chiếu API của @ecomcx/ecomweb-theme-sdk từ mã nguồn (chữ ký + JSDoc) → packages/theme-sdk/API.md.
//   node scripts/api-docs.mjs          → ghi lại API.md
//   node scripts/api-docs.mjs --check  → báo lỗi nếu API.md lệch mã nguồn (CI)
// Tên có @internal không vào tài liệu. Tên có @deprecated được đánh dấu.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const pkgDir = path.join(root, "packages", "theme-sdk");
const ts = createRequire(path.join(root, "package.json"))("typescript");
const ENTRIES = { "@ecomcx/ecomweb-theme-sdk": "src/index.ts", "@ecomcx/ecomweb-theme-sdk/client": "src/client.tsx" };
const out = path.join(pkgDir, "API.md");

const program = ts.createProgram(Object.values(ENTRIES).map((f) => path.join(pkgDir, f)), {
  jsx: ts.JsxEmit.ReactJSX, strict: true, moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext,
  target: ts.ScriptTarget.ES2022, skipLibCheck: true, noEmit: true,
});
const checker = program.getTypeChecker();
const flags = ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope;

const oneLine = (s) => s.replace(/\s+/g, " ").trim();
const tagText = (t) => oneLine(ts.displayPartsToString(t.text ?? []));

function kindOf(name, decl, type) {
  if (ts.isInterfaceDeclaration(decl)) return "type";
  if (ts.isTypeAliasDeclaration(decl)) return "type";
  if (ts.isClassDeclaration(decl)) return "class";
  if (type.getCallSignatures().length) return /^[A-Z]/.test(name) ? "component" : "function";
  return "constant";
}

function describe(exp) {
  const sym = exp.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exp) : exp;
  const decl = sym.declarations?.[0];
  if (!decl) return null;
  const name = exp.getName();
  const tags = sym.getJsDocTags(checker);
  if (tags.some((t) => t.name === "internal")) return null;
  const type = checker.getTypeOfSymbolAtLocation(sym, decl);
  const kind = kindOf(name, decl, type);
  let signatures = [];
  if (kind === "function" || kind === "component") {
    signatures = type.getCallSignatures().map((s) => {
      const dep = ts.getJSDocTags(s.getDeclaration() ?? decl).find((t) => t.tagName.text === "deprecated");
      const depText = dep && oneLine(typeof dep.comment === "string" ? dep.comment : ts.getTextOfJSDocComment(dep.comment) ?? "");
      return { text: `${name}${checker.signatureToString(s, decl, flags)}`, deprecated: !!dep, doc: depText ?? "" };
    });
  } else if (kind === "type") {
    signatures = [{ text: oneLine(decl.getText()).replace(/^export\s+/, "").slice(0, 600) }];
  } else if (kind === "constant") {
    signatures = [{ text: `const ${name}: ${checker.typeToString(type, decl, flags)}` }];
  } else signatures = [{ text: `class ${name}` }];
  return {
    name, kind, signatures,
    doc: oneLine(ts.displayPartsToString(sym.getDocumentationComment(checker))),
    since: tags.find((t) => t.name === "since") && tagText(tags.find((t) => t.name === "since")),
    // Hàm nhiều chữ ký: chỉ "đã cũ" khi mọi chữ ký đều cũ (một chữ ký cũ được đánh dấu ngay trên chữ ký đó)
    deprecated: (signatures.length < 2 || signatures.every((s) => s.deprecated)) && tags.find((t) => t.name === "deprecated")
      ? tagText(tags.find((t) => t.name === "deprecated")) : undefined,
    examples: tags.filter((t) => t.name === "example").map(tagText),
  };
}

const HEAD = { component: "Component", function: "Hàm", constant: "Hằng", class: "Class", type: "Kiểu" };
let md = "# API của @ecomcx/ecomweb-theme-sdk\n\nSinh tự động từ mã nguồn (`node scripts/api-docs.mjs`), không sửa tay. Hướng dẫn: `docs/theme-guide.md` của core.\n";
const seen = new Set();
for (const [entry, file] of Object.entries(ENTRIES)) {
  const sf = program.getSourceFile(path.join(pkgDir, file));
  const items = checker.getExportsOfModule(checker.getSymbolAtLocation(sf)).map(describe).filter(Boolean)
    .filter((x) => !seen.has(`${x.kind}:${x.name}`) || entry === Object.keys(ENTRIES)[0])
    .sort((a, b) => a.name.localeCompare(b.name));
  md += `\n## \`${entry}\`\n`;
  if (entry.endsWith("/client")) md += "\nDùng trong file `\"use client\"`. Tên đã có ở entry chính (component client dùng được từ Server Component) không lặp lại ở đây.\n";
  for (const kind of ["component", "function", "class", "constant", "type"]) {
    const list = items.filter((x) => x.kind === kind && !(entry.endsWith("/client") && seen.has(`${x.kind}:${x.name}`)));
    if (!list.length) continue;
    md += `\n### ${HEAD[kind]}\n`;
    for (const x of list) {
      md += `\n#### \`${x.name}\`${x.deprecated ? " (đã cũ)" : ""}${x.since ? ` · từ ${x.since}` : ""}\n\n`;
      if (x.deprecated) md += `> Đã cũ: ${x.deprecated}\n\n`;
      if (x.doc) md += `${x.doc}\n\n`;
      md += "```ts\n" + x.signatures.map((s) => (s.deprecated ? "/** @deprecated */ " : "") + s.text).join("\n") + "\n```\n";
      for (const sig of x.signatures.filter((s) => s.deprecated && !x.deprecated && s.doc)) md += `\n> Chữ ký cũ: ${sig.doc}\n`;
      for (const e of x.examples) md += "\n```tsx\n" + e + "\n```\n";
    }
  }
  for (const x of items) seen.add(`${x.kind}:${x.name}`);
}

if (process.argv.includes("--check")) {
  const cur = existsSync(out) ? readFileSync(out, "utf8") : "";
  if (cur !== md) { console.error("packages/theme-sdk/API.md lệch mã nguồn — chạy: node scripts/api-docs.mjs"); process.exit(1); }
  console.log("API.md khớp mã nguồn");
} else {
  writeFileSync(out, md);
  console.log(`Đã ghi ${path.relative(root, out)} (${md.split("\n").length} dòng)`);
}
