import clsx from "clsx"
import Link from "next/link"
import { DesktopAppstream, pickScreenshotSize } from "src/types/Appstream"

import "swiper/css"
import "swiper/css/navigation"
import LogoImage from "../LogoImage"
import Image from "../Image"
import { register } from "swiper/element/bundle"

// import required modules
import { Autoplay, Navigation } from "swiper/modules"
import { useEffect, useRef } from "react"
import { useTheme } from "next-themes"
import { chooseBrandingColor, getContrastColor } from "src/utils/helpers"

export const HeroBanner = ({
  heroBannerData,
  currentIndex,
  autoplay = true,
}: {
  heroBannerData: {
    app: { position: number; app_id: string; isFullscreen: boolean }
    appstream: DesktopAppstream
  }[]
  currentIndex?: number
  autoplay?: boolean
}) => {
  const swiperRef = useRef(null)
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    register()

    const params = {
      modules: [Navigation, Autoplay],
      slidesPerView: 1,
      centeredSlides: true,
      autoplay: autoplay && {
        delay: 5000,
        disableOnInteraction: true,
      },
      loop: autoplay, // there is a bug that mixes up the indices when looping, so disable this for moderation
      navigation: true,
      className: "h-[288px] xl:h-[352px] shadow-md rounded-xl overflow-hidden",
      injectStyles: [
        `
        .swiper-button-next:hover, .swiper-button-prev:hover {
          background-color: hsla(0, 0%, 100%, 0.2);
        }
        .swiper-button-next {
          padding: 16px 14px 16px 18px;
        }
        .swiper-button-prev {
          padding: 16px 18px 16px 14px;
        }
        .swiper-button-next,
        .swiper-button-prev {
          width: 28px;
          height: 28px;
          border-radius: 100%;
          color: ${
            resolvedTheme === "dark" ? "rgb(222, 221, 218)" : "rgb(36, 31, 49)"
          };
          transition: all 0.2s ease-in-out;
        }
      `,
      ],
    }

    Object.assign(swiperRef.current, params)

    swiperRef.current.initialize()
  })

  if (swiperRef.current && currentIndex !== -1) {
    swiperRef.current.swiper.slideTo(currentIndex)
  }

  return (
    <swiper-container init={false} ref={swiperRef}>
      {heroBannerData.map((data) => {
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
          <swiper-slide
            className="overflow-hidden"
            key={`hero-${data.appstream.id}`}
          >
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
                      iconUrl={data.appstream.icon}
                      appName={data.appstream.name}
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
                    className={clsx(
                      "absolute rounded-lg",
                      data.app.isFullscreen ? "top-20" : "top-10 ",
                    )}
                  />
                </div>
              </div>
            </Link>
          </swiper-slide>
        )
      })}
    </swiper-container>
  )
}
