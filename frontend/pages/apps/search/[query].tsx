import { Trans, useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import { useRouter } from "next/router"
import Collection from "../../../src/components/application/Collection"
import { useSearchQuery } from "../../../src/hooks/useSearchQuery"

export default function Search() {
  const { t } = useTranslation()
  const router = useRouter()
  const { query } = router.query

  const searchResult = useSearchQuery(query as string)

  return (
    <>
      <NextSeo title={t("search-for-query", { query })} />

      {searchResult && searchResult.length > 0 && (
        <Collection
          title={t("search-for-query", { query })}
          applications={searchResult}
        />
      )}
      {!searchResult ||
        (searchResult.length === 0 && (
          <div className="main-container">
            <h2>{t("search-for-query", { query })}</h2>
            <p>{t("could-not-find-match-for-search")}</p>
            <p>
              <Trans i18nKey={"common:request-new-app"}>
                If you&apos;re searching for a specific application, let the
                community know, that you want it on flathub{" "}
                <a
                  target="_blank"
                  rel="noreferrer"
                  href="https://discourse.flathub.org/t/about-the-requests-category/22"
                >
                  here
                </a>
                .
              </Trans>
            </p>
          </div>
        ))}
    </>
  )
}

export async function getServerSideProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
    },
  }
}
