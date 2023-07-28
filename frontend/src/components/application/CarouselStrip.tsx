import Button from "../Button"
import {
  HiChevronRight,
  HiChevronLeft,
  HiMagnifyingGlassPlus,
} from "react-icons/hi2"
import { Appstream, mapScreenshot, pickScreenshot } from "../../types/Appstream"

import Lightbox from "yet-another-react-lightbox"
import Inline from "yet-another-react-lightbox/plugins/inline"
import "yet-another-react-lightbox/styles.css"
import Zoom from "yet-another-react-lightbox/plugins/zoom"
import Captions from "yet-another-react-lightbox/plugins/captions"
import { useTranslation } from "react-i18next"
import { useEffect, useRef, useState } from "react"
import clsx from "clsx"

export const CarouselStrip = ({ app }: { app: Appstream }) => {
  const { t } = useTranslation()
  const [showLightbox, setShowLightbox] = useState(false)
  const [currentScreenshot, setCurrentScreenshot] = useState(0)
  const [currentIndex, setCurrentIndex] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    setCurrentScreenshot(0)
  }, [app.id])

  const lightboxState = ref.current?.getLightboxState()
  useEffect(() => {
    setCurrentIndex(lightboxState?.currentIndex)
  }, [lightboxState?.currentIndex])

  if (!app.screenshots) {
    return null
  }

  const filteredScreenshots = app.screenshots?.filter((screenshot) =>
    pickScreenshot(screenshot),
  )

  const slides = app.screenshots?.map(mapScreenshot).map((screenshot) => {
    return {
      ...screenshot,
      title: screenshot.caption,
      alt: screenshot.caption || t("screenshot"),
      caption: undefined,
    }
  })

  return (
    <div className="col-start-1 col-end-4 bg-flathub-gainsborow dark:bg-flathub-arsenic">
      {filteredScreenshots && (
        <Lightbox
          controller={{ closeOnBackdropClick: true }}
          open={showLightbox}
          close={() => setShowLightbox(false)}
          plugins={[Zoom, Captions]}
          slides={slides}
          index={currentScreenshot}
          render={{
            buttonPrev: app.screenshots.length <= 1 ? () => null : undefined,
            buttonNext: app.screenshots.length <= 1 ? () => null : undefined,
          }}
        />
      )}
      <div className="max-w-11/12 relative mx-auto my-0 2xl:max-w-[1400px]">
        {filteredScreenshots && filteredScreenshots?.length > 0 && (
          <Button
            className="absolute bottom-3 right-3 z-10 h-12 w-12 !bg-transparent px-3 py-3 text-2xl"
            onClick={() => setShowLightbox(true)}
            aria-label={t("zoom")}
            variant="secondary"
          >
            <HiMagnifyingGlassPlus />
          </Button>
        )}
        <div className="aspect-video max-h-[500px] w-full">
          <Lightbox
            controller={{ ref }}
            plugins={[Inline]}
            slides={slides}
            index={currentScreenshot}
            styles={{
              button: { filter: "none" },
              container: {
                backgroundColor: "transparent",
                width: "100%",
              },
            }}
            on={{
              click: () => setShowLightbox(true),
              view: (index) => setCurrentScreenshot(index.index),
            }}
            render={{
              iconPrev: () => (
                <div className="control-arrow control-prev text-3xl text-flathub-dark-gunmetal opacity-90 transition hover:opacity-50 dark:text-flathub-gainsborow">
                  <HiChevronLeft />
                </div>
              ),
              iconNext: () => (
                <div className="control-arrow control-prev text-3xl text-flathub-dark-gunmetal opacity-90 transition hover:opacity-50 dark:text-flathub-gainsborow">
                  <HiChevronRight />
                </div>
              ),
              buttonPrev: app.screenshots.length <= 1 ? () => null : undefined,
              buttonNext: app.screenshots.length <= 1 ? () => null : undefined,
            }}
          />
        </div>
        {filteredScreenshots?.length > 1 && (
          <div>
            <ul className="flex list-none justify-center gap-4 pb-8">
              {filteredScreenshots?.map((screenshot, index) => (
                <li
                  key={index}
                  role="button"
                  aria-label={`slide item ${index}`}
                  tabIndex={0}
                  className={clsx(
                    index !== currentIndex && "opacity-50",
                    "h-2 w-2 cursor-pointer rounded-full bg-flathub-dark-gunmetal transition duration-200 dark:bg-flathub-gainsborow",
                    "hover:opacity-100",
                  )}
                  value={index}
                  onClick={() => {
                    if (index > currentScreenshot) {
                      ref.current?.next({ count: index - currentScreenshot })
                    } else {
                      ref.current?.prev({ count: currentScreenshot - index })
                    }
                  }}
                ></li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
