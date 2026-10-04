"use client"

import {
  isImageFitCover,
  isImageSlide,
  RenderSlideProps,
  SlideImage,
  useLightboxProps,
  useLightboxState,
} from "yet-another-react-lightbox"
import { Imgproxy } from "../ImgproxyImage"
import clsx from "clsx"

export const screenshotWidths = [384, 640, 768, 1024, 1440, 1920, 2560]

function isNextJsImage(slide: SlideImage): boolean {
  return (
    isImageSlide(slide) &&
    typeof slide.width === "number" &&
    typeof slide.height === "number"
  )
}

export default function CarouselNextJsImage({
  slide,
  offset,
  rect,
}: RenderSlideProps<SlideImage>) {
  const {
    on: { click },
    carousel: { imageFit },
  } = useLightboxProps()

  const { currentIndex } = useLightboxState()

  const cover = isImageSlide(slide) && isImageFitCover(slide, imageFit)

  if (!isNextJsImage(slide)) {
    return undefined
  }

  const width = !cover
    ? Math.round(
        Math.min(rect.width, (rect.height / slide.height) * slide.width),
      )
    : rect.width

  return (
    <Imgproxy
      pictureClassName="relative w-full h-full"
      alt={slide.alt ?? ""}
      src={slide.src}
      width={slide.width}
      height={slide.height}
      responsiveWidths={screenshotWidths}
      loading="eager"
      draggable={false}
      fetchPriority={offset === 0 ? "high" : "low"}
      className={clsx(
        "size-full",
        cover && "object-cover",
        !cover && "object-contain",
      )}
      sizes={`${Math.ceil(width)}px`}
      onClick={
        offset === 0 ? () => click?.({ index: currentIndex }) : undefined
      }
    />
  )
}
