import Link from 'next/link'
import styles from './Footer.module.scss'
import LoginStatus from '../login/Status'
import { useTranslation } from 'next-i18next';
import { IS_PRODUCTION } from '../../env';

const Footer = () => {
  const { t } = useTranslation();

  return (
    <footer id={styles.footer}>
      <div className={styles.footerContainer}>
        <div className={styles.footerSection}>
          <div className={styles.footerTitle}>{t('applications')}</div>
          <div className={styles.footerItems}>
            <div className={styles.footerItem}>
              <Link href='/apps/collection/popular'>{t('popular')}</Link>
            </div>
            <div className={styles.footerItem}>
              <Link href='/apps/collection/recently-updated'>{t('new-and-updated')}</Link>
            </div>
            <div className={styles.footerItem}>
              <Link href='/apps/collection/editors-choice-apps'>
                {t('editors-choice-apps')}
              </Link>
            </div>
            <div className={styles.footerItem}>
              <Link href='/apps/collection/editors-choice-games'>
                {t('editors-choice-games')}
              </Link>
            </div>
            <div className={styles.footerItem}>
              <Link href='/apps'>{t('browse-apps')}</Link>
            </div>
            <div className={styles.footerItem}>
              <Link href='/feeds'>{t('rss-feeds')}</Link>
            </div>
          </div>
        </div>

        <div className={styles.footerSection}>
          <div className={styles.footerTitle}>{t('community')}</div>
          <div className={styles.footerItems}>
            <div className={styles.footerItem}>
              <a
                href='https://flatpak.org/about/'
                target='_blank'
                rel='noreferrer'
              >
                {t('get-involved')}
              </a>
            </div>
            <div className={styles.footerItem}>
              <a
                href='https://discourse.flathub.org/'
                target='_blank'
                rel='noreferrer'
              >
                {t('forum')}
              </a>
            </div>
            <div className={styles.footerItem}>
              <a
                href='https://twitter.com/FlatpakApps'
                target='_blank'
                rel='noreferrer'
              >
                {t('follow-us')}
              </a>
            </div>
          </div>
        </div>

        <div className={styles.footerSection}>
          <div className={styles.footerTitle}>{t('developers')}</div>
          <div className={styles.footerItems}>
            <div className={styles.footerItem}>
              <a href='https://github.com/flathub/flathub/wiki/App-Submission'>
                {t('publish-your-app')}
              </a>
            </div>
            <div className={styles.footerItem}>
              <a href='http://docs.flatpak.org/'>{t('documentation')}</a>
            </div>
            <div className={styles.footerItem}>
              <a href='https://github.com/flathub/'>{t('example-build-files')}</a>
            </div>
            <div className={styles.footerItem}>
              <Link href='/badges'>{t('badges')}</Link>
            </div>
          </div>
        </div>

        <div className={styles.footerSection}>
          <div className={styles.footerTitle}>Flathub</div>
          <div className={styles.footerItems}>
            <div className={styles.footerItem}>
              <Link href='/about'>{t('about')}</Link>
            </div>
            <div className={styles.footerItem}>
              <Link href='/statistics'>{t('statistics')}</Link>
            </div>
            <div className={styles.footerItem}>
              <a
                href='https://github.com/flathub/frontend'
                target='_blank'
                rel='noreferrer'
              >
                {t('source-code')}
              </a>
            </div>
          </div>
        </div>

        {!IS_PRODUCTION && <div className={styles.footerSection}>
          <LoginStatus />
        </div>}
      </div>
    </footer>
  )
}

export default Footer
