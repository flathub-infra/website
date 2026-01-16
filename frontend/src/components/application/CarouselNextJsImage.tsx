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

  const height = !cover
    ? Math.round(
        Math.min(rect.height, (rect.width / slide.width) * slide.height),
      )
    : rect.height

  return (
    <Imgproxy
      pictureClassName="relative w-full h-full"
      fill
      alt=""
      src={slide.src}
      loading="eager"
      draggable={false}
      fetchPriority={offset === 0 ? "high" : "auto"}
      className={clsx(cover && "object-cover", !cover && "object-contain")}
      sizes={`${Math.ceil((width / window.innerWidth) * 100)}vw`}
      onClick={
        offset === 0 ? () => click?.({ index: currentIndex }) : undefined
      }
    />
  )
}
