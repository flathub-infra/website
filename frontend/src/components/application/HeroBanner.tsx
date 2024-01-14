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
            className={clsx(
              "bg-flathub-white dark:bg-flathub-arsenic",
              "flex min-w-0 items-center gap-4 p-4 py-0 duration-500",
              "hover:cursor-pointer hover:bg-flathub-gainsborow/20 hover:no-underline dark:hover:bg-flathub-arsenic/90",
              "active:bg-flathub-gainsborow/40 active:dark:bg-flathub-arsenic",
              "h-full",
            )}
          >
            <div className="flex justify-center flex-row w-full h-full gap-6 px-16">
              <div className="flex flex-col justify-center items-center lg:w-1/3 h-auto w-full">
                <div className="relative flex h-[64px] w-[64px] flex-shrink-0 flex-wrap items-center justify-center drop-shadow-md lg:h-[96px] lg:w-[96px]">
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
