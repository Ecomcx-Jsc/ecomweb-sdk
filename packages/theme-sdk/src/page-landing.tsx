import { PostContent } from "./content";
import type { TemplateProps } from "./types";

/** Template "landing": như "full-width" (giữ header/footer, khối "Toàn trang" tràn màn hình) nhưng không in tiêu đề — section đầu (hero) sát header. */
export default function Landing({ data }: TemplateProps) {
  return (
    <div className="ecx-full-width ecx-landing">
      <PostContent post={data.post} className="entry-content ecx-layout-constrained" />
    </div>
  );
}
