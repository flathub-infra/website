import {
  Popover,
  PopoverButton,
  PopoverBackdrop,
  PopoverPanel,
  Transition,
} from "@headlessui/react"
import { ChevronDownIcon } from "@heroicons/react/20/solid"
import { clsx } from "clsx"
import { Link, useRouter } from "src/i18n/navigation"
import { useMatomo } from "@mitresthen/matomo-tracker-react"
import CodeCopy from "./CodeCopy"
import { useTranslations } from "next-intl"

export default function InstallButton({
  appId,
  type = "normal",
}: {
  appId: string
  type?: "normal" | "addon"
}) {
  const t = useTranslations()

  const { trackEvent } = useMatomo()
  const { push } = useRouter()

  const installClicked = (e) => {
    e.preventDefault()
    trackEvent({ category: "App", action: "Install", name: appId })
    push(`/apps/${appId}/install`)
  }

  const flatpakInstallCopied = () => {
    trackEvent({
      category: "App",
      action: "InstallCmdCopied",
      name: appId ?? "unknown",
    })
  }

  const flatpakRunCopied = () => {
    trackEvent({
      category: "App",
      action: "RunCmdCopied",
      name: appId ?? "unknown",
    })
  }

  if (type === "addon") {
    return (
      <div className="inline-flex justify-end w-52 basis-1/2 rounded-md sm:w-32 md:w-40">
        <Popover as="div" className={clsx("block", "sm:relative")}>
          <PopoverBackdrop className="fixed inset-0 z-10 bg-black opacity-30" />
          <PopoverButton
            className={clsx(
              "transition-colors hover:bg-flathub-celestial-blue-dark dark:hover:bg-flathub-celestial-blue-light",
              "bg-flathub-celestial-blue text-gray-100 dark:bg-flathub-celestial-blue",
              "no-wrap flex h-11 items-center justify-center overflow-hidden text-ellipsis whitespace-nowrap rounded-lg px-5 py-2 text-center font-bold no-underline duration-500 hover:cursor-pointer shadow-xs",
              "w-full",
            )}
          >
            {t("install")}
          </PopoverButton>
          <Transition
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <PopoverPanel
              anchor="bottom end"
              className={clsx(
                "z-20 mt-2 rounded-xl bg-flathub-white px-4 pb-4 shadow-md dark:bg-flathub-arsenic sm:w-[450px]",
              )}
            >
              <h3 className="my-4 text-xl font-semibold">
                {t("addon-install-info")}
              </h3>
              <p>{t("addon-install-info-text")}</p>
              <h3 className="my-4 text-xl font-semibold">
                {t("manual-install")}
              </h3>
              <p>
                {t.rich("manual-install-instructions", {
                  distroguide: (chunks) => (
                    <Link
                      href="/setup/"
                      className="no-underline hover:underline"
                    >
                      {chunks}
                    </Link>
                  ),
                })}
              </p>
              <CodeCopy
                text={`flatpak install flathub ${appId}`}
                nested
                onCopy={flatpakInstallCopied}
              />
            </PopoverPanel>
          </Transition>
        </Popover>
      </div>
    )
  }

  return (
    <div className="inline-flex min-w-40 max-w-full flex-1 self-stretch rounded-lg sm:w-auto sm:flex-none">
      <Link
        rel="nofollow"
        href={`/apps/${appId}/install`}
        onClick={installClicked}
        className={clsx(
          "transition-colors hover:bg-flathub-celestial-blue-dark dark:hover:bg-flathub-celestial-blue-light",
          "bg-flathub-celestial-blue text-gray-100 dark:bg-flathub-celestial-blue",
          "flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-s-lg px-5 py-2 text-center font-bold no-underline [overflow-wrap:anywhere] shadow-xs",
          "focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flathub-celestial-blue",
        )}
      >
        {t("install")}
      </Link>
      <Popover as="div" className={clsx("block", "sm:relative")}>
        <PopoverBackdrop className="fixed inset-0 z-10 bg-black opacity-30" />
        <PopoverButton
          className={clsx(
            "transition-colors hover:bg-flathub-celestial-blue-dark dark:hover:bg-flathub-celestial-blue-light",
            "bg-flathub-celestial-blue text-gray-100 dark:bg-flathub-celestial-blue",
            "ms-px flex h-full min-h-11 min-w-11 items-center justify-center rounded-e-lg px-3 py-2 shadow-xs focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flathub-celestial-blue",
          )}
        >
          <span className="sr-only">{t("manual-install")}</span>
          <ChevronDownIcon className="size-5" aria-hidden="true" />
        </PopoverButton>
        <Transition
          enter="transition ease-out duration-100"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
        >
          <PopoverPanel
            anchor="bottom end"
            className={clsx(
              "z-20 mt-2 w-[min(450px,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl bg-flathub-white px-4 pb-4 shadow-md [--anchor-padding:1rem] dark:bg-flathub-arsenic",
            )}
          >
            <h3 className="my-4 text-xl font-semibold">
              {t("manual-install")}
            </h3>
            <p>
              {t.rich("manual-install-instructions", {
                distroguide: (chunks) => (
                  <Link href="/setup/" className="no-underline hover:underline">
                    {chunks}
                  </Link>
                ),
              })}
            </p>
            <CodeCopy
              text={`flatpak install flathub ${appId}`}
              nested
              onCopy={flatpakInstallCopied}
            />
            <h3 className="my-4 text-xl font-semibold">{t("run")}</h3>
            <CodeCopy
              text={`flatpak run ${appId}`}
              nested
              onCopy={flatpakRunCopied}
            />
          </PopoverPanel>
        </Transition>
      </Popover>
    </div>
  )
}
