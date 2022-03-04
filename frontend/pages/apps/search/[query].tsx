import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { NextSeo } from 'next-seo'
import { useRouter } from 'next/router'
import Collection from '../../../src/components/application/Collection'
import Main from '../../../src/components/layout/Main'
import { useSearchQuery } from '../../../src/hooks/useSearchQuery'

export default function Search() {
  const { t } = useTranslation()
  const router = useRouter()
  const { query } = router.query

  const searchResult = useSearchQuery(query as string)

  return (
    <Main>
      <NextSeo title={t('search-for-query', { query })} />

      {searchResult && (
        <Collection
          title={t('search-for-query', { query })}
          applications={searchResult}
        />
      )}
    </Main>
  )
}

export async function getServerSideProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ['common'])),
    },
  }
}
