import { Trans, useTranslation } from "next-i18next"
import { Appstream } from "src/types/Appstream"
import Link from "next/link"
import LogoImage from "src/components/LogoImage"

export default function InstallFallback({
  app,
}: {
  app: Pick<Appstream, "id" | "name" | "icon">
}) {
  const { t } = useTranslation()

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
              <Trans
                i18nKey={"common:download.fallback-instructions"}
                values={{ name: app.name }}
              >
                <div className="mb-8">
                  Opening &quot;{app.name}&quot; in your software manager...
                </div>
                <div className="mb-4">
                  If nothing happens, maybe your system does not support{" "}
                  <i>flatpak+https</i> urls.
                </div>
                <div className="mb-2">In that case you can:</div>
                <ol className="list-decimal list-inside pl-4">
                  <li>
                    Download the{" "}
                    <a
                      href={`https://dl.flathub.org/repo/appstream/${app.id}.flatpakref`}
                    >
                      .flatpakref file
                    </a>
                  </li>
                  <li>Then run it from your file manager</li>
                </ol>
                <div className="mt-4">
                  <Link href={"/setup"}>Instructions to install Flatpak</Link>
                </div>
              </Trans>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
