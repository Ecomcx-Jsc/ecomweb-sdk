import { PostContent } from "./content";
import type { TemplateProps } from "./types";

/** Template "canvas": không có header/footer của theme, chỉ nội dung trang (trang dựng bằng khối). */
export default function Canvas({ data }: TemplateProps) {
  // Chữ ở cột giữa, khối "Rộng" / "Toàn trang" tràn ra (như template trống của WordPress)
  return <main className="ecx-canvas"><PostContent post={data.post} className="entry-content ecx-layout-constrained" /></main>;
}

export const layout = false;
