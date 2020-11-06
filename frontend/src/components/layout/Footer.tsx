import Link from 'next/link'

const Footer = () => (
  <footer id='footer'>
    <div className='footer-section'>
      <div className='footer-title'>Applications</div>
      <div className='footer-items'>
        <div className='footer-item'>
          <Link href='/apps/collection/popular'>Popular</Link>
        </div>
        <div className='footer-item'>
          <Link href='/apps/collection/recently-updated'>New & Updated</Link>
        </div>
        <div className='footer-item'>
          <Link href='/apps/collection/editors-choice-apps'>
            Editor's Choice
          </Link>
        </div>
        <div className='footer-item'>
          <Link href='/apps/collection/editors-choice-games'>
            Editor's Choice Games
          </Link>
        </div>
        <div className='footer-item'>
          <Link href='/apps'>Browse Apps</Link>
        </div>
        <div className='footer-item'>
          <Link href='/feeds'>RSS Feeds</Link>
        </div>
      </div>
    </div>

    <div className='footer-section'>
      <div className='footer-title'>Community</div>
      <div className='footer-items'>
        <div className='footer-item'>
          <a href='https://flatpak.org/about/'>Get involved</a>
        </div>
        <div className='footer-item'>
          <a href='https://discourse.flathub.org/'>Forum</a>
        </div>
        <div className='footer-item'>
          <a href='https://twitter.com/FlatpakApps'>Follow us</a>
        </div>
      </div>
    </div>

    <div className='footer-section'>
      <div className='footer-title'>Developers</div>
      <div className='footer-items'>
        <div className='footer-item'>
          <a href='https://github.com/flathub/flathub/wiki/App-Submission'>
            Publish your app
          </a>
        </div>
        <div className='footer-item'>
          <a href='http://docs.flatpak.org/'>Documentation</a>
        </div>
        <div className='footer-item'>
          <a href='https://github.com/flathub/'>Example build files</a>
        </div>
        <div className='footer-item'>
          <Link href='/badges'>Badges</Link>
        </div>
      </div>
    </div>

    <div className='footer-section'>
      <div className='footer-title'>Flathub</div>
      <div className='footer-items'>
        <div className='footer-item'>
          <Link href='/about'>About Flathub</Link>
        </div>
        <div className='footer-item'>
          <a href='https://status.flathub.org/'>Flathub Status</a>
        </div>
      </div>
    </div>
  </footer>
)

export default Footer
