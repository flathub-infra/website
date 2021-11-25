import Link from 'next/link'
import styles from './Footer.module.scss'

const Footer = () => (
  <footer id={styles.footer}>
    <div className={styles.footerContainer}>
      <div className={styles.footerSection}>
        <div className={styles.footerTitle}>Applications</div>
        <div className={styles.footerItems}>
          <div className={styles.footerItem}>
            <Link href='/apps/collection/popular'>Popular</Link>
          </div>
          <div className={styles.footerItem}>
            <Link href='/apps/collection/recently-updated'>New & Updated</Link>
          </div>
          <div className={styles.footerItem}>
            <Link href='/apps/collection/editors-choice-apps'>
              Editor&apos;s Choice
            </Link>
          </div>
          <div className={styles.footerItem}>
            <Link href='/apps/collection/editors-choice-games'>
              Editor&apos;s Choice Games
            </Link>
          </div>
          <div className={styles.footerItem}>
            <Link href='/apps'>Browse Apps</Link>
          </div>
          <div className={styles.footerItem}>
            <Link href='/feeds'>RSS Feeds</Link>
          </div>
        </div>
      </div>

      <div className={styles.footerSection}>
        <div className={styles.footerTitle}>Community</div>
        <div className={styles.footerItems}>
          <div className={styles.footerItem}>
            <a href='https://flatpak.org/about/'>Get involved</a>
          </div>
          <div className={styles.footerItem}>
            <a href='https://discourse.flathub.org/'>Forum</a>
          </div>
          <div className={styles.footerItem}>
            <a href='https://twitter.com/FlatpakApps'>Follow us</a>
          </div>
        </div>
      </div>

      <div className={styles.footerSection}>
        <div className={styles.footerTitle}>Developers</div>
        <div className={styles.footerItems}>
          <div className={styles.footerItem}>
            <a href='https://github.com/flathub/flathub/wiki/App-Submission'>
              Publish your app
            </a>
          </div>
          <div className={styles.footerItem}>
            <a href='http://docs.flatpak.org/'>Documentation</a>
          </div>
          <div className={styles.footerItem}>
            <a href='https://github.com/flathub/'>Example build files</a>
          </div>
          <div className={styles.footerItem}>
            <Link href='/badges'>Badges</Link>
          </div>
        </div>
      </div>

      <div className={styles.footerSection}>
        <div className={styles.footerTitle}>Flathub</div>
        <div className={styles.footerItems}>
          <div className={styles.footerItem}>
            <Link href='/about'>About Flathub</Link>
          </div>
          <div className={styles.footerItem}>
            <Link href='/statistics'>Statistics</Link>
          </div>
          <div className={styles.footerItem}>
            <a href='https://status.flathub.org/'>Flathub Status</a>
          </div>
        </div>
      </div>

      <div
        className={styles.fullWidth}
        style={{ display: 'flex', justifyContent: 'center' }}
      >
        <a
          href='https://github.com/flathub/frontend'
          target='_blank'
          rel='noreferrer'
        >
          Find the source code here
        </a>
      </div>
    </div>
  </footer>
)

export default Footer
