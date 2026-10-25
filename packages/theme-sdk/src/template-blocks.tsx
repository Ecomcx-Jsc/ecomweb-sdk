import { getTemplates } from "./api";
import { contentContext } from "./content";
import { renderContent } from "./rich";
import type { TemplateProps } from "./types";

/** Template dựng bằng khối (theme `"editing": "blocks"`): bản sửa trong Trình dựng, không có thì `templates/{tên}.json` của theme. */
export default async function BlockTemplate({ data, site, template }: TemplateProps) {
  const doc = (await getTemplates()).templates[template];
  if (!doc) return null;
  return <div className={`ecx-template ecx-template-${template} ecx-content`}>{await renderContent(doc, { ...(await contentContext(site, data.post, data)), source: `template:${template}` })}</div>;
}
