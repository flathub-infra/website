import { GetStaticPaths, GetStaticProps } from "next"

export default function Projectgroup({}) {
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
          ? `/${locale}/apps/collection/project-group/${params.projectgroup}/1`
          : `/apps/collection/project-group/${params.projectgroup}/1`,
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
