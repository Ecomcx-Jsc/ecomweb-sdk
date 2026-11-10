import { PostContent } from "./content";
import type { TemplateProps } from "./types";

/**
 * Template "full-width": giữ header/footer của theme, vùng bài trải hết chiều ngang màn hình. Như WordPress: chữ vẫn ở cột giữa
 * (--ecx-content-width), chỉ khối đặt độ rộng "Rộng" / "Toàn trang" mới tràn ra.
 */
export default function FullWidth({ data }: TemplateProps) {
  return (
    <div className="ecx-full-width">
      {data.post?.title && <h1 className="entry-title ecx-page-title">{data.post.title}</h1>}
      <PostContent post={data.post} className="entry-content ecx-layout-constrained" />
    </div>
  );
}
