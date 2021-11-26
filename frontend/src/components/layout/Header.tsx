import { ChangeEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { MdMenu, MdMenuOpen, MdSearch } from 'react-icons/md'

import styles from './Header.module.scss'
import { LogoJsonLd, SiteLinksSearchBoxJsonLd } from 'next-seo'
import { env } from 'process'

const Header = () => {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [isMenuOpen, setMenuOpen] = useState(false)

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
      'resize',
      () => {
        const ismobile = window.innerWidth < mobileSize
        if (ismobile !== isMobile) setIsMobile(ismobile)
      },
      false
    )

    return () => {
      window.removeEventListener('resize', () => {}, false)
    }
  }, [isMobile])

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    setQuery(e.target.value)
  }

  const onSubmit = (e: ChangeEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (query !== '') {
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
            logo={`${env.API_URL}/img/logo/flathub-logo-toolbar.svg`}
            url={`${env.NEXT_PUBLIC_BASE_URL}`}
          />
          <Link href='/' passHref>
            <a id={styles.brand}></a>
          </Link>
        </span>

        <div id={styles.search}>
          <SiteLinksSearchBoxJsonLd
            url={process.env.NEXT_PUBLIC_SITE_BASE_URI}
            potentialActions={[
              {
                target: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/apps/search/{search_term_string}`,
                queryInput: 'search_term_string',
              },
            ]}
          />
          <form onSubmit={onSubmit}>
            <MdSearch className={styles.searchIcon} />
            <input
              type='search'
              name='q'
              placeholder='Search apps'
              onChange={onChange}
              value={query}
              aria-label='Search apps'
            />
          </form>
        </div>
        <span className={`${styles.navbarContainer}`}>
          <div
            id={styles.navbar}
            className={`${isMenuOpen && isMobile ? styles.responsive : ''}`}
          >
            <Link href='/apps' passHref>
              <a className={styles.navItem}>Explore</a>
            </Link>

            <div className={styles.navItem}>
              <a href='https://github.com/flathub/flathub/wiki/App-Submission'>
                Publish
              </a>
            </div>

            <div className={styles.navItem}>
              <a href='https://discourse.flathub.org/'>Forum</a>
            </div>

            <Link href='/about' passHref>
              <a className={styles.navItem}>About</a>
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
