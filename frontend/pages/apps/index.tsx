import { GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { AppstreamListItem } from "../../src/types/Appstream"
import { fetchCategory } from "../../src/fetchers"
import { APPS_IN_PREVIEW_COUNT } from "../../src/env"
import { NextSeo } from "next-seo"
import Link from "next/link"
import Tile from "../../src/components/Tile"
import { Category, categoryToName } from "../../src/types/Category"
import ApplicationSection from "../../src/components/application/ApplicationSection"
import { useTranslation } from "next-i18next"

export default function Apps({ topAppsByCategory }) {
  const { t } = useTranslation()
  return (
    <>
      <NextSeo
        title={t("applications")}
        description={t("applications-description")}
      />
      <div className="max-w-11/12 my-0 mx-auto w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <header>
          <h3>{t("categories")}</h3>
        </header>
        <div className="grid grid-cols-[repeat(auto-fill,_minmax(125px,_1fr))] gap-2">
          {Object.keys(Category).map((category: Category) => (
            <Link
              key={category}
              href={`/apps/category/${encodeURIComponent(category)}`}
              passHref
              legacyBehavior
            >
              <Tile>{categoryToName(category, t)}</Tile>
            </Link>
          ))}
        </div>
        {topAppsByCategory.map((sectionData, i) => (
          <ApplicationSection
            key={`categorySection${i}`}
            href={`/apps/category/${encodeURIComponent(sectionData.category)}`}
            applications={sectionData.apps}
            title={categoryToName(sectionData.category, t)}
          ></ApplicationSection>
        ))}
      </div>
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({
  locale,
  defaultLocale,
}) => {
  let topAppsByCategory: { category: string; apps: AppstreamListItem[] }[] = []

  const categoryPromise = Object.keys(Category).map(
    async (category: Category) => {
      return {
        category,
        apps: await await fetchCategory(category, 1, APPS_IN_PREVIEW_COUNT),
      }
    },
  )

  topAppsByCategory = await Promise.all(categoryPromise)
  return {
    props: {
      ...(await serverSideTranslations(locale ?? defaultLocale, ["common"])),
      topAppsByCategory,
    },
    revalidate: 3600,
  }
}
