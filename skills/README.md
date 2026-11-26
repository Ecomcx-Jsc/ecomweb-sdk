# Skill cho agent

Mỗi thư mục là một skill: `SKILL.md` là hướng dẫn chính, `reference/` là tài liệu đọc khi cần, `scripts/` là công cụ chạy được.

| Skill | Dùng khi |
|---|---|
| [ecomweb-theme-port](ecomweb-theme-port/SKILL.md) | Chuyển một website (WordPress, HTML, HTTrack, React/Next, Shopify, Webflow…) thành theme Ecomweb giống bản gốc |

## Cài cho agent

- **Claude Code:** chép (hoặc symlink) thư mục skill vào `~/.claude/skills/` (mọi dự án) hoặc `<dự án>/.claude/skills/` (một dự án).
  ```bash
  ln -s "$(pwd)/ecomweb-theme-port" ~/.claude/skills/ecomweb-theme-port
  ```
- **Agent khác (Cursor, Codex, DeepSeek, Gemini CLI…):** thêm vào `AGENTS.md` (hoặc file luật của agent) của dự án:
  ```
  Khi được yêu cầu chuyển/clone một website thành theme Ecomweb: đọc và làm theo <đường dẫn>/ecomweb-theme-port/SKILL.md từ đầu tới cuối.
  ```
- Lần đầu: `cd ecomweb-theme-port/scripts && npm install && npm run setup && npm test`. Cần Node 20+.

Người dùng chỉ cần một câu, ví dụ: `chuyển https://demo.site.com thành theme "my-shop"`.
