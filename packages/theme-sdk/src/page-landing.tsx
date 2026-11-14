import { blockThemeParts, PostContent } from "./content";
import type { TemplateProps } from "./types";

/** Template "landing": như "full-width" (giữ header/footer, khối "Toàn trang" tràn màn hình) nhưng không in tiêu đề — section đầu (hero) sát header. */
export default async function Landing({ data, site }: TemplateProps) {
  const [header, footer] = await blockThemeParts(site, data);
  return (
    <>
      {header}
      <div className="ecx-full-width ecx-landing">
        <PostContent post={data.post} className="entry-content ecx-layout-constrained" />
      </div>
      {footer}
    </>
  );
}
