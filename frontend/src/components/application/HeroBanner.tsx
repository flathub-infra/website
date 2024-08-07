import {
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel"
import clsx from "clsx"
import Link from "next/link"
import { DesktopAppstream, pickScreenshotSize } from "src/types/Appstream"

import LogoImage from "../LogoImage"
import Image from "next/image"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { chooseBrandingColor, getContrastColor } from "@/lib/helpers"
import { Carousel } from "@/components/ui/carousel"
import Autoplay from "embla-carousel-autoplay"
import { i18n } from "next-i18next"

export const HeroBanner = ({
  heroBannerData,
  currentIndex,
  autoplay = true,
  aboveTheFold = false,
}: {
  heroBannerData: {
    app: { position: number; app_id: string; isFullscreen: boolean }
    appstream: DesktopAppstream
  }[]
  currentIndex?: number
  autoplay?: boolean
  aboveTheFold?: boolean
}) => {
  const { resolvedTheme } = useTheme()

  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (!api) {
      return
    }

    const autoPlay = api.plugins()?.autoplay
    if (!autoPlay) {
      return
    }

    if (current && currentIndex !== -1) {
      api.scrollTo(currentIndex)
    }
    setCurrent(api.selectedScrollSnap() + 1)

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap() + 1)
      autoPlay.reset()
    })
    api.on("pointerDown", () => {
      autoPlay.stop()
    })
    api.on("pointerUp", () => {
      autoPlay.play()
    })
  }, [api, currentIndex])

  return (
    <Carousel
      opts={{
        loop: true,
        direction: i18n.dir(),
      }}
      plugins={[
        Autoplay({
          delay: 5000,
          active: autoplay,
        }),
      ]}
      className="overflow-hidden shadow-md rounded-xl"
      setApi={setApi}
    >
      <CarouselContent className="h-[288px] xl:h-[352px] ml-0">
        {heroBannerData.map((data, i) => {
          const brandingColor = chooseBrandingColor(
            data.appstream?.branding,
            resolvedTheme as "light" | "dark",
          )

          const textColor = brandingColor
            ? getContrastColor(brandingColor.value) === "black"
              ? "text-flathub-dark-gunmetal"
              : "text-flathub-lotion"
            : "text-flathub-dark-gunmetal dark:text-flathub-lotion"

          return (
            <CarouselItem className="basis-full pl-0" key={data.appstream.id}>
              <Link
                href={`/apps/${data.appstream.id}`}
                passHref
                style={{
                  backgroundColor: brandingColor && brandingColor.value,
                }}
                className={clsx(
                  "flex min-w-0 items-center gap-4 p-4 py-0 duration-500",
                  "hover:cursor-grab",
                  "h-full",
                )}
              >
                <div className="flex justify-center flex-row w-full h-full gap-6 px-16">
                  <div className="flex flex-col justify-center items-center lg:w-1/3 h-auto w-full">
                    <div className="relative flex flex-shrink-0 flex-wrap items-center justify-center drop-shadow-md lg:h-[128px] lg:w-[128px]">
                      <LogoImage
                        priority={aboveTheFold && i === 0}
                        iconUrl={data.appstream.icon}
                        appName={data.appstream.name}
                        loading="eager"
                        quality={100}
                      />
                    </div>
                    <div className="flex pt-3">
                      <span
                        className={clsx(
                          "truncate whitespace-nowrap text-2xl font-black",
                          textColor,
                        )}
                      >
                        {data.appstream.name}
                      </span>
                    </div>
                    <div
                      className={clsx(
                        "line-clamp-2 text-sm text-center",
                        textColor,
                        "lg:line-clamp-3",
                      )}
                    >
                      {data.appstream.summary}
                    </div>
                  </div>
                  <div className="hidden w-2/3 xl:flex justify-center items-center overflow-hidden relative h-auto">
                    <Image
                      src={pickScreenshotSize(data.appstream.screenshots[0])}
                      alt={data.appstream.name}
                      priority={aboveTheFold && i === 0}
                      loading="eager"
                      className={clsx(
                        "absolute rounded-lg",
                        data.app.isFullscreen ? "top-20" : "top-10 ",
                      )}
                    />
                  </div>
                </div>
              </Link>
            </CarouselItem>
          )
        })}
      </CarouselContent>
      <CarouselPrevious
        className={clsx(
          "text-flathub-black dark:text-flathub-white",
          "hover:text-flathub-black hover:dark:text-flathub-white",
          "hover:bg-flathub-black/10 dark:hover:bg-flathub-white/10",
          "absolute left-4 top-1/2 size-11",
        )}
        variant="ghost"
      />
      <CarouselNext
        className={clsx(
          "text-flathub-black dark:text-flathub-white",
          "hover:text-flathub-black hover:dark:text-flathub-white",
          "hover:bg-flathub-black/10 dark:hover:bg-flathub-white/10",
          "absolute right-4 top-1/2 size-11",
        )}
        variant="ghost"
      />
    </Carousel>
  )
}
