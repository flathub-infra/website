import clsx from "clsx"
import Link from "next/link"
import { DesktopAppstream, pickScreenshot } from "src/types/Appstream"

import "swiper/css"
import "swiper/css/navigation"
import LogoImage from "../LogoImage"
import Image from "../Image"
import { register } from "swiper/element/bundle"

// import required modules
import { Autoplay, Navigation } from "swiper/modules"
import { useEffect, useRef } from "react"
import { useTheme } from "next-themes"

export const HeroBanner = ({
  appstreams,
  currentIndex,
  autoplay = true,
}: {
  appstreams: DesktopAppstream[]
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
      className:
        "h-[208px] md:h-[288px] xl:h-[352px] shadow-md rounded-xl overflow-hidden",
      injectStyles: [
        `
        .swiper-button-next:hover, .swiper-button-prev:hover {
          background-color: hsla(0, 0%, 100%, 0.2);
        }
        .swiper-button-next,
        .swiper-button-prev {
          width: 32px;
          height: 32px;
          padding: 10px 10px;
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
      {appstreams.map((app) => (
        <swiper-slide className="overflow-hidden" key={`hero-${app.id}`}>
          <Link
            href={`/apps/${app.id}`}
            passHref
            style={{ backgroundImage: `url(${app.icon})` }}
            className={clsx(
              "bg-[length:1px_1px]",
              "flex min-w-0 items-center gap-4 p-4 py-0 duration-500",
              "hover:cursor-pointer hover:saturate-150",
              "active:saturate-200",
              "h-full",
            )}
          >
            <div className="flex justify-center flex-row w-full h-full gap-6 px-16">
              <div className="flex flex-col justify-center items-center lg:w-1/3 h-auto w-full">
                <div className="relative flex h-[64px] w-[64px] sm:h-[96px] sm:w-[96px] flex-shrink-0 flex-wrap items-center justify-center drop-shadow-md lg:h-[128px] lg:w-[128px]">
                  <LogoImage iconUrl={app.icon} appName={app.name} />
                </div>
                <div className="flex pt-4">
                  <span className="truncate whitespace-nowrap text-2xl font-black text-flathub-dark-gunmetal dark:text-flathub-gainsborow">
                    {app.name}
                  </span>
                </div>
                <div className="line-clamp-2 text-sm text-center text-flathub-dark-gunmetal dark:text-flathub-gainsborow lg:line-clamp-3 pb-8">
                  {app.summary}
                </div>
              </div>
              <div className="hidden w-2/3 xl:flex justify-center items-center overflow-hidden relative h-auto">
                <Image
                  src={pickScreenshot(app.screenshots[0])}
                  alt={app.name}
                  className="absolute -bottom-24 rounded-lg"
                />
              </div>
            </div>
          </Link>
        </swiper-slide>
      ))}
    </swiper-container>
  )
}
