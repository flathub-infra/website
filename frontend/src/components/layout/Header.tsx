import { ChangeEvent, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/router"
import { MdMenu, MdMenuOpen, MdSearch } from "react-icons/md"

import styles from "./Header.module.scss"
import { LogoJsonLd, SiteLinksSearchBoxJsonLd } from "next-seo"
import { env } from "process"
import { useTranslation } from "next-i18next"

const Header = () => {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [isMenuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    document.dir = i18n.dir()
  }, [i18n, i18n.language])

  useEffect(() => {
    const q = router.query.query as string
    if (q) {
      setQuery(q)
    }
  }, [router.query.query])

  const mobileSize = 768
  const [isMobile, setIsMobile] = useState(true)

  useEffect(() => {
    window.addEventListener(
      "resize",
      () => {
        const ismobile = window.innerWidth < mobileSize
        if (ismobile !== isMobile) setIsMobile(ismobile)
      },
      false,
    )

    return () => {
      window.removeEventListener("resize", () => {}, false)
    }
  }, [isMobile])

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    setQuery(e.target.value)
  }

  const onSubmit = (e: ChangeEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (query !== "") {
      router.push(`/apps/search/${query}`)
    }
  }

  const toggleMenu = () => {
    setMenuOpen(!isMenuOpen)
  }

  return (
    <header className={styles.header}>
      <nav className={styles.navHeader}>
        <span className={styles.brandContainer}>
          <LogoJsonLd
            logo={`${env.NEXT_PUBLIC_BASE_URL}/img/logo/flathub-logo-toolbar.svg`}
            url={`${env.NEXT_PUBLIC_BASE_URL}`}
          />
          <Link href="/" passHref>
            <a id={styles.brand} title={t("go-home")}></a>
          </Link>
        </span>

        <div id={styles.search}>
          <SiteLinksSearchBoxJsonLd
            url={process.env.NEXT_PUBLIC_SITE_BASE_URI}
            potentialActions={[
              {
                target: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/apps/search/{search_term_string}`,
                queryInput: "search_term_string",
              },
            ]}
          />
          <form onSubmit={onSubmit}>
            <MdSearch className={styles.searchIcon} />
            <input
              type="search"
              name="q"
              placeholder={t("search-apps")}
              onChange={onChange}
              value={query}
              aria-label={t("search-apps")}
            />
          </form>
        </div>
        <span className={`${styles.navbarContainer}`}>
          <div
            id={styles.navbar}
            className={`${isMenuOpen && isMobile ? styles.responsive : ""}`}
          >
            <div className={styles.navItem}>
              <a
                href="https://github.com/flathub/flathub/wiki/App-Submission"
                target="_blank"
                rel="noreferrer"
              >
                {t("publish")}
              </a>
            </div>

            <div className={styles.navItem}>
              <a
                href="https://discourse.flathub.org/"
                target="_blank"
                rel="noreferrer"
              >
                {t("forum")}
              </a>
            </div>

            <Link href="/about" passHref>
              <a className={styles.navItem}>{t("about")}</a>
            </Link>
          </div>
          <div className={styles.toggleContainer}>
            <span className={`${styles.navbarToggle}`} onClick={toggleMenu}>
              {isMenuOpen && isMobile ? <MdMenuOpen /> : <MdMenu />}
            </span>
          </div>
        </span>
      </nav>
    </header>
  )
}

export default Header
