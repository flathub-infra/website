import { StaticImageData } from "next/image"
import {
  generateImageUrl,
  type IGenerateImageUrl,
} from "@imgproxy/imgproxy-node"
import { cn } from "@/lib/utils"
import { ConditionalWrapper } from "@/lib/helpers"

type Options = NonNullable<IGenerateImageUrl["options"]>
type Format = Options["format"]

type ImgproxyProps = {
  className?: string
  src: string | StaticImageData
  alt?: string
  fill?: boolean
  loading?: "eager" | "lazy"
  fetchPriority?: "high" | "low" | "auto"
  sizes?: string
  onClick?: () => void
  draggable?: boolean
  pictureClassName?: string
} & Omit<Options, "resize" | "size" | "resize_type" | "dpr" | "format">

const imgproxyEndpoint = "https://imgproxy.flathub.org/"

export const Imgproxy = ({
  className,
  src,
  alt,
  width,
  height,
  fill = false,
  loading = "lazy",
  fetchPriority = "auto",
  sizes,
  onClick,
  draggable = true,
  pictureClassName,
  ...imgproxyOptions
}: ImgproxyProps) => {
  const resolvedSrc = typeof src === "string" ? src : src.src

  const imgproxyUrl = (format: Format, dpr: number) => {
    try {
      const url = generateImageUrl({
        endpoint: imgproxyEndpoint,
        url: resolvedSrc,
        options: {
          resize: {
            width,
            height,
            resizing_type: fill ? "fill-down" : "fit",
          },
          format,
          dpr,
          ...imgproxyOptions,
        },
      })

      return url
    } catch (error) {
      console.error("Failed to generate imgproxy URL:", error, resolvedSrc)
      return resolvedSrc
    }
  }

  const srcSet = (format?: Format) =>
    [`${imgproxyUrl(format, 1)} 1x`, `${imgproxyUrl(format, 2)} 2x`].join(", ")

  const imgClassName = cn(
    fill ? "object-cover size-full" : "object-contain",
    className,
  )

  return (
    <ConditionalWrapper
      condition={onClick}
      wrapper={(children) => (
        <button
          type="button"
          onClick={onClick}
          className="w-full h-full border-0 bg-transparent p-0 cursor-pointer"
        >
          {children}
        </button>
      )}
    >
      <picture className={pictureClassName}>
        <source srcSet={srcSet("avif")} type="image/avif" />
        <source srcSet={srcSet("webp")} type="image/webp" />
        <img
          src={imgproxyUrl("webp", 1)}
          alt={alt}
          className={imgClassName}
          width={fill ? undefined : width}
          height={fill ? undefined : height}
          loading={loading}
          decoding="async"
          fetchPriority={fetchPriority}
          sizes={sizes}
          draggable={draggable}
        />
      </picture>
    </ConditionalWrapper>
  )
}
