import { getTranslations } from "next-intl/server"

export default async function NotFound() {
  let t: any
  try {
    t = await getTranslations()
  } catch (error) {
    // Fallback if translations are not available
    return (
      <div className="max-w-11/12 sm:w-max-1/2 mx-auto my-0 mt-12 w-11/12 sm:w-1/2 2xl:w-[900px] 2xl:max-w-[900px]">
        <h1 className="mb-8 text-4xl font-extrabold">404 - Page Not Found</h1>
        <p>The page you are looking for could not be found.</p>
        <p>
          <a className="no-underline hover:underline" href="/">
            Go back to the home page
          </a>
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-11/12 sm:w-max-1/2 mx-auto my-0 mt-12 w-11/12 sm:w-1/2 2xl:w-[900px] 2xl:max-w-[900px]">
      <h1 className="mb-8 text-4xl font-extrabold">
        {t("page-not-found", { errorCode: "404" })}
      </h1>
      <p>{t("could-not-find-page")}</p>
      <p>
        {t.rich("retry-or-go-home", {
          link: (chunk: any) => (
            <a className="no-underline hover:underline" href="/">
              {chunk}
            </a>
          ),
        })}
      </p>
    </div>
  )
}
