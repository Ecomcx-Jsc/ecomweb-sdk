import { ADMIN_SDK, CLI, THEME_SDK, VERSION } from "./npm.mjs";
import fs from "node:fs";
import path from "node:path";
import { c, pascal, slugify, write, findCmsRepo } from "./util.mjs";

export function scaffoldTheme(name, { parent, dir, blocks = false } = {}) {
  const slug = slugify(name);
  const root = path.resolve(dir ?? slug);
  if (fs.existsSync(root) && fs.readdirSync(root).length) throw new Error(`Thư mục ${root} đã tồn tại và không rỗng`);

  write(path.join(root, "theme.json"), JSON.stringify({
    name, slug, version: "1.0.0", author: "", description: `Theme ${name}`,
    ...(parent ? { parent } : {}),
    requires: { cms: blocks ? ">=1.11.0 <2.0.0" : ">=1.8.0 <2.0.0" },
    ...(blocks ? { editing: "blocks" } : {}),
    // Nhãn trong admin: "%khoá%" → locales/{vi,en}.json của theme (CMS ≥ 1.8.0)
    menuLocations: { primary: "%admin.menu.primary%", footer: "%admin.menu.footer%" },
    widgetAreas: { sidebar: "%admin.widgets.sidebar%" },
    supports: ["post-thumbnails", "custom-logo", "comments", "menus", "widgets"],
    settings: [
      { key: "primaryColor", type: "color", label: "%admin.setting.primaryColor%", default: "#0ea5e9", section: "%admin.section.colors%" },
      { key: "footerText", type: "textarea", label: "%admin.setting.footerText%", default: "", section: "%admin.section.footer%" },
    ],
  }, null, 2) + "\n");
  const labels = {
    vi: { "admin.menu.primary": "Menu chính", "admin.menu.footer": "Menu chân trang", "admin.widgets.sidebar": "Sidebar", "admin.setting.primaryColor": "Màu chủ đạo",
      "admin.setting.footerText": "Chữ chân trang", "admin.section.colors": "Màu sắc", "admin.section.footer": "Chân trang" },
    en: { "admin.menu.primary": "Main menu", "admin.menu.footer": "Footer menu", "admin.widgets.sidebar": "Sidebar", "admin.setting.primaryColor": "Accent color",
      "admin.setting.footerText": "Footer text", "admin.section.colors": "Colors", "admin.section.footer": "Footer" },
  };
  for (const [code, dict] of Object.entries(labels)) write(path.join(root, "locales", `${code}.json`), JSON.stringify(dict, null, 2) + "\n");

  write(path.join(root, "package.json"), JSON.stringify({
    name: `ecomweb-theme-${slug}`, private: true, version: "1.0.0",
    description: "Thêm dependencies npm mà theme cần vào đây — Builder sẽ tự cài khi build.",
    dependencies: {},
    devDependencies: {
      [THEME_SDK]: `^${VERSION}`,
      "@types/react": "^19",
      typescript: "5.9.3",
    },
  }, null, 2) + "\n");

  write(path.join(root, "tsconfig.json"), JSON.stringify({
    compilerOptions: { target: "ES2022", module: "esnext", moduleResolution: "bundler", jsx: "react-jsx", strict: true, noEmit: true, skipLibCheck: true },
    include: ["**/*.ts", "**/*.tsx"],
  }, null, 2) + "\n");

  if (blocks && !parent) scaffoldBlockFiles(root);
  else if (!parent) {
    write(path.join(root, "layout.tsx"), `
import "./styles.css";
import type { CSSProperties } from "react";
import { EditableRegion, Menu, setting, type LayoutProps } from "@ecomcx/ecomweb-theme-sdk";

/** Khung chung của mọi trang. Header, footer bọc trong EditableRegion để plugin thay được (vùng chuẩn của core). */
export default function Layout({ site, settings, data, children }: LayoutProps) {
  return (
    <div className="site" style={{ "--primary": setting(settings, "primaryColor", "#0ea5e9") } as CSSProperties}>
      <EditableRegion name="header" data={data}>
        <header className="site-header">
          <a href="/" className="site-title">{site.title}</a>
          <Menu location="primary" className="primary-nav" />
        </header>
      </EditableRegion>
      <main className="site-main">{children}</main>
      <EditableRegion name="footer" data={data}>
        <footer className="site-footer">{setting(settings, "footerText", "") || \`© \${new Date().getFullYear()} \${site.title}\`}</footer>
      </EditableRegion>
    </div>
  );
}
`);
    write(path.join(root, "templates", "index.tsx"), `
import { Pagination, PostContent, type TemplateProps } from "@ecomcx/ecomweb-theme-sdk";

/** Template dự phòng cuối cùng (giống index.php). */
export default function Index({ data }: TemplateProps) {
  if (data.post) {
    return (
      <article>
        <h1>{data.post.title}</h1>
        <PostContent post={data.post} />
      </article>
    );
  }
  return (
    <section>
      <h1>{data.title}</h1>
      {(data.posts ?? []).map((p) => (
        <article key={p.id}>
          <h2><a href={p.link}>{p.title}</a></h2>
          <p>{p.excerpt}</p>
        </article>
      ))}
      <Pagination data={data} />
    </section>
  );
}
`);
    write(path.join(root, "templates", "single.tsx"), `
import { Comments, FeaturedImage, PostContent, PostDate, type TemplateProps } from "@ecomcx/ecomweb-theme-sdk";

/** Một bài viết (giống single.php). Tạo single-{postType}.tsx để riêng cho từng post type. */
export default function Single({ data, site }: TemplateProps) {
  const post = data.post!;
  return (
    <article>
      <h1>{post.title}</h1>
      <p><PostDate post={post} site={site} /></p>
      <FeaturedImage media={post.featuredMedia} />
      <PostContent post={post} />
      <Comments post={post} />
    </article>
  );
}
`);
    write(path.join(root, "templates", "404.tsx"), `
import { SearchForm, type TemplateProps } from "@ecomcx/ecomweb-theme-sdk";

export default function NotFound(_: TemplateProps) {
  return (
    <section>
      <h1>Không tìm thấy trang</h1>
      <SearchForm />
    </section>
  );
}
`);
    write(path.join(root, "styles.css"), `
body { margin: 0; font-family: system-ui, sans-serif; line-height: 1.6; }
a { color: var(--primary); }
.site-header, .site-main, .site-footer { max-width: 960px; margin: 0 auto; padding: 16px; }
.site-header { display: flex; align-items: center; justify-content: space-between; }
.site-title { font-weight: 700; font-size: 1.25rem; color: inherit; text-decoration: none; }
.primary-nav .menu { list-style: none; display: flex; gap: 16px; margin: 0; padding: 0; }
`);
  } else {
    write(path.join(root, "templates", "home.tsx"), `
import type { TemplateProps } from "@ecomcx/ecomweb-theme-sdk";

/** Child theme: chỉ ghi đè template cần thiết, phần còn lại lấy từ theme cha "${parent}". */
export default function Home({ data }: TemplateProps) {
  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: 16 }}>
      <h1>Trang chủ của ${name}</h1>
      <ul>{(data.posts ?? []).map((p) => <li key={p.id}><a href={p.link}>{p.title}</a></li>)}</ul>
    </div>
  );
}
`);
  }

  write(path.join(root, "extend.tsx"), `
import { definePlugin } from "@ecomcx/ecomweb-theme-sdk";

/**
 * Theme có thể đăng ký shortcode, widget, slot, filter.
 * Ví dụ shortcode: gõ [xin-chao ten="Lan"] trong nội dung bài viết.
 */
export default definePlugin({
  shortcodes: {
    "xin-chao": ({ attrs }) => <strong>Xin chào {attrs.ten ?? "bạn"}!</strong>,
  },
});
`);
  write(path.join(root, "README.md"), `# ${name}\n\nTheme cho Ecomweb.\n\n- \`npx ${CLI} validate\` — kiểm tra theme\n- \`npx ${CLI} pack\` — đóng gói thành zip để upload trong Giao diện › Thêm mới\n- \`npx ${CLI} dev --password ...\` — tự đóng gói và cài lên Ecomweb trên máy mỗi khi sửa file\n`);
  return { root, slug };
}

