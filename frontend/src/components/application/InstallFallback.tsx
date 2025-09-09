import { Appstream } from "src/types/Appstream"
import LogoImage from "src/components/LogoImage"
import { useTranslations } from "next-intl"
import { Link } from "src/i18n/navigation"

export default function InstallFallback({
  app,
}: {
  app: Pick<Appstream, "id" | "name" | "icon">
}) {
  const t = useTranslations()

  return (
    <div className="flex max-w-full flex-col">
      <section className={`flex flex-col px-[5%] md:px-[20%] 2xl:px-[30%]`}>
        <div>
          <h1 className="mt-8 mb-6 text-4xl font-extrabold">
            {t("download.install-x", { x: app.name })}
          </h1>
          <div className="flex gap-6">
            {app.icon && (
              <div className="relative m-2 flex h-[128px] min-w-[128px] drop-shadow-md">
                <LogoImage
                  iconUrl={app.icon}
                  appName={app.name}
                  quality={100}
                  priority
                />
              </div>
            )}
            <div>
              {t.rich("download.fallback-instructions", {
                name: app.name,
                i: (chunks) => <i>{chunks}</i>,
                ol: (chunks) => (
                  <ol className="list-decimal list-inside pl-4">{chunks}</ol>
                ),
                li: (chunks) => <li>{chunks}</li>,
                listPrefix: (chunks) => <div className="mb-2">{chunks}</div>,
                support: (chunks) => <div className="mb-4">{chunks}</div>,
                opening: (chunks) => <div className="mb-8">{chunks}</div>,
                link: (chunks) => (
                  <a
                    href={`https://dl.flathub.org/repo/appstream/${app.id}.flatpakref`}
                  >
                    {chunks}
                  </a>
                ),
                setupLine: (chunks) => <div className="mt-4">{chunks}</div>,
                linkSetup: (chunks) => <Link href="/setup">{chunks}</Link>,
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
