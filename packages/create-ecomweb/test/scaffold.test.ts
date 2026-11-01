import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

// Plugin dạng dự án / có test cần Ecomweb.Plugin.Sdk / .Testing từ NuGet: phiên bản khớp core có API mới, và nuget.config
// (feed cục bộ) phải là XML hợp lệ — khai báo <?xml …?> ở ký tự đầu tiên, nếu không dotnet restore báo lỗi đọc file.
// Chạy đúng CLI người dùng chạy (bin/ecomweb.mjs), không bundle lại mã nguồn.
const CLI = path.join(process.env.SDK_ROOT!, "packages", "create-ecomweb", "bin", "ecomweb.mjs");

test("plugin --project --tests: csproj ghim Ecomweb.Plugin.Sdk/Testing 1.20.0, nuget.config hợp lệ cho backend/ và tests/", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ecw-scaffold-"));
  const feed = fs.mkdtempSync(path.join(os.tmpdir(), "ecw-feed-"));
  try {
    execFileSync("node", [CLI, "plugin", "Thu Nghiem", "--project", "--tests"], { cwd: dir, env: { ...process.env, CMS_NUGET_FEED: feed, NO_COLOR: "1" }, stdio: "pipe" });
    const root = path.join(dir, "thu-nghiem");
    assert.match(fs.readFileSync(path.join(root, "backend", "ThuNghiem.csproj"), "utf8"), /Include="Ecomweb\.Plugin\.Sdk" Version="1\.20\.0"/);
    const tests = fs.readdirSync(path.join(root, "tests")).find((f) => f.endsWith(".csproj"))!;
    assert.match(fs.readFileSync(path.join(root, "tests", tests), "utf8"), /Ecomweb\.Plugin\.Testing" Version="1\.20\.0"/);
    for (const sub of ["backend", "tests"]) {
      const cfg = fs.readFileSync(path.join(root, sub, "nuget.config"), "utf8");
      assert.ok(cfg.startsWith("<?xml"), `${sub}/nuget.config phải bắt đầu bằng <?xml`);
      assert.ok(cfg.includes(`value="${feed}"`), `${sub}/nuget.config có feed cục bộ`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(feed, { recursive: true, force: true });
  }
});
