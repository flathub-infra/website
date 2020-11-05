import CategoryCard from "./Card";
import Category from "./../../types/Category";

export default function CategoriesList() {
  return (
    <div className="categories-section">
      <header>
        <h3>Categories</h3>
      </header>
      <div className="categories">
        <CategoryCard
          name="Audio & Video"
          href={`/apps/category/${Category.AudioVideo}`}
        />
        <CategoryCard
          name="Productivity"
          href={`/apps/category/${Category.Office}`}
        />
        <CategoryCard name="Games" href={`/apps/category/${Category.Games}`} />
        <CategoryCard
          name="Graphics"
          href={`/apps/category/${Category.Graphics}`}
        />
        <CategoryCard
          name="Social Networking"
          href={`/apps/category/${Category.Network}`}
        />
        <CategoryCard
          name="Education"
          href={`/apps/category/${Category.Education}`}
        />
      </div>
    </div>
  );
}
