import Button from "../Button"
import {
  HiChevronRight,
  HiChevronLeft,
  HiMagnifyingGlassPlus,
} from "react-icons/hi2"
import {
  DesktopAppstream,
  mapScreenshot,
  pickScreenshot,
} from "../../types/Appstream"

import Lightbox from "yet-another-react-lightbox"
import Inline from "yet-another-react-lightbox/plugins/inline"
import "yet-another-react-lightbox/styles.css"
import Captions from "yet-another-react-lightbox/plugins/captions"
import { useTranslation } from "next-i18next"
import { useEffect, useRef, useState } from "react"
import clsx from "clsx"

export const CarouselStrip = ({
  app,
  isQualityModalOpen,
}: {
  app: DesktopAppstream
  isQualityModalOpen: boolean
}) => {
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
          plugins={[Captions]}
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
            className="absolute bottom-3 end-3 h-12 w-12 !bg-transparent px-3 py-3 text-2xl"
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
        {isQualityModalOpen && filteredScreenshots?.length > 0 && (
          <div className="flex flex-col items-center justify-center pb-6">
            {t("screenshot-sizes")}
            {filteredScreenshots?.map((screenshot, index) => {
              const x = pickScreenshot(screenshot)
              return (
                <div key={x.src} className="flex items-center gap-1">
                  {index === currentIndex && (
                    <div className="text-flathub-dark-gunmetal dark:text-flathub-gainsborow">
                      {<HiChevronRight />}
                    </div>
                  )}
                  {`${x.height}x${x.width}`}
                </div>
              )
            })}
          </div>
        )}
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
