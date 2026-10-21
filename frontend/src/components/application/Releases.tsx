import { formatDistanceToNow } from "date-fns"
import { useLocale, useTranslations } from "next-intl"
import { FunctionComponent, useState, useRef, useEffect, useId } from "react"
import { getDateFnsLocale } from "../../localize"

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
      className="flex min-h-11 w-fit max-w-full items-center gap-2 rounded-sm py-2 font-normal text-flathub-celestial-blue no-underline hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flathub-celestial-blue"
      href={url}
      target="_blank"
      rel="noreferrer"
    >
      {t(noChangeLogProvided ? "release-link-no-changelog" : "release-link")}
      <div className="shrink-0 self-center justify-self-end text-flathub-black opacity-60 dark:text-flathub-gainsborow">
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
  const contentId = useId()

  useEffect(() => {
    const content = contentRef.current
    if (!content) {
      return
    }

    const observer = new ResizeObserver(() => {
      const lineHeight = parseFloat(getComputedStyle(content).lineHeight)
      const maxLines = 3
      const maxHeight = lineHeight * maxLines
      setCollapsedHeight(maxHeight)
      setShowCollapseButton(content.scrollHeight > maxHeight)
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [latestRelease.description, latestRelease.url, locale])

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
        <div className="min-w-0 rounded-xl bg-flathub-white shadow-sm dark:bg-flathub-arsenic dark:shadow-none">
          <div>
            <div
              className={clsx(
                "flex flex-col gap-4 px-5 pt-5 sm:px-6 sm:pt-6",
                (!showCollapseButton || isExpanded) && "pb-5 sm:pb-6",
              )}
            >
              <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                <h3 className="my-0 min-w-0 text-lg leading-snug font-semibold [overflow-wrap:anywhere]">
                  {t("changes-in-version", {
                    version_number: latestRelease.version,
                  })}
                </h3>
                <div className="flex gap-2 items-center">
                  {latestReleaseTimestamp && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="min-h-11 rounded-md text-sm text-flathub-granite-gray focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flathub-celestial-blue dark:text-flathub-gainsborow"
                          >
                            <time
                              dateTime={latestReleaseTimestamp.toISOString()}
                            >
                              {formatDistanceToNow(latestReleaseTimestamp, {
                                addSuffix: true,
                                locale: getDateFnsLocale(locale),
                              })}
                            </time>
                          </button>
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
                                  {
                                    addSuffix: true,
                                    locale: getDateFnsLocale(locale),
                                  },
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
                  id={contentId}
                  onFocusCapture={() => setIsExpanded(true)}
                  className={clsx(
                    "prose prose-p:my-0 prose-ul:my-0 relative max-w-prose overflow-hidden [overflow-wrap:anywhere] dark:prose-invert dark:prose-p:text-flathub-lotion",
                    !isExpanded &&
                      showCollapseButton &&
                      "before:from-flathub-white before:pointer-events-none before:absolute before:bottom-0 before:start-0 before:h-1/2 before:w-full before:bg-linear-to-t before:content-[''] dark:before:from-flathub-arsenic",
                  )}
                  style={{
                    maxHeight:
                      isExpanded || !showCollapseButton
                        ? "none"
                        : collapsedHeight
                          ? `${collapsedHeight}px`
                          : "none",
                  }}
                >
                  <div ref={contentRef} className="flow-root">
                    <div
                      dangerouslySetInnerHTML={{ __html: descriptionSanitized }}
                    />
                    <ReleaseLink url={latestRelease.url} />
                  </div>
                </div>
              ) : (
                <div className="prose prose-p:my-0 min-w-0 [overflow-wrap:anywhere] dark:prose-invert">
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
                type="button"
                aria-expanded={isExpanded}
                aria-controls={contentId}
                className="min-h-11 w-full rounded-b-xl border-t border-flathub-gainsborow px-5 py-3 font-semibold transition-colors hover:cursor-pointer hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flathub-celestial-blue dark:border-flathub-granite-gray dark:hover:bg-white/5"
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
