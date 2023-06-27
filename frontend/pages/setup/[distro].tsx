import { GetStaticPaths, GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import { useTranslation } from "next-i18next"
import Breadcrumbs from "src/components/Breadcrumbs"
import { fetchSetupInstructions } from "src/distro-setup"

export default function Setup({
  distroData,
}: {
  distroData: { name: string; logo: string; info: string; logo_dark?: string }
}) {
  const { t } = useTranslation()

  const pages = [
    {
      name: t("setup-flathub"),
      href: "/setup",
      current: false,
    },
    {
      name: distroData.name,
      href: `/setup/${encodeURIComponent(distroData.name)}`,
      current: true,
    },
  ]

  return (
    <>
      <NextSeo
        title={t("distrobution-flathub-setup", {
          distrobution: distroData.name,
        })}
        description={t("setup-flathub-description")}
      />
      <div className="max-w-11/12 mx-auto w-11/12 space-y-10 pt-4 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <div className="mx-auto max-w-2xl">
          <Breadcrumbs pages={pages} />
        </div>

        <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
          <div key={distroData.name} className="space-y-4">
            <h1>{distroData.name}</h1>
            <div
              dangerouslySetInnerHTML={{
                __html: distroData.info,
              }}
            />
          </div>
        </div>
      </div>
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({
  locale,
  params: { distro },
}) => {
  const instructions = await fetchSetupInstructions()

  const distroData = instructions.find(
    (instruction) => instruction.name === distro,
  )

  if (!distroData) {
    return {
      notFound: true,
    }
  }

  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      distroData,
    },
  }
}

export const getStaticPaths: GetStaticPaths = async ({ locales }) => {
  const instructions = await fetchSetupInstructions()

  const instructionUrl = instructions.map((instruction) => ({
    params: { distro: instruction.name },
  }))

  const paths = instructionUrl.reduce((acc, path) => {
    const curr = locales.map((locale) => ({
      ...path,
      locale,
    }))
    return [...acc, ...curr]
  }, [])

  return {
    paths,
    fallback: false,
  }
}
