# Skill cho agent

Mỗi thư mục là một skill: `SKILL.md` là hướng dẫn chính, `reference/` là tài liệu đọc khi cần, `scripts/` là công cụ chạy được.

| Skill | Dùng khi |
|---|---|
| [ecomweb-theme-port](ecomweb-theme-port/SKILL.md) | Chuyển một website (WordPress, HTML, HTTrack, React/Next, Shopify, Webflow…) thành theme Ecomweb giống bản gốc cả hình lẫn chuyển động; đề xuất plugin trên Store và hỏi trước khi cài hoặc viết plugin mới. Có chế độ sửa theme đã chuyển còn lệch. |

## Cài cho agent

- **Claude Code:** chép (hoặc symlink) thư mục skill vào `~/.claude/skills/` (mọi dự án) hoặc `<dự án>/.claude/skills/` (một dự án).
  ```bash
  ln -s "$(pwd)/ecomweb-theme-port" ~/.claude/skills/ecomweb-theme-port
  ```
- **Hermes Agent:** chép vào `~/.hermes/skills/software-development/` (Hermes đọc `SKILL.md` + frontmatter `metadata.hermes`):
  ```bash
  rsync -a --delete --exclude node_modules ecomweb-theme-port/ ~/.hermes/skills/software-development/ecomweb-theme-port/
  ```
  Chạy lại lệnh này mỗi khi skill trong repo được cập nhật.
- **Agent khác (Cursor, Codex, DeepSeek, Gemini CLI…):** thêm vào `AGENTS.md` (hoặc file luật của agent) của dự án:
  ```
  Khi được yêu cầu chuyển/clone một website thành theme Ecomweb: đọc và làm theo <đường dẫn>/ecomweb-theme-port/SKILL.md từ đầu tới cuối.
  ```
- Lần đầu: `cd ecomweb-theme-port/scripts && npm install && npm run setup && npm test` (4 dòng ĐẠT). Cần Node 20+.

Người dùng chỉ cần một câu, ví dụ:
- `chuyển https://demo.site.com thành theme "my-shop"`
- `làm lại theme ~/themes/my-shop cho giống https://demo.site.com`

## Thành phần

| Thư mục | Nội dung |
|---|---|
| `SKILL.md` | Quy trình 12 pha, 2 cửa dừng (hỏi plugin; so hình + chuyển động phải ĐẠT), luật LUÔN/KHÔNG, bảng lỗi hay gặp, chế độ sửa |
| `reference/` | `cms.md` (CMS, body class, SDK, ACF, bán hàng), `kit.md`, `sources.md` (theo loại nguồn), `jsx.md`, `plugins.md` (hỏi người dùng, mẫu đặc tả plugin) |
| `kit/` | Component chép vào theme: `Carousel` (Owl/Slick, đã so khớp với Owl 2.3.4 thật), `RunningLine`, `Reveal`, `ScrollClass`, `Toggle`, `CountUp` |
| `scripts/` | `snapshot`, `motion`, `html2jsx`, `css-port`, `features` (+ `feature-map.json`), `audit`, `compare`, `httrack-map`, `serve`, kèm test |
