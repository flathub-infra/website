import Link from 'next/link'
import Category from './../../types/Category'

export default function Sidebar() {
  return (
    <aside className='categories-sidebar'>
      <h4>Discover</h4>

      <Link href='/apps/collection/popular'>
        <div className='item'>Popular</div>
      </Link>

      <Link href='/apps/collection/recently-updated'>
        <div className='item'>New & Updated</div>
      </Link>

      <Link href='/apps/collection/editors-choice-apps'>
        <div className='item'>Editor's Choice</div>
      </Link>

      <Link href='/apps/collection/editors-choice-games'>
        <div className='item'>Editor's Choice Games</div>
      </Link>

      <hr />

      <h4>Categories</h4>
      <Link href={`/apps/category/All`}>
        <div className='item'>All</div>
      </Link>

      <Link href={`/apps/category/${Category.AudioVideo}`}>
        <div className='item'>Audio & Video</div>
      </Link>

      <Link href={`/apps/category/${Category.Development}`}>
        <div className='item'>Developer Tools</div>
      </Link>

      <Link href={`/apps/category/${Category.Education}`}>
        <div className='item'>Education</div>
      </Link>

      <Link href={`/apps/category/${Category.Games}`}>
        <div className='item'>Games</div>
      </Link>

      <Link href={`/apps/category/${Category.Graphics}`}>
        <div className='item'>Graphics & Photography</div>
      </Link>

      <Link href={`/apps/category/${Category.Network}`}>
        <div className='item'>Communication & News</div>
      </Link>

      <Link href={`/apps/category/${Category.Office}`}>
        <div className='item'>Productivity</div>
      </Link>

      <Link href={`/apps/category/${Category.Science}`}>
        <div className='item'>Science</div>
      </Link>

      <Link href={`/apps/category/${Category.Settings}`}>
        <div className='item'>Settings</div>
      </Link>

      <Link href={`/apps/category/${Category.System}`}>
        <div className='item'>System</div>
      </Link>

      <Link href={`/apps/category/${Category.Utility}`}>
        <div className='item'>Utilities</div>
      </Link>
    </aside>
  )
}
