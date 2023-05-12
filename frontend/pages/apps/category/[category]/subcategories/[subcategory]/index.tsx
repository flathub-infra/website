import { GetStaticPaths, GetStaticProps } from "next"

export default function ApplicationSubcategory({}) {
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
          ? `/${locale}/apps/category/${params.category}/subcategories/${params.subcategory}/1`
          : `/apps/category/${params.category}/subcategories/${params.subcategory}/1`,
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
