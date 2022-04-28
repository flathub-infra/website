import { GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { Appstream } from "../../src/types/Appstream"
import { fetchCategory } from "../../src/fetchers"
import { APPS_IN_PREVIEW_COUNT } from "../../src/env"
import { NextSeo } from "next-seo"
import Link from "next/link"
import Tile from "../../src/components/Tile"
import { Category, categoryToName } from "../../src/types/Category"
import styles from "./index.module.scss"
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
      <div className="main-container">
        <header>
          <h3>{t("categories")}</h3>
        </header>
        <div className={styles.flex}>
          {Object.keys(Category).map((category: Category) => (
            <Link
              key={category}
              href={`/apps/category/${encodeURIComponent(category)}`}
              passHref
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

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  let topAppsByCategory: { category: string; apps: Appstream[] }[] = []

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
      ...(await serverSideTranslations(locale, ["common"])),
      topAppsByCategory,
    },
    revalidate: 3600,
  }
}
