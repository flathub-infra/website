import { getTranslations } from "next-intl/server"
import { Inter } from "next/font/google"
// We want to use the normal link here
import Link from "next/link"

const inter = Inter({
  subsets: ["latin"],
  fallback: ["sans-serif"],
})

export async function generateMetadata(params) {
  const { locale } = await params
  const t = await getTranslations()
  return {
    title: t("page-not-found", { errorCode: "404" }),
    openGraph: {
      url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/${locale}/404`,
    },
    robots: {
      index: false,
      follow: false,
    },
    other: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Surrogate-Control": "no-cache",
    },
  }
}

export default async function GlobalNotFound() {
  let t: any

  try {
    t = await getTranslations()
  } catch (error) {
    return (
      <html lang="en" className={inter.className}>
        <body>
          <div className="max-w-11/12 sm:w-max-1/2 mx-auto my-0 mt-12 w-11/12 sm:w-1/2 2xl:w-[900px] 2xl:max-w-[900px]">
            <h1 className="mb-8 text-4xl font-extrabold">
              404 - Page Not Found
            </h1>
            <p>The page you are looking for could not be found.</p>
            <p>
              <Link className="no-underline hover:underline" href="/">
                Go back to the home page
              </Link>
            </p>
          </div>
        </body>
      </html>
    )
  }

  return (
    <html className={inter.className}>
      <body>
        <div className="max-w-11/12 sm:w-max-1/2 mx-auto my-0 mt-12 w-11/12 sm:w-1/2 2xl:w-[900px] 2xl:max-w-[900px]">
          <h1 className="mb-8 text-4xl font-extrabold">
            {t("page-not-found", { errorCode: "404" })}
          </h1>
          <p>{t("could-not-find-page")}</p>
          <p>
            {t.rich("retry-or-go-home", {
              link: (chunk: any) => (
                <Link className="no-underline hover:underline" href="/">
                  {chunk}
                </Link>
              ),
            })}
          </p>
        </div>
      </body>
    </html>
  )
}
