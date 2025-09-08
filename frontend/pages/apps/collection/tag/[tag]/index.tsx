import { GetStaticPaths, GetStaticProps } from "next"

export default function Tag({}) {
  return <></>
}

export const getStaticProps: GetStaticProps = async ({
  locale,
  defaultLocale,
  params,
}: {
  locale: string
  defaultLocale: string
  params: { tag: string }
}) => {
  return {
    redirect: {
      destination:
        locale && locale !== defaultLocale
          ? `/${locale}/apps/collection/tag/${encodeURI(params.tag)}/1`
          : `/apps/collection/tag/${encodeURI(params.tag)}/1`,
      permanent: true,
    },
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: "blocking",
  }
}
