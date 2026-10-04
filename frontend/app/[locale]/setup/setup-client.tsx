"use client"

import Image from "next/image"
import { useTranslations } from "next-intl"
import clsx from "clsx"
import type { DistroSetup } from "../../../src/distro-setup"
import { memo, useDeferredValue, useMemo, useState } from "react"
import { MagnifyingGlassIcon } from "@heroicons/react/20/solid"
import { Input } from "../../../@/components/ui/input"
import { Link } from "src/i18n/navigation"
import { motion, LayoutGroup, useReducedMotion } from "framer-motion"

interface Props {
  instructions: Pick<
    DistroSetup,
    "name" | "slug" | "logo" | "logo_dark" | "translatedNameKey"
  >[]
}

// Linux distros by approximate popularity or if setup is needed.
const distroOrder = [
  "Ubuntu",
  "Debian",
  "Chrome OS",
  "Fedora",
  "Arch",
  "Linux Mint",
  "openSUSE",
  "Manjaro",
]

export default function SetupClient({ instructions }: Props) {
  const t = useTranslations()
  const [distroFilter, setDistroFilter] = useState<string>("")
  const deferredFilter = useDeferredValue(distroFilter).toLowerCase()
  const sortedInstructions = useMemo(
    () =>
      instructions
        .map((instruction) => ({
          ...instruction,
          translatedName: t(instruction.translatedNameKey),
        }))
        .sort((a, b) => {
          const aIndex = distroOrder.indexOf(a.name)
          const bIndex = distroOrder.indexOf(b.name)
          return (
            (aIndex === -1 ? distroOrder.length : aIndex) -
            (bIndex === -1 ? distroOrder.length : bIndex)
          )
        }),
    [instructions, t],
  )
  const instructionsFilteredAndSorted = useMemo(
    () =>
      sortedInstructions.filter(
        (instruction) =>
          instruction.translatedName.toLowerCase().includes(deferredFilter) ||
          instruction.name.toLowerCase().includes(deferredFilter),
      ),
    [sortedInstructions, deferredFilter],
  )

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
            value={distroFilter}
            onChange={(e) => setDistroFilter(e.target.value)}
          />
        </div>
        <DistroGrid instructions={instructionsFilteredAndSorted} />
      </div>
    </LayoutGroup>
  )
}

const DistroGrid = memo(function DistroGrid({
  instructions,
}: {
  instructions: (Props["instructions"][number] & { translatedName: string })[]
}) {
  const t = useTranslations()
  const shouldReduceMotion = useReducedMotion()

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {instructions.length === 0 && (
        <div className="col-span-full text-center">
          <p className="text-flathub-dark-gunmetal/50 dark:text-flathub-sonic-silver">
            {t("no-results-found")}
          </p>
        </div>
      )}
      {instructions.map((instruction, index) => (
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
                  app_name: instruction.translatedName,
                })}
              />
            </motion.picture>
            <motion.span
              className="text-lg font-semibold text-flathub-dark-gunmetal dark:text-flathub-gainsborow"
              layoutId={`distro-name-${instruction.name.replaceAll("/", "").replaceAll(" ", "-")}`}
            >
              {instruction.translatedName}
            </motion.span>
          </Link>
        </motion.div>
      ))}
    </div>
  )
})