const doc = (...content) => JSON.stringify({ version: 1, blocks: [{ id: "main", type: "richtext", data: { type: "doc", content } }] }, null, 2) + "\n";
const p = (text) => ({ type: "paragraph", content: [{ type: "text", text }] });
const part = (slug, tagName) => ({ type: "templatePart", attrs: { slug, tagName } });
const main = (...content) => ({ type: "group", attrs: { padding: "none" }, content });

/** Theme dựng bằng khối: layout chỉ là khung trơn; header, footer, từng template là JSON khối — sửa trong Giao diện › Trình dựng. */
function scaffoldBlockFiles(root) {
  write(path.join(root, "layout.tsx"), `
import "./styles.css";
import type { CSSProperties } from "react";
import { setting, type LayoutProps } from "@ecomcx/ecomweb-theme-sdk";

/** Khung trơn: header, footer và nội dung từng trang là khối (parts/, templates/), sửa trong Giao diện › Trình dựng. */
export default function Layout({ settings, children }: LayoutProps) {
  return <div className="site" style={{ "--primary": setting(settings, "primaryColor", "#0ea5e9") } as CSSProperties}>{children}</div>;
}
`);
  write(path.join(root, "styles.css"), `
body { margin: 0; font-family: system-ui, sans-serif; line-height: 1.6; }
a { color: var(--primary); }
.ecx-template > * { box-sizing: border-box; max-width: 960px; margin-inline: auto; padding-inline: 16px; }
.ecx-template-part-header { padding-block: 16px; }
.ecx-template-part-footer { margin-top: 48px; padding-block: 24px; }
`);
  write(path.join(root, "parts", "header.json"), doc({ type: "columns", attrs: { verticalAlign: "center" }, content: [
    { type: "column", content: [{ type: "siteTitle" }] },
    { type: "column", content: [{ type: "navigation", attrs: { location: "primary" } }] },
  ] }));
  write(path.join(root, "parts", "footer.json"), doc({ type: "copyright" }));
  write(path.join(root, "templates", "index.json"), doc(part("header", "header"), main(
    { type: "query", attrs: { inherit: true }, content: [
      { type: "postTemplate", content: [{ type: "postTitle", attrs: { level: 2, link: true } }, { type: "postDate" }, { type: "postExcerpt" }] },
      { type: "pagination" },
      { type: "queryEmpty", content: [p("Chưa có bài viết.")] },
    ] }), part("footer", "footer")));
  write(path.join(root, "templates", "single.json"), doc(part("header", "header"), main(
    { type: "postTitle" }, { type: "postDate" }, { type: "featuredImage" }, { type: "postContent" }, { type: "postTerms" }, { type: "comments" }), part("footer", "footer")));
  write(path.join(root, "templates", "page.json"), doc(part("header", "header"), main({ type: "postTitle" }, { type: "postContent" }), part("footer", "footer")));
  write(path.join(root, "templates", "404.json"), doc(part("header", "header"), main(
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Không tìm thấy trang" }] }, { type: "search" }), part("footer", "footer")));
}

/**
 * Plugin một file C# (CMS ≥ 1.7.0 tự biên dịch khi cài — không cần .NET SDK, csproj, NuGet):
 * bảng dữ liệu EF + trang quản trị tự sinh + form trên website ([cms-form]) + hook.
 */
/** Mã C# mặc định của plugin: bảng EF + trang quản trị và form website tự sinh + hook + endpoint. */
function pluginSource(name, slug, cls) {
  return `namespace ${cls};

/// Bảng dữ liệu: CMS tự tạo bảng plg_${slug.replace(/-/g, "_")}__entries khi bật plugin, tự thêm cột khi bạn thêm thuộc tính.
[PluginTable("entries")]
[AdminList("${name}", Icon = "inbox", Columns = "Name,Email,CreatedAt", Search = "Name,Email,Message")]   // trang quản trị tự sinh
[PublicCreate(PerMinute = 5, SuccessMessage = "Cảm ơn bạn!")]                                          // form trên website: [cms-form plugin="${slug}" table="entries"]
public class Entry
{
    public long Id { get; set; }
    [Required, MaxLength(100), Display(Name = "Họ tên")] public string Name { get; set; } = "";
    [Required, EmailAddress, Display(Name = "Email")] public string Email { get; set; } = "";
    [MaxLength(2000), Display(Name = "Lời nhắn")] public string? Message { get; set; }
    [AdminOnly, Display(Name = "Đã xử lý")] public bool Done { get; set; }        // chỉ quản trị viên đặt
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class ${cls}Plugin : CmsPlugin
{
    public override void Register(IPluginContext ctx)
    {
        ctx.Data.Table<Entry>();

        // Có bản ghi mới từ website → ghi log (đổi thành gửi email, gọi API… tuỳ ý)
        ctx.Hooks.On<PluginDataEvent>("${slug}:entries.created", (e, h) =>
        {
            Console.WriteLine($"[${slug}] mới: {e.Item["name"]} <{e.Item["email"]}>");
            return Task.CompletedTask;
        });

        // Endpoint riêng (tuỳ chọn): GET /api/plugins/${slug}/stats
        ctx.Endpoints.Map(r => r.MapGet("/stats", async (IPluginDb db) =>
            Results.Ok(new { total = await db.Set<Entry>().CountAsync(), done = await db.Set<Entry>().CountAsync(x => x.Done) })));
    }
}
`;
}

/** @deprecated Giữ cho lệnh cũ `plugin --simple` — giờ là mặc định của scaffoldPlugin. */
export function scaffoldSimplePlugin(name, { dir, tests = false } = {}) {
  return scaffoldPlugin(name, { dir, tests });
}

/** Dự án test xUnit dùng Ecomweb.Plugin.Testing (namespace Cms.Plugin.Testing) — chạy bằng `create-ecomweb test` (cần .NET SDK). */
function scaffoldTests(root, cls, slug) {
  write(path.join(root, "tests", `${cls}.Tests.csproj`), `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <IsPackable>false</IsPackable>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Ecomweb.Plugin.Testing" Version="1.13.0" />
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.14.1" />
    <PackageReference Include="xunit" Version="2.9.3" />
    <PackageReference Include="xunit.runner.visualstudio" Version="3.1.4" />
  </ItemGroup>
</Project>
`);
  write(path.join(root, "tests", `${cls}Tests.cs`), `using System.Net;
using System.Net.Http.Json;
using Cms.Plugin.Testing;
using Xunit;

/// Chạy: create-ecomweb env up (một lần) rồi create-ecomweb test — gói plugin được cài + bật trên CMS thử.
public class ${cls}Tests : PluginTest
{
    [Fact]
    public async Task Khach_gui_form_duoc_luu()
    {
        var email = $"t{Guid.NewGuid():N}@test.vn";
        var res = await Anonymous.PostAsJsonAsync(Anonymous.Plugin("/data/entries"), new { name = "An", email, message = "Xin chào", done = true });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var row = Assert.Single(await Rows("entries", search: email));
        Assert.False(row["done"]!.GetValue<bool>());   // [AdminOnly]: khách không đặt được
    }

    [Fact]
    public async Task Du_lieu_sai_bi_tu_choi()
    {
        var res = await Anonymous.PostAsJsonAsync(Anonymous.Plugin("/data/entries"), new { name = "", email = "sai" });
        Assert.Equal(HttpStatusCode.UnprocessableEntity, res.StatusCode);
    }

    [Fact]
    public async Task Tac_gia_khong_xem_duoc_du_lieu()
    {
        var author = await As("author");
        Assert.Equal(HttpStatusCode.Forbidden, (await author.GetAsync($"/api/admin/plugin-data/{Slug}/entries")).StatusCode);
    }
}
`);
}

/**
 * Tạo plugin. Mặc định: plugin.json + một file C# (CMS tự biên dịch khi cài — không cần .NET SDK/csproj).
 * backend: "source" (mặc định) | "project" (dự án csproj, khi cần nhiều file + thư viện NuGet) | false.
 * admin / frontend: thêm giao diện React riêng — chỉ khi trang tự sinh ([AdminList], settings) không đủ.
 */
export function scaffoldPlugin(name, { backend = "source", admin = false, frontend = false, tests = false, dir } = {}) {
  const slug = slugify(name);
  const cls = pascal(name) || "MyPlugin";
  const root = path.resolve(dir ?? slug);
  if (fs.existsSync(root) && fs.readdirSync(root).length) throw new Error(`Thư mục ${root} đã tồn tại và không rỗng`);
  if (backend === true) backend = "project";
  if (!backend && !admin && !frontend) throw new Error("Plugin cần ít nhất một phần: bỏ --no-backend hoặc thêm --admin / --frontend");

  const manifest = { name, slug, version: "1.0.0", author: "", description: `Plugin ${name}`, requires: { cms: ">=1.8.0 <2.0.0" } };
  if (backend === "source") manifest.backend = `${cls}.cs`;
  if (backend === "project") manifest.backend = { assembly: `backend/${cls}.dll`, entry: `${cls}.${cls}Plugin` };
  if (admin) {
    manifest.admin = { entry: "admin/index.js" };
    // Trang settings + menu khai báo trong plugin.json — trang admin tự viết ở admin/src đọc/ghi cùng nhóm settings
    manifest.settings = { general: { title: "%menu.title%", fields: [{ key: "greeting", type: "text", label: "%settings.greeting%", default: "Xin chào!" }] } };
    manifest.menus = [{ id: slug, title: "%menu.title%", path: `/${slug}`, icon: "puzzle" }];
  }
  if (frontend) manifest.frontend = { entry: "frontend/index.tsx" };
  write(path.join(root, "plugin.json"), JSON.stringify(manifest, null, 2) + "\n");

  if (admin || backend === "project") {
    // Bản dịch theo khoá (ICU MessageFormat), namespace = slug: admin dùng createT("${slug}"), backend dùng Text.T("${slug}:khoá")
    const messages = {
      vi: { "menu.title": name, "page.description": "Trang quản trị của plugin.", "settings.title": "Cài đặt", "settings.greeting": "Lời chào",
        "settings.saved": "Đã lưu", "settings.save": "Lưu", "metabox.note": "Ghi chú nội bộ", "metabox.title": name },
      en: { "menu.title": name, "page.description": "The plugin's admin page.", "settings.title": "Settings", "settings.greeting": "Greeting",
        "settings.saved": "Saved", "settings.save": "Save", "metabox.note": "Internal note", "metabox.title": name },
    };
    for (const [code, dict] of Object.entries(messages)) write(path.join(root, "locales", `${code}.json`), JSON.stringify(dict, null, 2) + "\n");
  }

  if (backend === "source") write(path.join(root, `${cls}.cs`), pluginSource(name, slug, cls));

  if (backend === "project") {
    const repo = findCmsRepo(root);
    // Nguồn Ecomweb.Plugin.Sdk: nuget.org; thêm feed local khi ở trong repo CMS hoặc khi đặt CMS_NUGET_FEED (thư mục chứa .nupkg)
    const feed = process.env.CMS_NUGET_FEED ? path.resolve(process.env.CMS_NUGET_FEED) : repo ? path.join(repo, "sdk", "nuget") : null;
    write(path.join(root, "backend", `${cls}.csproj`), `
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <RootNamespace>${cls}</RootNamespace>
    <AssemblyName>${cls}</AssemblyName>
    <!-- Plugin được nạp vào CMS: không tự chứa runtime, dùng chung SDK của CMS -->
    <EnableDynamicLoading>true</EnableDynamicLoading>
  </PropertyGroup>
  <ItemGroup>
    <FrameworkReference Include="Microsoft.AspNetCore.App" />
    <PackageReference Include="Ecomweb.Plugin.Sdk" Version="1.13.0">
      <Private>false</Private>
      <ExcludeAssets>runtime</ExcludeAssets>
    </PackageReference>
  </ItemGroup>
  <ItemGroup>
    <!-- using như plugin một file (CMS tự biên dịch) -->
    <Using Include="System.ComponentModel.DataAnnotations" />
    <Using Include="System.Text.Json.Nodes" />
    <Using Include="Microsoft.AspNetCore.Builder" />
    <Using Include="Microsoft.AspNetCore.Http" />
    <Using Include="Microsoft.AspNetCore.Routing" />
    <Using Include="Microsoft.EntityFrameworkCore" />
    <Using Include="Microsoft.Extensions.DependencyInjection" />
    <Using Include="Cms.Plugin.Sdk" />
    <Using Include="Cms.Plugin.Sdk.Contracts" />
    <Using Include="Cms.Plugin.Sdk.Data" />
    <Using Include="Cms.Plugin.Sdk.Hooks" />
    <Using Include="Cms.Plugin.Sdk.Jobs" />
    <Using Include="Cms.Plugin.Sdk.Localization" />
    <Using Include="Cms.Plugin.Sdk.Registry" />
    <Using Include="Cms.Plugin.Sdk.Services" />
  </ItemGroup>
</Project>
`);
    if (feed) write(path.join(root, "backend", "nuget.config"), `
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" />
    <add key="cms-local" value="${feed}" />
  </packageSources>
</configuration>
`);
    write(path.join(root, "backend", `${cls}Plugin.cs`), pluginSource(name, slug, cls));
  }

  if (admin) {
    write(path.join(root, "admin", "src", "index.tsx"), `
import { useState } from "react";
import { Button, Card, Field, Input, PageHeader, api, createT, notify, registerMetaBox, registerPage, useApi } from "@ecomcx/ecomweb-admin-sdk";

/** Dịch theo khoá trong locales/*.json của plugin (namespace "${slug}"). */
const t = createT("${slug}");

/** Trang admin — đường dẫn khớp với ctx.Admin.AddMenu(... "/${slug}" ...) ở backend. */
function SettingsPage() {
  const { data, reload } = useApi<{ greeting: string }>("/admin/settings/plugins/${slug}/general");
  const [greeting, setGreeting] = useState<string | null>(null);
  const value = greeting ?? data?.greeting ?? "";
  return (
    <>
      <PageHeader title={t("menu.title")} description={t("page.description")} />
      <Card title={t("settings.title")}>
        <Field label={t("settings.greeting")}><Input value={value} onChange={(e) => setGreeting(e.target.value)} /></Field>
        <Button variant="primary" onClick={async () => {
          await api.put("/admin/settings/plugins/${slug}/general", { greeting: value });
          notify.success(t("settings.saved"));
          reload();
        }}>{t("settings.save")}</Button>
      </Card>
    </>
  );
}

registerPage({ path: "/${slug}", title: t("menu.title"), component: SettingsPage });

/** Meta box trong trang sửa bài — giá trị lưu vào post.meta khi bấm Lưu. */
registerMetaBox({
  id: "${slug}-note",
  title: t("metabox.title"),
  postTypes: ["post"],
  context: "side",
  component: ({ meta, setMeta }) => (
    <Field label={t("metabox.note")}>
      <Input value={meta["${slug}_note"] ?? ""} onChange={(e) => setMeta("${slug}_note", e.target.value)} />
    </Field>
  ),
});
`);
  }

  if (frontend) {
    write(path.join(root, "frontend", "index.tsx"), `
import { definePlugin } from "@ecomcx/ecomweb-theme-sdk";

/** Phần hiển thị ngoài website: shortcode, widget, slot, filter. */
export default definePlugin({
  shortcodes: {
    // Gõ [${slug}] trong nội dung bài viết
    "${slug}": ({ post }) => <div className="${slug}-box">Xin chào từ plugin ${name}{post ? \` — bài: \${post.title}\` : ""}</div>,
  },
  filters: {
    "document.metadata": (meta) => ({ ...meta, extra: { ...meta.extra, "generator-plugin": "${slug}" } }),
  },
});
`);
  }

  if (admin || frontend) {
    const devDeps = { "@types/react": "^19", typescript: "5.9.3" };
    if (admin) devDeps[ADMIN_SDK] = `^${VERSION}`;
    if (frontend) devDeps[THEME_SDK] = `^${VERSION}`;
    write(path.join(root, "package.json"), JSON.stringify({
      name: `ecomweb-plugin-${slug}`, private: true, version: "1.0.0",
      description: `Dependencies cho giao diện admin/frontend của plugin ${name}`,
      dependencies: {},
      devDependencies: devDeps,
    }, null, 2) + "\n");
    write(path.join(root, "tsconfig.json"), JSON.stringify({
      compilerOptions: { target: "ES2022", module: "esnext", moduleResolution: "bundler", jsx: "react-jsx", strict: true, noEmit: true, skipLibCheck: true },
      include: ["admin/src/**/*", "frontend/**/*"],
    }, null, 2) + "\n");
  }

  const parts = [
    backend === "source" && `- \`${cls}.cs\` — logic C#: bảng dữ liệu (EF), hook, endpoint. CMS tự biên dịch khi cài (không cần .NET SDK)`,
    backend === "project" && "- `backend/` — dự án C# (csproj): build bằng `dotnet build`, CMS nạp DLL",
    admin && "- `admin/src/` — trang quản trị tự viết (@ecomcx/ecomweb-admin-sdk); settings + menu khai báo trong plugin.json",
    frontend && "- `frontend/` — hiển thị ngoài website (@ecomcx/ecomweb-theme-sdk): shortcode, widget, slot",
    (admin || backend === "project") && `- \`locales/\` — bản dịch theo khoá, namespace \`${slug}\``,
  ].filter(Boolean).join("\n");
  write(path.join(root, "README.md"), `# ${name}

${parts}

Lệnh (\`npx ${CLI} <lệnh>\`):

- \`env up\` (một lần) rồi \`dev\` — cài lên CMS thử, sửa file là cài lại
- \`check\` — chạy thử như khi cài / nộp Store: manifest, biên dịch, quét bảo mật
- \`pack\` → \`dist/${slug}-1.0.0.zip\` · \`deploy --activate\` — cài lên CMS thật
${backend === "source" ? `
Trang quản trị: menu **${name}** · Form trên website: \`[cms-form plugin="${slug}" table="entries"]\`
` : ""}`);
  if (tests && backend) scaffoldTests(root, cls, slug);
  return { root, slug };
}
