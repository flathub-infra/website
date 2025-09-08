"use client"

import { useState } from "react"
import Image from "next/image"
import { useTranslations } from "next-intl"
import CodeCopy from "../../../src/components/application/CodeCopy"
import cc0 from "../../../public/img/CC0.png"
import { getLanguageName, languages } from "../../../src/localize"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { JSX } from "react"

const BadgePreview = ({
  locale,
  preferred,
}: {
  locale: string
  preferred: boolean
}) => {
  const t = useTranslations()

  const lightPostfix = preferred ? "" : "&light"

  return (
    <div>
      <h3 className="my-4 text-xl font-semibold">
        {t(preferred ? "preferred-badge" : "alternative-badge")}
      </h3>
      <Image
        priority
        width="240"
        height="80"
        alt="Get it on Flathub"
        src={`/api/badge?locale=${locale}${lightPostfix}`}
      />
      <h6 className="pt-2 text-xs font-normal">
        {t.rich("also-available-as-svg", {
          svglink: (chunk) => (
            <a
              className="no-underline hover:underline"
              href={`/api/badge?svg&locale=${locale}${lightPostfix}`}
            >
              {chunk}
            </a>
          ),
        })}
      </h6>
    </div>
  )
}

const BadgesClient = (): JSX.Element => {
  const t = useTranslations()
  const [locale, setLocale] = useState("en")

  const badgeExampleCode = `<a href='https://flathub.org/apps/org.gimp.GIMP'>
    <img width='240' alt='Get it on Flathub' src='${process.env.NEXT_PUBLIC_SITE_BASE_URI}/api/badge?locale=${locale}'/>
  </a>`
  const badgeExampleCodeMoinMoin = `[[https://flathub.org/apps/org.gimp.GIMP|{{${process.env.NEXT_PUBLIC_SITE_BASE_URI}/api/badge?locale=${locale}|Get it on Flathub|width=240,align=middle}}]]`

  return (
    <div className="flex max-w-full flex-col">
      <section className={`flex flex-col px-[5%] md:px-[20%] 2xl:px-[30%]`}>
        <h1 className="mt-8 mb-4 text-4xl font-extrabold">
          {t("official-badges")}
        </h1>
        <p>{t("badges-block")}</p>

        <div className="pt-8 flex flex-col w-full sm:flex-row sm:items-center gap-x-6 gap-y-4">
          <label htmlFor="language" className="w-48 font-semibold">
            {t("switch-language")}
          </label>
          <Select defaultValue="en" onValueChange={(value) => setLocale(value)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {languages.map((language) => (
                <SelectItem key={language} value={language}>
                  {getLanguageName(language)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex w-full flex-wrap justify-around pb-8 gap-6">
          <BadgePreview locale={locale} preferred />

          <BadgePreview locale={locale} preferred={false} />
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
            <Image priority src={cc0} alt="CC0" />
          </a>
          <br />
          {t.rich("badge-copyright", {
            author: (chunk) => (
              <a
                rel="dct:publisher"
                className="no-underline hover:underline"
                href="https://flathub.org/badges"
              >
                <span property="dct:title">{chunk}</span>
              </a>
            ),
            badgeslink: (chunk) => <span property="dct:title">{chunk}</span>,
          })}
        </p>

        <h2 className="mb-4 mt-12 text-2xl font-bold">{t("code-examples")}</h2>

        <div>
          <h3 className="pb-4 text-xl font-semibold">HTML</h3>
          <CodeCopy text={badgeExampleCode}></CodeCopy>
          <a href="https://flathub.org/apps/org.gimp.GIMP">
            <Image
              width={240}
              height={80}
              alt="Get it on Flathub"
              src={`/api/badge?locale=${locale}`}
            />
          </a>
        </div>
        <div>
          <h3 className="pt-8 pb-4 text-xl font-semibold">MoinMoin Wiki</h3>
          <CodeCopy text={badgeExampleCodeMoinMoin}></CodeCopy>
          <a href="https://flathub.org/apps/org.gimp.GIMP">
            <Image
              width={240}
              height={80}
              alt="Get it on Flathub"
              src={`/api/badge?locale=${locale}`}
            />
          </a>
        </div>
      </section>
    </div>
  )
}

export default BadgesClient
