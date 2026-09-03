"use client"

import Image from "next/image"
import { useTranslations } from "next-intl"
import clsx from "clsx"
import { DistroSetup } from "../../../src/distro-setup"
import { useState } from "react"
import { MagnifyingGlassIcon } from "@heroicons/react/20/solid"
import { Input } from "../../../@/components/ui/input"
import { Link } from "src/i18n/navigation"
import { motion, LayoutGroup, useReducedMotion } from "framer-motion"

interface Props {
  instructions: DistroSetup[]
}

export default function SetupClient({ instructions }: Props) {
  const t = useTranslations()
  const shouldReduceMotion = useReducedMotion()

  // linux distros by approximate popularity or if setup is needed
  const distroOrder: { name: string; order: number }[] = [
    { name: "Ubuntu", order: 100 },
    { name: "Debian", order: 95 },
    { name: "Chrome OS", order: 90 },
    { name: "Fedora", order: 85 },
    { name: "Arch", order: 80 },
    { name: "Linux Mint", order: 75 },
    { name: "openSUSE", order: 70 },
    { name: "Manjaro", order: 65 },
  ]
  const [distroFilter, setDistroFilter] = useState<string>("")

  const instructionsFilteredAndSorted = instructions
    .filter(
      (instruction) =>
        t(instruction.translatedNameKey)
          .toLowerCase()
          .includes(distroFilter.toLowerCase()) ||
        instruction.name.toLowerCase().includes(distroFilter.toLowerCase()),
    )
    .sort((a, b) => {
      const aIndex = distroOrder.findIndex((distro) => distro.name === a.name)
      const bIndex = distroOrder.findIndex((distro) => distro.name === b.name)

      if (aIndex === -1 && bIndex === -1) {
        return 0
      }

      if (aIndex === -1) {
        return 1
      }

      if (bIndex === -1) {
        return -1
      }

      return distroOrder[bIndex].order - distroOrder[aIndex].order
    })

  return (
    <LayoutGroup>
      <div className="max-w-11/12 mx-auto my-0 mt-12 w-11/12 space-y-10 2xl:w-350 2xl:max-w-350">
        <header className="mx-auto max-w-2xl space-y-3 text-center">
          <h1 className="text-balance text-3xl font-bold text-flathub-dark-gunmetal dark:text-flathub-white">
            {t("setup-flathub")}
          </h1>
          <p className="text-pretty text-flathub-dark-gunmetal/70 dark:text-flathub-gainsborow/70">
            {t("setup-flathub-description")}
          </p>
        </header>
        <div className="relative mx-auto max-w-2xl">
          <label htmlFor="distribution-search" className="sr-only">
            {t("find-your-distribution")}
          </label>
          <div className="absolute inset-y-0 inset-s-0 flex items-center ps-2">
            <MagnifyingGlassIcon
              aria-hidden="true"
              className="size-5 text-flathub-spanish-gray"
            />
          </div>
          <Input
            id="distribution-search"
            type="text"
            name="distribution"
            aria-label={t("find-your-distribution")}
            autoComplete="off"
            placeholder={t("find-your-distribution")}
            className={clsx("ps-9")}
            onChange={(e) => setDistroFilter(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {instructionsFilteredAndSorted.length === 0 && (
            <div className="col-span-full text-center">
              <p className="text-flathub-dark-gunmetal/50 dark:text-flathub-sonic-silver">
                {t("no-results-found")}
              </p>
            </div>
          )}
          {instructionsFilteredAndSorted.map((instruction, index) => (
            <motion.div key={instruction.name} layout={!shouldReduceMotion}>
              <Link
                href={`/setup/${encodeURIComponent(
                  instruction.slug ?? instruction.name,
                )}`}
                className={clsx(
                  "flex min-w-0 items-center gap-4 rounded-xl bg-flathub-white px-4 shadow-md duration-500 dark:bg-flathub-arsenic/70",
                  "no-underline hover:cursor-pointer hover:bg-flathub-gainsborow/20 hover:shadow-xl dark:hover:bg-flathub-arsenic/90",
                  "active:bg-flathub-gainsborow/40 active:shadow-xs focus-visible:ring-2 focus-visible:ring-flathub-celestial-blue focus-visible:ring-offset-2 dark:active:bg-flathub-arsenic",
                  "px-8 py-6",
                )}
              >
                <motion.picture
                  layoutId={`distro-logo-${instruction.name.replaceAll("/", "").replaceAll(" ", "-")}`}
                >
                  <source
                    srcSet={instruction.logo_dark}
                    media="(prefers-color-scheme: dark)"
                  />
                  <Image
                    className="size-24"
                    src={instruction.logo}
                    width={96}
                    height={96}
                    priority={index < 7}
                    alt={t("app-logo", {
                      app_name: t(instruction.translatedNameKey),
                    })}
                  />
                </motion.picture>
                <motion.span
                  className="text-lg font-semibold text-flathub-dark-gunmetal dark:text-flathub-gainsborow"
                  layoutId={`distro-name-${instruction.name.replaceAll("/", "").replaceAll(" ", "-")}`}
                >
                  {t(instruction.translatedNameKey)}
                </motion.span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </LayoutGroup>
  )
}
