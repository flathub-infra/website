import { GetStaticPaths, GetStaticProps } from "next"

export default function Developer({}) {
  return <></>
}

export const getStaticProps: GetStaticProps = async ({
  locale,
  defaultLocale,
  params,
}) => {
  return {
    redirect: {
      destination:
        locale && locale !== defaultLocale
          ? `/${locale}/apps/collection/developer/${params.developer}/1`
          : `/apps/collection/developer/${params.developer}/1`,
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
