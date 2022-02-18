import { NextSeo } from 'next-seo'
import { useRouter } from 'next/router'
import Collection from '../../../src/components/application/Collection'
import Main from '../../../src/components/layout/Main'
import { useSearchQuery } from '../../../src/hooks/useSearchQuery'

export default function Search() {
  const router = useRouter()
  const { query } = router.query

  const searchResult = useSearchQuery(query as string)

  return (
    <Main>
      <NextSeo title={`Search for ${query}`} />

      {searchResult && (
        <Collection
          title={`Search for '${query}'`}
          applications={searchResult}
        />
      )}
    </Main>
  )
}
