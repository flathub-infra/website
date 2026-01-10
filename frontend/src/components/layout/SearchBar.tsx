"use client"

import { useMemo, useState, useRef, useEffect } from "react"
import { useRouter } from "../../i18n/navigation"
import { useLocale, useTranslations } from "next-intl"
import { SiteLinksSearchBoxJsonLd } from "next-seo"
import { useMatomo } from "@mitresthen/matomo-tracker-react"
import { clsx } from "clsx"
import { instantMeiliSearch } from "@meilisearch/instant-meilisearch"
import type { AppsIndex } from "../../codegen"
import { mapAppsIndexToAppstreamListItem } from "../../meilisearch"
import LogoImage from "../LogoImage"
import { Link } from "../../i18n/navigation"
import { ArrowRight, ChevronRight, Search, XIcon } from "lucide-react"

interface SearchBarProps {
  className?: string
}

const SearchBar = ({ className }: SearchBarProps) => {
  const t = useTranslations()
  const router = useRouter()
  const locale = useLocale()
  const { trackSiteSearch, trackEvent } = useMatomo()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<AppsIndex[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Create the Meilisearch client
  const searchClient = useMemo(() => {
    const meilisearchUrl = process.env.NEXT_PUBLIC_MEILISEARCH_URL
    const meilisearchKey = process.env.NEXT_PUBLIC_MEILISEARCH_KEY

    if (!meilisearchUrl) {
      return null
    }

    const client = instantMeiliSearch(
      meilisearchUrl,
      meilisearchKey || undefined,
      {
        primaryKey: "id",
      },
    )

    return client.searchClient
  }, [])

  // Handle clicks outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  // Handle keyboard shortcut (/)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/" && document.activeElement !== inputRef.current) {
        event.preventDefault()
        inputRef.current?.focus()
      }
      if (event.key === "Escape") {
        setIsOpen(false)
        setSelectedIndex(-1)
        inputRef.current?.blur()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  // Handle keyboard navigation in dropdown
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) {
      return
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : prev,
        )
        break
      case "ArrowUp":
        e.preventDefault()
        setSelectedIndex((prev) => (prev > -1 ? prev - 1 : -1))
        break
      case "Enter":
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          e.preventDefault()
          const selectedApp = mapAppsIndexToAppstreamListItem(
            results[selectedIndex],
          )
          router.push(`/apps/${selectedApp.id}`)
          setIsOpen(false)
          setQuery("")
          setSelectedIndex(-1)
          inputRef.current?.blur()
        }
        break
    }
  }

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(-1)
  }, [results])

  // Perform instant search
  useEffect(() => {
    if (!searchClient || !query.trim()) {
      setResults([])
      setIsOpen(false)
      return
    }

    const performSearch = async () => {
      setIsLoading(true)
      try {
        const response = await searchClient.search([
          {
            indexName: "apps",
            params: {
              query: query,
              hitsPerPage: 8,
              filters:
                "type IN [desktop-application, console-application] AND NOT icon IS NULL",
            },
          },
        ])

        const hits = (response.results[0]?.hits as AppsIndex[]) || []

        let translatedHits = hits
        if (locale !== "en") {
          translatedHits = hits.map((hit) => {
            if (hit.translations && hit.translations[locale]) {
              const translation = hit.translations[locale]
              return {
                ...hit,
                name: translation.name
                  ? (translation.name as string)
                  : hit.name,
                summary: translation.summary
                  ? (translation.summary as string)
                  : hit.summary,
              }
            }
            return hit
          })
        }

        setResults(translatedHits || [])
        setIsOpen(true)

        // Track instant search to Matomo
        trackSiteSearch({
          keyword: query,
          count: hits?.length || 0,
        })
      } catch (error) {
        console.error("Search error:", error)
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }

    const debounceTimer = setTimeout(performSearch, 300)
    return () => clearTimeout(debounceTimer)
    // eslint-disable-next-line react-compiler/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, searchClient, locale])

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const disallowedQueries = [".", ".."]
    if (!disallowedQueries.includes(query)) {
      const queryEncoded = encodeURIComponent(query).replace(/\./g, "%2E")
      router.push(`/apps/search${queryEncoded ? `?q=${queryEncoded}` : ""}`)
      setIsOpen(false)
      inputRef.current?.blur()
    }
  }

  return (
    <>
      <SiteLinksSearchBoxJsonLd
        useAppDir={true}
        url={process.env.NEXT_PUBLIC_SITE_BASE_URI}
        potentialActions={[
          {
            target: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/apps/search?q`,
            queryInput: "search_term_string",
          },
        ]}
      />
      <div className="relative" ref={searchRef}>
        <label htmlFor="search" className="sr-only">
          {t("search-apps")}
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 start-0 flex items-center ps-2">
            <button
              className="rounded-full p-1 hover:bg-flathub-gray-x11/50 dark:hover:bg-flathub-gainsborow/10"
              aria-hidden="true"
              tabIndex={-1}
              onClick={onSubmit}
            >
              <Search className="size-5 text-flathub-spanish-gray" />
            </button>
          </div>
          <form onSubmit={onSubmit} role="search">
            <input
              ref={inputRef}
              id="search"
              name="q"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              value={query}
              autoComplete="off"
              role="combobox"
              aria-expanded={isOpen}
              aria-controls="search-results"
              aria-activedescendant={
                selectedIndex >= 0
                  ? `search-result-${selectedIndex}`
                  : undefined
              }
              className={clsx(
                "peer",
                "block w-full rounded-full bg-flathub-gainsborow/50 py-2 ps-10 text-sm text-flathub-dark-gunmetal focus:border-flathub-dark-gunmetal dark:bg-flathub-granite-gray/70",
                "placeholder-flathub-dark-gunmetal/50 focus:placeholder-flathub-dark-gunmetal/75 focus:outline-hidden dark:placeholder-flathub-sonic-silver dark:focus:placeholder-flathub-spanish-gray dark:focus:outline-hidden",
                "focus:ring-1 focus:ring-flathub-dark-gunmetal dark:text-flathub-gainsborow dark:focus:border-flathub-gainsborow",
                "dark:focus:text-white dark:focus:ring-flathub-gainsborow sm:text-sm",
                "pe-2",
                className,
              )}
              placeholder={t("search-apps")}
              type="search"
            />
            {!query && (
              <div className="pointer-events-none absolute inset-y-0 end-0 hidden items-center pe-5 peer-focus:hidden md:flex">
                <kbd
                  className="flex size-5 items-center justify-center rounded border-2 border-flathub-gray-x11/60 font-sans text-xs text-flathub-arsenic dark:border-flathub-sonic-silver dark:text-flathub-gainsborow"
                  aria-hidden="true"
                >
                  /
                </kbd>
              </div>
            )}
          </form>
        </div>

        {/* Dropdown results */}
        {isOpen && (query.trim() || isLoading) && (
          <>
            {/* Mobile overlay backdrop */}
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
            <div
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setIsOpen(false)}
            />

            <div
              id="search-results"
              role="listbox"
              className={clsx(
                "z-50 overflow-hidden bg-white shadow-2xl dark:bg-flathub-dark-gunmetal overflow-y-auto",
                // Mobile: fullscreen with search box at top
                "fixed inset-0 md:absolute md:inset-auto md:top-full md:mt-2 md:w-full md:rounded-xl md:border-2 md:border-flathub-gray-x11/40 md:dark:border-flathub-sonic-silver/30 md:max-h-[80vh]",
              )}
            >
              {/* Mobile header with search box and close button */}
              <div className="sticky top-0 z-10 border-b border-flathub-gray-x11/50 bg-white px-4 py-3 dark:border-flathub-sonic-silver/20 dark:bg-flathub-dark-gunmetal md:hidden">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 start-0 flex items-center ps-2">
                      <Search className="size-5 text-flathub-spanish-gray" />
                    </div>
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={handleKeyDown}
                      autoComplete="off"
                      // eslint-disable-next-line jsx-a11y/no-autofocus
                      autoFocus
                      className={clsx(
                        "block w-full rounded-full bg-flathub-gainsborow/50 py-2 ps-10 pe-2 text-sm text-flathub-dark-gunmetal",
                        "placeholder-flathub-dark-gunmetal/50 focus:placeholder-flathub-dark-gunmetal/75 focus:outline-hidden",
                        "focus:ring-1 focus:ring-flathub-dark-gunmetal dark:bg-flathub-granite-gray/70 dark:text-flathub-gainsborow",
                        "dark:placeholder-flathub-sonic-silver dark:focus:placeholder-flathub-spanish-gray dark:focus:border-flathub-gainsborow dark:focus:text-white dark:focus:ring-flathub-gainsborow",
                      )}
                      placeholder={t("search-apps")}
                    />
                  </div>
                  <button
                    onClick={() => {
                      setIsOpen(false)
                      setSelectedIndex(-1)
                    }}
                    className="flex-shrink-0 rounded-lg p-2 text-flathub-sonic-silver hover:bg-flathub-gainsborow/50 dark:hover:bg-flathub-arsenic"
                    aria-label={t("close")}
                  >
                    <XIcon className="size-6" />
                  </button>
                </div>
              </div>

              {isLoading && (
                <div className="px-4 py-8 text-center text-sm text-flathub-sonic-silver">
                  {t("loading")}
                </div>
              )}

              {!isLoading && results.length === 0 && query.trim() && (
                <div className="px-4 py-8 text-center text-sm text-flathub-sonic-silver">
                  {t("no-results-found")}
                </div>
              )}

              {!isLoading && results.length > 0 && (
                <div className="py-2">
                  {results.map((hit, index) => {
                    const app = mapAppsIndexToAppstreamListItem(hit)
                    return (
                      <Link
                        key={app.id}
                        id={`search-result-${index}`}
                        href={`/apps/${app.id}`}
                        role="option"
                        aria-selected={selectedIndex === index}
                        className={clsx(
                          "flex items-center gap-3 px-4 py-3 transition",
                          selectedIndex === index
                            ? "bg-flathub-gainsborow/70 dark:bg-flathub-arsenic/70"
                            : "hover:bg-flathub-gainsborow/50 dark:hover:bg-flathub-arsenic",
                        )}
                        onClick={() => {
                          // Track instant search result click
                          trackEvent({
                            category: "Search",
                            action: "Instant Search Click",
                            name: app.id,
                          })
                          setIsOpen(false)
                          setQuery("")
                          setSelectedIndex(-1)
                        }}
                      >
                        <div className="flex-shrink-0">
                          <LogoImage
                            iconUrl={app.icon}
                            appName={app.name}
                            size="64"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-flathub-dark-gunmetal dark:text-flathub-lotion truncate">
                            {app.name}
                          </div>
                          <div className="text-xs text-flathub-sonic-silver dark:text-flathub-spanish-gray truncate">
                            {app.summary}
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          <ChevronRight
                            aria-hidden="true"
                            className="size-6 text-flathub-sonic-silver rtl:rotate-180"
                          />
                        </div>
                      </Link>
                    )
                  })}
                  <div className="border-t border-flathub-gray-x11/50 dark:border-flathub-sonic-silver/20 mt-2 pt-2 px-4 pb-2">
                    <Link
                      href={`/apps/search?q=${encodeURIComponent(query)}`}
                      className="text-sm text-flathub-celestial-blue hover:underline flex items-center gap-1"
                      onClick={() => {
                        // Track "see all results" click
                        trackEvent({
                          category: "Search",
                          action: "See All Results Click",
                          name: query,
                        })
                        setIsOpen(false)
                      }}
                    >
                      <span>{t("see-all-results")}</span>
                      <span aria-hidden="true">
                        <ArrowRight className="size-4 rtl:rotate-180" />
                      </span>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}

export default SearchBar
