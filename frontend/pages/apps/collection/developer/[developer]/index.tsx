import { GetStaticPaths, GetStaticProps } from "next"

export default function Developer({}) {
  return <></>
}

export const getStaticProps: GetStaticProps = async ({
  locale,
  defaultLocale,
  params,
}: {
  locale: string
  defaultLocale: string
  params: { developer: string }
}) => {
  return {
    redirect: {
      destination:
        locale && locale !== defaultLocale
          ? `/${locale}/apps/collection/developer/${encodeURI(params.developer)}/1`
          : `/apps/collection/developer/${encodeURI(params.developer)}/1`,
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
