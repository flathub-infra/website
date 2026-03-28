import { formatDistanceToNow } from "date-fns"
import { useLocale, useTranslations } from "next-intl"
import { FunctionComponent, useState, useRef, useEffect } from "react"
import { getIntlLocale } from "../../localize"

import clsx from "clsx"
import { sanitizeAppstreamDescription } from "@/lib/helpers"
import { Summary } from "src/types/Summary"
import { UTCDate } from "@date-fns/utc"
import { ExternalLinkIcon } from "lucide-react"
import { Release } from "src/codegen"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface Props {
  latestRelease: Release | null
  summary: Summary
  expanded?: boolean
}

const ReleaseLink = ({
  url,
  noChangeLogProvided = false,
}: {
  url: string
  noChangeLogProvided?: boolean
}) => {
  const t = useTranslations()

  if (!url) {
    return null
  }

  return (
    <a
      className="flex items-center gap-2 font-normal text-flathub-celestial-blue no-underline hover:underline"
      href={url}
      target="_blank"
      rel="noreferrer"
    >
      {t(noChangeLogProvided ? "release-link-no-changelog" : "release-link")}
      <div className="self-center justify-self-end text-flathub-black opacity-60 dark:text-flathub-gainsborow">
        <ExternalLinkIcon className="rtl:-rotate-90 h-5" />
      </div>
    </a>
  )
}

const Releases: FunctionComponent<Props> = ({
  latestRelease,
  summary,
  expanded = false,
}) => {
  const t = useTranslations()
  const locale = useLocale()
  const [isExpanded, setIsExpanded] = useState(expanded)
  const [showCollapseButton, setShowCollapseButton] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const [collapsedHeight, setCollapsedHeight] = useState<number>(0)
  const [fullHeight, setFullHeight] = useState<number>(0)

  useEffect(() => {
    // Check if content is overflowing after render
    if (contentRef.current) {
      const lineHeight = parseFloat(
        getComputedStyle(contentRef.current).lineHeight,
      )
      const maxLines = 3
      const maxHeight = lineHeight * maxLines
      setCollapsedHeight(maxHeight)
      setFullHeight(contentRef.current.scrollHeight)
      setShowCollapseButton(contentRef.current.scrollHeight > maxHeight)
    }
  }, [latestRelease.description])

  const latestReleaseTimestamp =
    !latestRelease.timestamp ||
    new UTCDate(Number(latestRelease.timestamp) * 1000).getUTCFullYear() < 1990
      ? undefined
      : new UTCDate(Number(latestRelease.timestamp) * 1000)

  const descriptionSanitized = sanitizeAppstreamDescription(
    latestRelease.description,
  )

  return (
    <>
      {latestRelease && (
        <div className="rounded-xl bg-flathub-white shadow-md dark:bg-flathub-arsenic dark:shadow-none">
          <div>
            <div
              className={clsx(
                "flex flex-col gap-2 px-4 pt-4",
                (!showCollapseButton || isExpanded) && "pb-4",
              )}
            >
              <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="my-0 text-lg font-semibold">
                  {t("changes-in-version", {
                    version_number: latestRelease.version,
                  })}
                </h3>
                <div className="flex gap-2 items-center">
                  {latestReleaseTimestamp && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="text-xs rounded-full bg-flathub-gainsborow px-2.5 py-0.5 text-flathub-granite-gray dark:bg-flathub-dark-gunmetal dark:text-flathub-spanish-gray">
                            {formatDistanceToNow(latestReleaseTimestamp, {
                              addSuffix: true,
                            })}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div>
                            {latestReleaseTimestamp.toLocaleDateString(locale)}
                          </div>
                          {summary.timestamp && (
                            <div>
                              {t("build-x", {
                                build_ago: formatDistanceToNow(
                                  new UTCDate(summary.timestamp * 1000),
                                  { addSuffix: true },
                                ),
                              })}
                            </div>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </header>
              {descriptionSanitized ? (
                <div
                  ref={contentRef}
                  className={clsx(
                    "prose prose-p:my-0 prose-ul:my-0 relative overflow-hidden transition-all duration-300 ease-in-out dark:prose-invert dark:prose-p:text-flathub-lotion",
                    !isExpanded &&
                      showCollapseButton &&
                      "before:from-flathub-white before:absolute before:bottom-0 before:start-0 before:h-1/2 before:w-full before:bg-linear-to-t before:content-[''] dark:before:from-flathub-arsenic",
                  )}
                  style={{
                    maxHeight:
                      isExpanded || !showCollapseButton
                        ? fullHeight
                          ? `${fullHeight}px`
                          : "none"
                        : collapsedHeight
                          ? `${collapsedHeight}px`
                          : "none",
                  }}
                >
                  <div
                    dangerouslySetInnerHTML={{
                      __html: descriptionSanitized,
                    }}
                  />
                  <ReleaseLink url={latestRelease.url} />
                </div>
              ) : (
                <div className="prose prose-p:my-0 dark:prose-invert">
                  {latestRelease.url ? (
                    <ReleaseLink url={latestRelease.url} noChangeLogProvided />
                  ) : (
                    <ul className="list-disc ps-10">
                      <li>{t("no-changelog-provided")}</li>
                    </ul>
                  )}
                </div>
              )}
            </div>
            {showCollapseButton && (
              <button
                className="w-full rounded-bl-xl rounded-br-xl rounded-tl-none rounded-tr-none border-t border-flathub-gainsborow dark:border-flathub-granite-gray px-0 py-3 font-semibold transition hover:cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? (
                  <span>{t("less")}</span>
                ) : (
                  <span>{t("more")}</span>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default Releases
