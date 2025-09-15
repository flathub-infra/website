"use client"

import { ChangeEvent, useEffect, useState } from "react"
import { useRouter } from "../../i18n/navigation"
import { HiMagnifyingGlass } from "react-icons/hi2"
import { useLocale, useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { SiteLinksSearchBoxJsonLd } from "next-seo"
import Form from "next/form"
import { clsx } from "clsx"

interface SearchBarProps {
  className?: string
}

const SearchBar = ({ className }: SearchBarProps) => {
  const t = useTranslations()
  const router = useRouter()
  const locale = useLocale()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState("")

  useEffect(() => {
    const q = searchParams.get("query")
    if (q) {
      setQuery(q)
    }
  }, [searchParams])

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    setQuery(e.target.value)
  }

  function onClickSearch(): void {
    const disallowedQueries = [".", ".."]
    if (!disallowedQueries.includes(query)) {
      const queryEncoded = encodeURIComponent(query).replace(/\./g, "%2E")
      router.push(`/apps/search${queryEncoded ? `?q=${queryEncoded}` : ""}`)
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
      <label htmlFor="search" className="sr-only">
        {t("search-apps")}
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 start-0 flex items-center ps-2">
          <button
            className="rounded-full p-1 hover:bg-flathub-gray-x11/50 dark:hover:bg-flathub-gainsborow/10"
            aria-hidden="true"
            tabIndex={-1}
            onClick={onClickSearch}
          >
            <HiMagnifyingGlass className="size-5 text-flathub-spanish-gray" />
          </button>
        </div>
        <Form action={`/${locale}/apps/search`} id="search-form" role="search">
          <input
            id="search"
            name="q"
            onChange={onChange}
            value={query}
            className={clsx(
              "peer",
              "block w-full rounded-full bg-flathub-gainsborow/50 py-2 ps-10 text-sm text-flathub-dark-gunmetal focus:border-flathub-dark-gunmetal dark:bg-flathub-granite-gray/70",
              "placeholder-flathub-dark-gunmetal/50 focus:placeholder-flathub-dark-gunmetal/75 focus:outline-hidden dark:placeholder-flathub-sonic-silver dark:focus:placeholder-flathub-spanish-gray dark:focus:outline-hidden",
              "focus:ring-1 focus:ring-flathub-dark-gunmetal dark:text-flathub-gainsborow dark:focus:border-flathub-gainsborow",
              "dark:focus:text-white dark:focus:ring-flathub-gainsborow sm:text-sm",
              "pe-2",
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
        </Form>
      </div>
    </>
  )
}

export default SearchBar
