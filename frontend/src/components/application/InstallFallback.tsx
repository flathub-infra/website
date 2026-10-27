import LogoImage from "src/components/LogoImage"
import { useTranslations } from "next-intl"
import { Link } from "src/i18n/navigation"
import { GetAppstreamAppstreamAppIdGet200 } from "src/codegen"
import CodeCopy from "./CodeCopy"
import { Button } from "@/components/ui/button"
import {
  ArrowDownTrayIcon,
  ChevronDownIcon,
  CommandLineIcon,
} from "@heroicons/react/24/outline"

export default function InstallFallback({
  app,
}: {
  app: Pick<GetAppstreamAppstreamAppIdGet200, "id" | "name" | "icon">
}) {
  const t = useTranslations()

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col px-5 py-8 sm:py-12">
      <header className="flex items-center gap-4 sm:gap-6">
        {app.icon && (
          <div className="relative size-16 shrink-0 drop-shadow-md sm:size-24">
            <LogoImage
              iconUrl={app.icon}
              appName={app.name}
              quality={100}
              size={96}
              className="size-full"
              priority
            />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold leading-tight [overflow-wrap:anywhere] sm:text-3xl">
            {t("download.install-x", { x: app.name })}
          </h1>
        </div>
      </header>

      <div className="mt-5 flex min-w-0 flex-col gap-5 sm:mt-4">
        <p className="m-0 leading-6">{t("download.open-instructions")}</p>
        <Button
          asChild
          size="xl"
          className="h-auto min-h-12 w-full whitespace-normal bg-flathub-celestial-blue-dark text-center hover:bg-flathub-celestial-blue-dark/90 sm:w-fit"
        >
          <a
            href={`flatpak+https://dl.flathub.org/repo/appstream/${app.id}.flatpakref`}
          >
            {t("download.open-again")}
          </a>
        </Button>
        <p className="m-0 text-sm leading-6">
          {t.rich("manual-install-instructions", {
            distroguide: (chunks) => (
              <Link
                className="rounded-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-flathub-celestial-blue"
                href="/setup"
              >
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>

      <section className="mt-5 flex flex-col gap-2 border-t py-5">
        <a
          className="flex min-h-11 w-fit items-center gap-3 rounded-sm font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-flathub-celestial-blue"
          href={`https://dl.flathub.org/repo/appstream/${app.id}.flatpakref`}
        >
          <ArrowDownTrayIcon aria-hidden="true" className="size-5 shrink-0" />
          {t("download.download-file")}
        </a>
        <p className="m-0 text-sm leading-6">
          {t("download.file-description")}
        </p>
        <p className="m-0 text-sm leading-6">{t("download.open-file")}</p>
      </section>

      <details className="group min-w-0 border-t">
        <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 rounded-lg py-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-flathub-celestial-blue [&::-webkit-details-marker]:hidden">
          <CommandLineIcon aria-hidden="true" className="size-5 shrink-0" />
          <h2 className="flex-1 text-base font-semibold">
            {t("manual-install")}
          </h2>
          <ChevronDownIcon
            aria-hidden="true"
            className="size-5 shrink-0 group-open:rotate-180"
          />
        </summary>
        <div className="flex flex-col gap-3 pb-2">
          <p className="m-0 text-sm leading-6">
            {t("download.terminal-instructions")}
          </p>
          <CodeCopy
            className="mb-0"
            text={`flatpak install flathub ${app.id}`}
          />
        </div>
      </details>
    </div>
  )
}
