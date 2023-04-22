import Image from "../src/components/Image"
import CodeCopy from "../src/components/application/CodeCopy"
import { NextSeo } from "next-seo"
import cc0 from "/public/img/CC0.png"
import { GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { Trans, useTranslation } from "next-i18next"

const flathubBadge = "https://dl.flathub.org/assets/badges/flathub-badge-en.png"
const flathubBadgeInverted =
  "https://dl.flathub.org/assets/badges/flathub-badge-i-en.png"
const badgeExampleCode =
  "<a href='https://flathub.org/apps/org.gimp.GIMP'><img width='240' alt='Download on Flathub' src='https://dl.flathub.org/assets/badges/flathub-badge-en.png'/></a>"
const badgeExampleCodeMoinMoin =
  "[[https://flathub.org/apps/org.gimp.GIMP|{{https://dl.flathub.org/assets/badges/flathub-badge-en.png|Download on Flathub|width=240,align=middle}}]]"

const Badges = () => {
  const { t } = useTranslation()
  return (
    <>
      <NextSeo
        title={t("official-badges")}
        description={t("badges-description")}
      />
      <section className="max-w-11/12 mx-auto my-0 w-11/12 space-y-4 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <h1 className="my-8">{t("official-badges")}</h1>
        <p>{t("badges-block")}</p>

        <div className="flex w-full flex-wrap justify-around">
          <div>
            <h3>{t("preferred-badge")}</h3>
            <img
              width="240"
              height="80"
              alt="Download on Flathub"
              src={flathubBadge}
            />
            <h6 className="pt-2">
              <Trans i18nKey={"common:also-available-as-svg"}>
                Also available in{" "}
                <a
                  className="no-underline hover:underline"
                  href="https://dl.flathub.org/assets/badges/flathub-badge-en.svg"
                >
                  svg format
                </a>
              </Trans>
            </h6>
          </div>

          <div>
            <h3>{t("alternative-badge")}</h3>
            <img
              width="240"
              height="80"
              alt="Download on Flathub"
              src={flathubBadgeInverted}
            />
            <h6 className="pt-2">
              <Trans i18nKey={"common:also-available-as-svg"}>
                Also available in{" "}
                <a
                  className="no-underline hover:underline"
                  href="https://dl.flathub.org/assets/badges/flathub-badge-i-en.svg"
                >
                  svg format
                </a>
              </Trans>
            </h6>
          </div>
        </div>

        <p
          // this is a workaround for react not supporting it: https://github.com/facebook/react/issues/16563
          {...{
            "xmlns.dct": "http://purl.org/dc/terms/",
            "xmlns.vcard": "http://www.w3.org/2001/vcard-rdf/3.0#",
          }}
        >
          <a
            rel="license"
            href="http://creativecommons.org/publicdomain/zero/1.0/"
          >
            <Image src={cc0} alt="CC0" />
          </a>
          <br />
          <Trans i18nKey={"common:badge-copyright"}>
            To the extent possible under law,{" "}
            <a
              rel="dct:publisher"
              className="no-underline hover:underline"
              href="https://flathub.org/badges"
            >
              <span property="dct:title">Jakub Steiner</span>
            </a>{" "}
            has waived all copyright and related or neighboring rights to
            <span property="dct:title">Flathub Badges</span>. This work is
            published from: Czech Republic.
          </Trans>
        </p>

        <h2>{t("code-examples")}</h2>

        <div className="flex w-full flex-wrap justify-around">
          <div>
            <h3>HTML</h3>
            <CodeCopy
              className="min-h-[180px] max-w-xs"
              text={badgeExampleCode}
            ></CodeCopy>
            <a href="https://flathub.org/apps/org.gimp.GIMP">
              <Image
                width={240}
                height={80}
                alt="Download on Flathub"
                src={flathubBadge}
              />
            </a>
          </div>
          <div>
            <h3>MoinMoin Wiki</h3>
            <CodeCopy
              className="min-h-[180px] max-w-xs"
              text={badgeExampleCodeMoinMoin}
            ></CodeCopy>
            <a href="https://flathub.org/apps/org.gimp.GIMP">
              <img
                width={240}
                height={80}
                alt="Download on Flathub"
                src={flathubBadge}
              />
            </a>
          </div>
        </div>
      </section>
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
    },
  }
}

export default Badges
