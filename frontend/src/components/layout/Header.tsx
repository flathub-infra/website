import { ChangeEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { MdMenu, MdMenuOpen } from 'react-icons/md'

import styles from './Header.module.scss'

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
    <header>
      <nav className={styles.header}>
        <span className={styles.brandContainer}>
          <Link href='/' passHref>
            <div id={styles.brand}></div>
          </Link>
        </span>

        <div id={styles.search}>
          <form onSubmit={onSubmit}>
            <input
              type='search'
              name='q'
              placeholder='Search apps'
              onChange={onChange}
              value={query}
            />
          </form>
        </div>
        <span className={`${styles.navbarContainer}`}>
          <div
            id={styles.navbar}
            className={`${isMenuOpen && isMobile ? styles.responsive : ''}`}
          >
            <Link href='/apps' passHref>
              <div className={styles.navItem}>Explore</div>
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
              <div className={styles.navItem}>About</div>
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
