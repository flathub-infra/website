import { Category } from '../../types/Category'
import CategoryCard from './Card'

const CategoriesList = () => (
  <div className='categories-section'>
    <header>
      <h3>Categories</h3>
    </header>
    <div className='categories'>
      <CategoryCard name='All' href='/apps/category/All' />
      <CategoryCard
        name='Audio & Video'
        href={`/apps/category/${Category.AudioVideo}`}
      />
      <CategoryCard
        name='Productivity'
        href={`/apps/category/${Category.Office}`}
      />
      <CategoryCard name='Games' href={`/apps/category/${Category.Game}`} />
      <CategoryCard
        name='Graphics'
        href={`/apps/category/${Category.Graphics}`}
      />
      <CategoryCard
        name='Social Networking'
        href={`/apps/category/${Category.Network}`}
      />
      <CategoryCard
        name='Education'
        href={`/apps/category/${Category.Education}`}
      />
    </div>
  </div>
)

export default CategoriesList
