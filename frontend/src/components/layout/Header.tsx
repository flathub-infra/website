import { ChangeEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'

const Header = () => {
  const router = useRouter()
  const [query, setQuery] = useState('')
  useEffect(() => {
    const q = router.query.query as string
    if (q) {
      setQuery(q)
    }
  }, [])

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

  return (
    <header>
      <nav>
        <div id='brand'>
          <Link href='/'>
            <img
              src='https://flathub.org/assets/themes/flathub/flathub-logo-toolbar.svg'
              alt='Flathub'
            />
          </Link>
        </div>

        <div id='search'>
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

        <div id='navbar'>
          <div className='nav-item'>
            <a href='https://github.com/flathub/flathub/wiki/App-Submission'>
              Publish
            </a>
          </div>

          <div className='nav-item'>
            <a href='https://discourse.flathub.org/'>Forum</a>
          </div>

          <Link href='/about'>
            <div className='nav-item'>About</div>
          </Link>
        </div>
      </nav>
    </header>
  )
}

export default Header
