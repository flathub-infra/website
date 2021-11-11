import { Category, categoryToName } from '../../types/Category'
import CategoryCard from './Card'

const CategoriesList = () => (
  <div className='categories-section'>
    <header>
      <h3>Categories</h3>
    </header>
    <div className='categories'>
      <CategoryCard name='All' href='/apps/category/All' />
      <CategoryCard
        name={categoryToName(Category.AudioVideo)}
        href={`/apps/category/${Category.AudioVideo}`}
      />
      <CategoryCard
        name={categoryToName(Category.Office)}
        href={`/apps/category/${Category.Office}`}
      />
      <CategoryCard
        name={categoryToName(Category.Game)}
        href={`/apps/category/${Category.Game}`}
      />
      <CategoryCard
        name={categoryToName(Category.Graphics)}
        href={`/apps/category/${Category.Graphics}`}
      />
      <CategoryCard
        name={categoryToName(Category.Network)}
        href={`/apps/category/${Category.Network}`}
      />
      <CategoryCard
        name={categoryToName(Category.Education)}
        href={`/apps/category/${Category.Education}`}
      />
    </div>
  </div>
)

export default CategoriesList
