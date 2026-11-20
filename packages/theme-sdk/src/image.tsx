import type { CSSProperties } from "react";
import type { Media, MediaSize } from "./types";
import { cx } from "./utils";

const ratio = (w?: number | null, h?: number | null) => (w && h ? w / h : 0);

/**
 * Các cỡ ảnh dùng cho srcset: cỡ được chọn + mọi cỡ cùng tỉ lệ (không bị cắt) nhỏ hơn,
 * để trình duyệt tự chọn file vừa đủ cho màn hình.
 */
export function imageCandidates(media: Media, size = "large"): MediaSize[] {
  const chosen = media.sizes[size];
  const full: MediaSize = { url: media.url, width: media.width ?? 0, height: media.height ?? 0, webpUrl: media.webpUrl ?? undefined, avifUrl: media.avifUrl ?? undefined };
  const target = chosen ?? full;
  const r = ratio(target.width, target.height);
  const all = [...Object.values(media.sizes), ...(chosen ? [] : [full])];
  const same = all.filter((s) => s.width <= target.width && Math.abs(ratio(s.width, s.height) - r) < 0.02);
  if (!same.includes(target)) same.push(target);
  return same.filter((s) => s.width > 0).sort((a, b) => a.width - b.width);
}

export interface ImgProps {
  media?: Media | null;
  /** Cỡ lớn nhất cần dùng: thumbnail, medium, medium_large, large, 1536x1536, 2048x2048 hoặc cỡ theme tự khai báo. */
  size?: string;
  /** Thuộc tính sizes của HTML, vd "(max-width: 768px) 100vw, 50vw". Mặc định: rộng tối đa bằng cỡ ảnh. */
  sizes?: string;
  className?: string;
  alt?: string;
  /** Ảnh đầu trang (LCP): tải ngay, ưu tiên cao. */
  priority?: boolean;
  style?: CSSProperties;
}

/**
 * Ảnh responsive: &lt;picture&gt; với AVIF + WebP + ảnh gốc, srcset nhiều cỡ, width/height chống nhảy layout,
 * object-position theo điểm lấy nét chọn trong thư viện media.
 */
export function Img({ media, size = "large", sizes, className, alt, priority, style }: ImgProps) {
  if (!media) return null;
  const list = imageCandidates(media, size);
  const main = list[list.length - 1] ?? { url: media.url, width: media.width ?? 0, height: media.height ?? 0 };
  const srcSet = list.map((s) => `${s.url} ${s.width}w`).join(", ");
  const webp = media.mimeType !== "image/webp" && list.every((s) => s.webpUrl) ? list.map((s) => `${s.webpUrl} ${s.width}w`).join(", ") : null;
  const avif = list.every((s) => s.avifUrl) ? list.map((s) => `${s.avifUrl} ${s.width}w`).join(", ") : null;
  const sz = sizes ?? (main.width ? `(max-width: ${main.width}px) 100vw, ${main.width}px` : undefined);
  const focal: CSSProperties | undefined = media.focalX != null && media.focalY != null
    ? { objectPosition: `${Math.round(media.focalX * 100)}% ${Math.round(media.focalY * 100)}%` } : undefined;
  const img = (
    <img src={main.url} srcSet={list.length > 1 ? srcSet : undefined} sizes={list.length > 1 ? sz : undefined}
      width={main.width || undefined} height={main.height || undefined} alt={alt ?? media.alt ?? ""}
      loading={priority ? "eager" : "lazy"} decoding="async" fetchPriority={priority ? "high" : undefined}
      className={className} style={{ ...focal, ...style }} />
  );
  if (!webp && !avif) return img;
  // AVIF (nhẹ nhất) trước, rồi WebP, cuối cùng ảnh gốc — trình duyệt lấy định dạng đầu tiên nó đọc được
  return <picture className={cx("cms-picture")}>{avif && <source type="image/avif" srcSet={avif} sizes={sz} />}{webp && <source type="image/webp" srcSet={webp} sizes={sz} />}{img}</picture>;
}
