import {
  ChevronRightIcon,
  ChevronLeftIcon,
  ArrowsPointingOutIcon,
} from "@heroicons/react/24/solid"
import { mapScreenshot } from "../../types/Appstream"

import Lightbox from "yet-another-react-lightbox"
import Zoom from "yet-another-react-lightbox/plugins/zoom"
import Inline from "yet-another-react-lightbox/plugins/inline"
import "yet-another-react-lightbox/styles.css"
import Captions from "yet-another-react-lightbox/plugins/captions"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import clsx from "clsx"
import CarouselNextJsImage from "./CarouselNextJsImage"
import { CarouselJsonLd } from "next-seo"
import { DesktopAppstream } from "src/codegen"

export const CarouselStrip = ({
  app,
}: {
  app: Pick<DesktopAppstream, "screenshots">
}) => {
  const t = useTranslations()
  const [showLightbox, setShowLightbox] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    setCurrentIndex(0)
  }, [])

  useEffect(() => {
    setCurrentIndex(ref.current?.getLightboxState()?.currentIndex)
  }, [])

  const slides = app.screenshots?.map(mapScreenshot).map((screenshot) => {
    return {
      ...screenshot,
      title: screenshot.caption,
      alt: screenshot.caption || t("lightbox.screenshot"),
      caption: undefined,
    }
  })

  return (
    <div className="col-start-1 col-end-4 bg-flathub-gainsborow dark:bg-flathub-arsenic">
      {slides && (
        <>
          <CarouselJsonLd
            useAppDir={true}
            ofType="default"
            data={slides.map((slide) => {
              return { url: slide.src }
            })}
          />
          <Lightbox
            controller={{ closeOnBackdropClick: true }}
            open={showLightbox}
            close={() => setShowLightbox(false)}
            plugins={[Captions, Zoom]}
            slides={slides}
            index={currentIndex}
            render={{
              buttonPrev: app.screenshots.length <= 1 ? () => null : undefined,
              buttonNext: app.screenshots.length <= 1 ? () => null : undefined,
              slide: CarouselNextJsImage,
            }}
            labels={{
              Previous: t("lightbox.previous"),
              Next: t("lightbox.next"),
              Close: t("lightbox.close"),
              "Zoom in": t("lightbox.zoom-in"),
              "Zoom out": t("lightbox.zoom-out"),
            }}
          />
        </>
      )}
      <div className="relative">
        <div className="my-0 mx-auto 2xl:max-w-[1400px]">
          {slides && slides?.length > 0 && (
            <button
              className="absolute bottom-3 end-3 size-12 bg-transparent! px-3 py-3 text-2xl z-10"
              onClick={() => setShowLightbox(true)}
              aria-label={t("lightbox.show-screenshot-fullscreen")}
              title={t("lightbox.show-screenshot-fullscreen")}
            >
              <ArrowsPointingOutIcon />
            </button>
          )}
          <div className="aspect-video max-h-[500px] w-full">
            <Lightbox
              controller={{ ref }}
              plugins={[Inline]}
              slides={slides}
              index={slides?.length > currentIndex ? currentIndex : 0}
              carousel={{
                finite: slides?.length === 1,
              }}
              styles={{
                button: { filter: "none" },
                container: {
                  backgroundColor: "transparent",
                  width: "100%",
                  maxHeight: "500px",
                },
              }}
              on={{
                click: () => setShowLightbox(true),
                view: ({ index }) => {
                  if (!showLightbox) {
                    setCurrentIndex(index)
                  }
                },
              }}
              render={{
                iconPrev: () => (
                  <div className="control-arrow control-prev text-3xl text-flathub-dark-gunmetal opacity-90 transition hover:opacity-50 dark:text-flathub-gainsborow">
                    <ChevronLeftIcon className="size-7.5" />
                  </div>
                ),
                iconNext: () => (
                  <div className="control-arrow control-prev text-3xl text-flathub-dark-gunmetal opacity-90 transition hover:opacity-50 dark:text-flathub-gainsborow">
                    <ChevronRightIcon className="size-7.5" />
                  </div>
                ),
                buttonPrev:
                  app.screenshots.length <= 1 ? () => null : undefined,
                buttonNext:
                  app.screenshots.length <= 1 ? () => null : undefined,
                slide: CarouselNextJsImage,
              }}
              labels={{
                Previous: t("lightbox.previous"),
                Next: t("lightbox.next"),
              }}
            />
          </div>
        </div>
        {slides?.length > 0 && slides[currentIndex]?.title && (
          <div className="flex justify-center text-center pb-4">
            {slides[currentIndex]?.title}
          </div>
        )}
        {slides?.length > 1 && (
          <div>
            <ul className="flex flex-wrap list-none justify-center gap-4 pb-8 px-16">
              {slides?.map((screenshot, index) => (
                <li key={index} value={index}>
                  <button
                    className={clsx(
                      index !== currentIndex && "opacity-50",
                      "size-2 cursor-pointer rounded-full bg-flathub-dark-gunmetal transition duration-200 dark:bg-flathub-gainsborow",
                      "hover:opacity-100",
                    )}
                    aria-label={
                      screenshot.caption ??
                      t("lightbox.screenshot") + " " + index
                    }
                    onClick={() => {
                      if (index > currentIndex) {
                        ref.current?.next({ count: index - currentIndex })
                      } else {
                        ref.current?.prev({ count: currentIndex - index })
                      }
                    }}
                  ></button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
