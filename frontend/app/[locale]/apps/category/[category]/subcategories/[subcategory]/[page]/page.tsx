import { Metadata } from "next";
import { notFound } from "next/navigation";
import { SortBy, MainCategory } from "../../../../../../../../src/codegen";
import { fetchSubcategory, fetchGameUtilityCategory } from "../../../../../../../../src/fetchers";
import { stringToCategory } from "../../../../../../../../src/types/Category";
import SubcategoryPageClient from "./subcategory-page-client";

interface Params {
  locale: string;
  category: string;
  subcategory: string;
  page: string;
}

interface Props {
  params: Params;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const mainCategory = params.category;
  const subcategory = params.subcategory;
  
  // Use categories mapping if it exists, or use the subcategory name directly
  let subcategoryI18nKey = subcategory;
  if (subcategory === "books-reference") {
    subcategoryI18nKey = "books";
  }
  
  return {
    title: `${subcategoryI18nKey} - ${mainCategory}`,
    description: `Browse ${subcategory} applications in the ${mainCategory} category`,
    alternates: {
      canonical: `/apps/category/${mainCategory}/subcategories/${subcategory}/1`,
    },
  };
}

const gameCategoryFilter = [
  "Game::ActionGame",
  "Game::AdventureGame",
  "Game::ArcadeGame",
  "Game::BoardGame",
  "Game::BlocksGame",
  "Game::CardGame",
  "Game::KidsGame",
  "Game::LogicGame",
  "Game::RolePlaying",
  "Game::Shooter",
  "Game::Simulation",
  "Game::SportsGame",
  "Game::StrategyGame",
];

export default async function SubcategoryPage({ params }: Props) {
  const { locale, category: mainCategoryString, subcategory, page: pageParam } = params;
  const page = parseInt(pageParam, 10);

  if (isNaN(page) || page < 1) {
    notFound();
  }

  const mainCategory = stringToCategory(mainCategoryString);
  if (!mainCategory) {
    notFound();
  }

  let applications;

  try {
    if (mainCategory === "game" && subcategory === "utilities") {
      applications = await fetchGameUtilityCategory(locale, page, 30);
    } else {
      applications = await fetchSubcategory(
        mainCategory,
        [subcategory],
        locale,
        page,
        30,
        mainCategory === "game" ? gameCategoryFilter : [],
        SortBy.trending,
      );
    }
  } catch (error) {
    console.error(`Error fetching subcategory ${subcategory} in ${mainCategoryString}:`, error);
    notFound();
  }

  if (page > applications.totalPages) {
    notFound();
  }

  return (
    <SubcategoryPageClient
      applications={applications}
      mainCategory={mainCategoryString}
      subcategory={subcategory}
      page={page}
    />
  );
}
