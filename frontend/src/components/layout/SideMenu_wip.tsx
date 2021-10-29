import Link from 'next/link'

import { Category } from '../../types/Category'

import styles from './SideMenu.module.scss'

const SideMenu = () => (
  <aside>
    <section className={styles.sideMenuSection}>
      <h3>Discover</h3>
      <Link href='/apps/collection/popular' passHref>
        <span className='side-menu-link'>Popular</span>
      </Link>
      <Link href='/apps/collection/recently-updated' passHref>
        <span className='side-menu-link'>New &amp; Updated</span>
      </Link>
      <Link href='/apps/collection/editors-choice-apps' passHref>
        <span className='side-menu-link'>Editor&apos;s Choice</span>
      </Link>
      <Link href='/apps/collection/editors-choice-games' passHref>
        <span className='side-menu-link'>Editor&apos;s Choice Games</span>
      </Link>
    </section>
    <section className='side-menu-section'>
      <h3>Categories</h3>
      {Object.keys(Category).map((category) => (
        <Link href={`/apps/category/${category}`} key={category} passHref>
          <span className='side-menu-link'>{category}</span>
        </Link>
      ))}
    </section>
  </aside>
)
