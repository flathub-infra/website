import Link from 'next/link'
import { useState, ChangeEvent, useEffect } from 'react'
import { useRouter } from 'next/router'

export default function Header() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  useEffect(() => {
    const q = router.query.query as string
    if (q) setQuery(q)
  }, [])

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    setQuery(e.target.value)
  }

  const onSubmit = (e: ChangeEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (query !== '') router.push(`/apps/search/${query}`)
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
          <Link href='/apps'>
            <div className='nav-item'>Applications</div>
          </Link>
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
