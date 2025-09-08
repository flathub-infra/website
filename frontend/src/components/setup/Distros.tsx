import { useTranslations } from "next-intl"
import { HowToJsonLd } from "next-seo"
import CodeCopy from "src/components/application/CodeCopy"
import type { JSX } from "react"
import Image from "next/image"
import { Link } from "src/i18n/navigation"
import { motion } from "framer-motion"

export const distroMap = (locale: string) => {
  return new Map<string, JSX.Element>([
    ["Ubuntu", <Ubuntu locale={locale} />],
    ["Fedora", <Fedora locale={locale} />],
    ["Manjaro", <Manjaro locale={locale} />],
    ["Endless OS", <Endless_OS locale={locale} />],
    ["ALT Linux", <ALT_Linux locale={locale} />],
    ["Chrome OS", <Chrome_OS locale={locale} />],
    ["Red Hat Enterprise Linux", <Red_Hat_Enterprise_Linux locale={locale} />],
    ["Linux Mint", <Linux_Mint locale={locale} />],
    ["openSUSE", <OpenSUSE locale={locale} />],
    ["Arch", <Arch locale={locale} />],
    ["Debian", <Debian locale={locale} />],
    ["Rocky Linux", <Rocky_Linux locale={locale} />],
    ["CentOS", <CentOS_Stream locale={locale} />],
    ["AlmaLinux", <AlmaLinux locale={locale} />],
    ["Gentoo", <Gentoo locale={locale} />],
    ["Kubuntu", <Kubuntu locale={locale} />],
    ["Solus", <Solus locale={locale} />],
    ["Alpine", <Alpine locale={locale} />],
    ["Mageia", <Mageia locale={locale} />],
    ["OpenMandriva Lx", <OpenMandriva_Lx locale={locale} />],
    ["Pop!_OS", <Pop_OS locale={locale} />],
    ["elementary OS", <Elementary_OS locale={locale} />],
    ["Raspberry Pi OS", <Raspberry_Pi_OS locale={locale} />],
    ["Void Linux", <Void_Linux locale={locale} />],
    ["NixOS", <NixOS locale={locale} />],
    ["PureOS", <PureOS locale={locale} />],
    ["Zorin OS", <Zorin_OS locale={locale} />],
    ["Deepin", <Deepin locale={locale} />],
    ["Pardus", <Pardus locale={locale} />],
    ["MX Linux", <MX_Linux locale={locale} />],
    ["Pisi GNULinux", <Pisi_GNULinux locale={locale} />],
    ["EndeavourOS", <EndeavourOS locale={locale} />],
    ["KDE neon", <KDE_neon locale={locale} />],
    ["GNU Guix", <GNU_Guix locale={locale} />],
    ["Crystal Linux", <Crystal_Linux locale={locale} />],
    ["Vanilla OS", <Vanilla_OS locale={locale} />],
    ["Salix", <Salix locale={locale} />],
  ])
}

const Ubuntu = ({ locale }: { locale: string }) => {
  const t = useTranslations()
  return (
    <>
      <div className="flex flex-col items-center">
        <motion.picture layoutId="distro-logo-Ubuntu">
          <Image
            width={128}
            height={128}
            src={"/img/distro/ubuntu.svg"}
            alt="Ubuntu"
          />
        </motion.picture>
        <motion.h1 layoutId="distro-name-Ubuntu">
          {t("distros.ubuntu.distroName")}
        </motion.h1>
      </div>
      <ol className="distrotut">
        <HowToJsonLd
          useAppDir={true}
          name={t("distros.ubuntu.distroName")}
          image="https://flathub.org/img/distro/ubuntu.svg"
          estimatedCost={{ currency: "USD", value: "0" }}
          step={[
            {
              url: "https://flathub.org/setup/ubuntu",
              name: t("distros.ubuntu.step-1.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.ubuntu.step-1.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/ubuntu",
              name: t("distros.ubuntu.step-2.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.ubuntu.step-2.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/ubuntu",
              name: t("distros.ubuntu.step-3.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.ubuntu.step-3.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/ubuntu",
              name: t("distros.ubuntu.step-4.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.ubuntu.step-4.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
          ]}
        />

        <li>
          <h2>{t("distros.ubuntu.step-1.name")}</h2>
          {t.rich("distros.ubuntu.step-1.text", {
            text: (chunk) => <p>{chunk}</p>,
            strong: (chunk) => <strong>{chunk}</strong>,
            code: (chunk) => <CodeCopy text={`sudo apt install flatpak`} />,
          })}
        </li>

        <li>
          <h2>{t("distros.ubuntu.step-2.name")}</h2>
          {t.rich("distros.ubuntu.step-2.text", {
            text: (chunk) => <p>{chunk}</p>,
            code: (chunk) => (
              <CodeCopy
                text={`sudo apt install gnome-software-plugin-flatpak`}
              />
            ),
            strong: (chunk) => <strong>{chunk}</strong>,
          })}
        </li>

        <li>
          <h2>{t("distros.ubuntu.step-3.name")}</h2>
          {t.rich("distros.ubuntu.step-3.text", {
            text: (chunk) => <p>{chunk}</p>,
            code: (chunk) => (
              <CodeCopy
                text={
                  "flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo"
                }
              />
            ),
          })}
        </li>

        <li>
          <h2>{t("distros.ubuntu.step-4.name")}</h2>
          {t.rich("distros.ubuntu.step-4.text", {
            text: (chunk) => <p>{chunk}</p>,
            link: (chunk) => <Link href="/.">{chunk}</Link>,
          })}
        </li>
      </ol>
    </>
  )
}

const Fedora = ({ locale }: { locale: string }) => {
  const t = useTranslations()
  return (
    <>
      <div className="flex flex-col items-center">
        <motion.picture layoutId="distro-logo-Fedora">
          <Image
            width={128}
            height={128}
            src={"/img/distro/fedora.svg"}
            alt="Fedora"
          />
        </motion.picture>
        <motion.h1 layoutId="distro-name-Fedora">
          {t("distros.fedora.distroName")}
        </motion.h1>
      </div>
      <ol className="distrotut">
        {t.rich("distros.fedora.introduction", {
          text: (chunk) => <p>{chunk}</p>,
          repolink: (chunk) => (
            <a href="https://docs.fedoraproject.org/en-US/workstation-working-group/third-party-repos/">
              {chunk}
            </a>
          ),
          filelink: (chunk) => (
            <a href="https://dl.flathub.org/repo/flathub.flatpakrepo">
              {chunk}
            </a>
          ),
          applink: (chunk) => <Link href="/.">{chunk}</Link>,
          code: (chunk) => (
            <CodeCopy
              text={`flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo`}
            />
          ),
        })}
      </ol>
    </>
  )
}

const Manjaro = ({ locale }: { locale: string }) => {
  const t = useTranslations()
  return (
    <>
      <div className="flex flex-col items-center">
        <motion.picture layoutId="distro-logo-Manjaro">
          <Image
            width={128}
            height={128}
            src={"/img/distro/manjaro.svg"}
            alt="Manjaro"
          />
        </motion.picture>
        <motion.h1 layoutId="distro-name-Manjaro">
          {t("distros.manjaro.distroName")}
        </motion.h1>
      </div>
      <ol className="distrotut">
        <HowToJsonLd
          useAppDir={true}
          name={t("distros.manjaro.distroName")}
          image="https://flathub.org/img/distro/manjaro.svg"
          estimatedCost={{ currency: "USD", value: "0" }}
          step={[
            {
              url: "https://flathub.org/setup/manjaro",
              name: t("distros.manjaro.step-1.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.manjaro.step-1.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/manjaro",
              name: t("distros.manjaro.step-2.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.manjaro.step-2.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
          ]}
        />

        <li>
          <h2>{t("distros.manjaro.step-1.name")}</h2>
          {t.rich("distros.manjaro.step-1.text", {
            text: (chunk) => <p>{chunk}</p>,
            strong: (chunk) => <strong>{chunk}</strong>,
          })}
        </li>

        <li>
          <h2>{t("distros.manjaro.step-2.name")}</h2>
          {t.rich("distros.manjaro.step-2.text", {
            text: (chunk) => <p>{chunk}</p>,
            link: (chunk) => <Link href="/.">{chunk}</Link>,
          })}
        </li>
      </ol>
    </>
  )
}

const Endless_OS = ({ locale }: { locale: string }) => {
  const t = useTranslations()
  return (
    <>
      <div className="flex flex-col items-center">
        <motion.picture layoutId="distro-logo-Endless-OS">
          <Image
            width={128}
            height={128}
            src={"/img/distro/endless.svg"}
            alt="Endless OS"
          />
        </motion.picture>
        <motion.h1 layoutId="distro-name-Endless-OS">
          {t("distros.endless_os.distroName")}
        </motion.h1>
      </div>
      <ol className="distrotut">
        {t.rich("distros.endless_os.introduction", {
          text: (chunk) => <h2>{chunk}</h2>,
        })}
      </ol>
    </>
  )
}

const ALT_Linux = ({ locale }: { locale: string }) => {
  const t = useTranslations()
  return (
    <>
      <div className="flex flex-col items-center">
        <motion.picture layoutId="distro-logo-ALT-Linux">
          <source
            srcSet={"/img/distro/altlinux-dark.svg"}
            media="(prefers-color-scheme: dark)"
          />
          <Image
            width={128}
            height={128}
            src={"/img/distro/altlinux.svg"}
            alt="ALT Linux"
          />
        </motion.picture>
        <motion.h1 layoutId="distro-name-ALT-Linux">
          {t("distros.alt_linux.distroName")}
        </motion.h1>
      </div>
      <ol className="distrotut">
        <HowToJsonLd
          useAppDir={true}
          name={t("distros.alt_linux.distroName")}
          image="https://flathub.org/img/distro/altlinux.svg"
          estimatedCost={{ currency: "USD", value: "0" }}
          step={[
            {
              url: "https://flathub.org/setup/alt_linux",
              name: t("distros.alt_linux.step-1.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.alt_linux.step-1.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/alt_linux",
              name: t("distros.alt_linux.step-2.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.alt_linux.step-2.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/alt_linux",
              name: t("distros.alt_linux.step-3.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.alt_linux.step-3.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
          ]}
        />

        <li>
          <h2>{t("distros.alt_linux.step-1.name")}</h2>
          {t.rich("distros.alt_linux.step-1.text", {
            text: (chunk) => <p>{chunk}</p>,
            code: (chunk) => (
              <CodeCopy
                text={`su -
 apt-get update
 apt-get install flatpak`}
              />
            ),
          })}
        </li>

        <li>
          <h2>{t("distros.alt_linux.step-2.name")}</h2>
          {t.rich("distros.alt_linux.step-2.text", {
            text: (chunk) => <p>{chunk}</p>,
            code: (chunk) => (
              <CodeCopy
                text={`su -
 apt-get update
 apt-get install flatpak-repo-flathub`}
              />
            ),
          })}
        </li>

        <li>
          <h2>{t("distros.alt_linux.step-3.name")}</h2>
          {t.rich("distros.alt_linux.step-3.text", {
            text: (chunk) => <p>{chunk}</p>,
            link: (chunk) => <Link href={"./"}>{chunk}</Link>,
          })}
        </li>
      </ol>
    </>
  )
}

const Chrome_OS = ({ locale }: { locale: string }) => {
  const t = useTranslations()
  return (
    <>
      <div className="flex flex-col items-center">
        <motion.picture layoutId="distro-logo-Chrome-OS">
          <Image
            width={128}
            height={128}
            src={"/img/distro/chrome-os.svg"}
            alt="Chrome OS"
          />
        </motion.picture>
        <motion.h1 layoutId="distro-name-Chrome-OS">
          {t("distros.chrome_os.distroName")}
        </motion.h1>
      </div>
      <ol className="distrotut">
        <HowToJsonLd
          useAppDir={true}
          name={t("distros.chrome_os.distroName")}
          image="https://flathub.org/img/distro/chrome-os.svg"
          estimatedCost={{ currency: "USD", value: "0" }}
          step={[
            {
              url: "https://flathub.org/setup/chrome_os",
              name: t("distros.chrome_os.step-1.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.chrome_os.step-1.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/chrome_os",
              name: t("distros.chrome_os.step-2.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.chrome_os.step-2.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/chrome_os",
              name: t("distros.chrome_os.step-3.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.chrome_os.step-3.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/chrome_os",
              name: t("distros.chrome_os.step-4.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.chrome_os.step-4.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/chrome_os",
              name: t("distros.chrome_os.step-5.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.chrome_os.step-5.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
          ]}
        />

        {t.rich("distros.chrome_os.introduction", {
          text: (chunk) => <p>{chunk}</p>,
          link: (chunk) => (
            <a href="https://www.reddit.com/r/Crostini/wiki/getstarted/crostini-enabled-devices">
              {chunk}
            </a>
          ),
        })}
        <li>
          <h2>{t("distros.chrome_os.step-1.name")}</h2>
          {t.rich("distros.chrome_os.step-1.text", {
            text: (chunk) => <p>{chunk}</p>,
            settingslink: (chunk) => (
              <a href="chrome://os-settings">chrome://os-settings</a>
            ),
            strong: (chunk) => <strong>{chunk}</strong>,
            em: (chunk) => <em>{chunk}</em>,
          })}
        </li>

        <li>
          <h2>{t("distros.chrome_os.step-2.name")}</h2>
          {t.rich("distros.chrome_os.step-2.text", {
            text: (chunk) => <p>{chunk}</p>,
          })}
        </li>

        <li>
          <h2>{t("distros.chrome_os.step-3.name")}</h2>
          {t.rich("distros.chrome_os.step-3.text", {
            text: (chunk) => <p>{chunk}</p>,
            code: (chunk) => <CodeCopy text={"sudo apt install flatpak"} />,
          })}
        </li>

        <li>
          <h2>{t("distros.chrome_os.step-4.name")}</h2>
          {t.rich("distros.chrome_os.step-4.text", {
            text: (chunk) => <p>{chunk}</p>,
            code: (chunk) => (
              <CodeCopy
                text={
                  "flatpak --user remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo"
                }
              />
            ),
          })}
        </li>

        <li>
          <h2>{t("distros.chrome_os.step-5.name")}</h2>
          {t.rich("distros.chrome_os.step-5.text", {
            text: (chunk) => <p>{chunk}</p>,
            link: (chunk) => <Link href={"./"}>{chunk}</Link>,
          })}
        </li>
      </ol>
    </>
  )
}

const Red_Hat_Enterprise_Linux = ({ locale }: { locale: string }) => {
  const t = useTranslations()
  return (
    <>
      <div className="flex flex-col items-center">
        <motion.picture layoutId="distro-logo-Red-Hat-Enterprise-Linux">
          <Image
            width={128}
            height={128}
            src={"/img/distro/redhat.svg"}
            alt="Red Hat Enterprise Linux"
          />
        </motion.picture>
        <motion.h1 layoutId="distro-name-Red-Hat-Enterprise-Linux">
          {t("distros.red_hat_enterprise_linux.distroName")}
        </motion.h1>
      </div>
      <ol className="distrotut">
        {t.rich("distros.red_hat_enterprise_linux.introduction", {
          text: (chunk) => <p>{chunk}</p>,
          filelink: (chunk) => (
            <a href="https://dl.flathub.org/repo/flathub.flatpakrepo">
              {chunk}
            </a>
          ),
          code: (chunk) => <CodeCopy text={"sudo yum install flatpak"} />,
          codeAddRemote: (chunk) => (
            <CodeCopy
              text={
                "flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo"
              }
            />
          ),
          link: (chunk) => <Link href={"/."}>{chunk}</Link>,
        })}
      </ol>
    </>
  )
}

const Linux_Mint = ({ locale }: { locale: string }) => {
  const t = useTranslations()
  return (
    <>
      <div className="flex flex-col items-center">
        <motion.picture layoutId="distro-logo-Linux-Mint">
          <Image
            width={128}
            height={128}
            src={"/img/distro/mint.svg"}
            alt="Linux Mint"
          />
        </motion.picture>
        <motion.h1 layoutId="distro-name-Linux-Mint">
          {t("distros.linux_mint.distroName")}
        </motion.h1>
      </div>
      <ol className="distrotut">
        {t.rich("distros.linux_mint.introduction", {
          text: (chunk) => <h2>{chunk}</h2>,
        })}
      </ol>
    </>
  )
}

const OpenSUSE = ({ locale }: { locale: string }) => {
  const t = useTranslations()
  return (
    <>
      <div className="flex flex-col items-center">
        <motion.picture layoutId="distro-logo-openSUSE">
          <Image
            width={128}
            height={128}
            src={"/img/distro/opensuse.svg"}
            alt="openSUSE"
          />
        </motion.picture>
        <motion.h1 layoutId="distro-name-openSUSE">
          {t("distros.opensuse.distroName")}
        </motion.h1>
      </div>
      <ol className="distrotut">
        <HowToJsonLd
          useAppDir={true}
          name={t("distros.opensuse.distroName")}
          image="https://flathub.org/img/distro/opensuse.svg"
          estimatedCost={{ currency: "USD", value: "0" }}
          step={[
            {
              url: "https://flathub.org/setup/opensuse",
              name: t("distros.opensuse.step-1.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.opensuse.step-1.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/opensuse",
              name: t("distros.opensuse.step-2.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.opensuse.step-2.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/opensuse",
              name: t("distros.opensuse.step-3.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.opensuse.step-3.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
          ]}
        />

        <li>
          <h2>{t("distros.opensuse.step-1.name")}</h2>
          {t.rich("distros.opensuse.step-1.text", {
            text: (chunk) => <p>{chunk}</p>,
            link: (chunk) => (
              <a href="https://software.opensuse.org/package/flatpak">
                software.opensuse.org
              </a>
            ),
            em: (chunk) => <em>{chunk}</em>,
            code: (chunk) => <CodeCopy text={"sudo zypper install flatpak"} />,
          })}
        </li>

        <li>
          <h2>{t("distros.opensuse.step-2.name")}</h2>
          {t.rich("distros.opensuse.step-2.text", {
            text: (chunk) => <p>{chunk}</p>,
            code: (chunk) => (
              <CodeCopy
                text={
                  "flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo"
                }
              />
            ),
          })}
        </li>

        <li>
          <h2>{t("distros.opensuse.step-3.name")}</h2>
          {t.rich("distros.opensuse.step-3.text", {
            text: (chunk) => <p>{chunk}</p>,
            link: (chunk) => <Link href={"./"}>{chunk}</Link>,
          })}
        </li>
      </ol>
    </>
  )
}

const Arch = ({ locale }: { locale: string }) => {
  const t = useTranslations()
  return (
    <>
      <div className="flex flex-col items-center">
        <motion.picture layoutId="distro-logo-Arch">
          <Image
            width={128}
            height={128}
            src={"/img/distro/arch.svg"}
            alt="Arch"
          />
        </motion.picture>
        <motion.h1 layoutId="distro-name-Arch">
          {t("distros.arch.distroName")}
        </motion.h1>
      </div>
      <ol className="distrotut">
        <HowToJsonLd
          useAppDir={true}
          name={t("distros.arch.distroName")}
          image="https://flathub.org/img/distro/arch.svg"
          estimatedCost={{ currency: "USD", value: "0" }}
          step={[
            {
              url: "https://flathub.org/setup/arch",
              name: t("distros.arch.step-1.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.arch.step-1.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/arch",
              name: t("distros.arch.step-2.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.arch.step-2.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
          ]}
        />

        <li>
          <h2>{t("distros.arch.step-1.name")}</h2>
          {t.rich("distros.arch.step-1.text", {
            text: (chunk) => <p>{chunk}</p>,
            code: (chunk) => <CodeCopy text={"sudo pacman -S flatpak"} />,
          })}
        </li>

        <li>
          <h2>{t("distros.arch.step-2.name")}</h2>
          {t.rich("distros.arch.step-2.text", {
            text: (chunk) => <p>{chunk}</p>,
            link: (chunk) => <Link href={"./"}>{chunk}</Link>,
          })}
        </li>
      </ol>
    </>
  )
}

const Debian = ({ locale }: { locale: string }) => {
  const t = useTranslations()
  return (
    <>
      <div className="flex flex-col items-center">
        <motion.picture layoutId="distro-logo-Debian">
          <Image
            width={128}
            height={128}
            src={"/img/distro/debian.svg"}
            alt="Debian"
          />
        </motion.picture>
        <motion.h1 layoutId="distro-name-Debian">
          {t("distros.debian.distroName")}
        </motion.h1>
      </div>
      <ol className="distrotut">
        <HowToJsonLd
          useAppDir={true}
          name={t("distros.debian.distroName")}
          image="https://flathub.org/img/distro/debian.svg"
          estimatedCost={{ currency: "USD", value: "0" }}
          step={[
            {
              url: "https://flathub.org/setup/debian",
              name: t("distros.debian.step-1.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.debian.step-1.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/debian",
              name: t("distros.debian.step-2.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.debian.step-2.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/debian",
              name: t("distros.debian.step-3.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.debian.step-3.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/debian",
              name: t("distros.debian.step-4.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.debian.step-4.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
          ]}
        />

        <li>
          <h2>{t("distros.debian.step-1.name")}</h2>
          {t.rich("distros.debian.step-1.text", {
            text: (chunk) => <p>{chunk}</p>,
            code: (chunk) => <CodeCopy text={"sudo apt install flatpak"} />,
          })}
        </li>

        <li>
          <h2>{t("distros.debian.step-2.name")}</h2>
          {t.rich("distros.debian.step-2.text", {
            text: (chunk) => <p>{chunk}</p>,
            code: (chunk) => (
              <CodeCopy
                text={"sudo apt install gnome-software-plugin-flatpak"}
              />
            ),
            codeDiscover: (chunk) => (
              <CodeCopy
                text={"sudo apt install plasma-discover-backend-flatpak"}
              />
            ),
          })}
        </li>

        <li>
          <h2>{t("distros.debian.step-3.name")}</h2>
          {t.rich("distros.debian.step-3.text", {
            text: (chunk) => <p>{chunk}</p>,
            filelink: (chunk) => (
              <a href="https://dl.flathub.org/repo/flathub.flatpakrepo">
                {chunk}
              </a>
            ),
            code: (chunk) => (
              <CodeCopy
                text={
                  "flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo"
                }
              />
            ),
          })}
        </li>

        <li>
          <h2>{t("distros.debian.step-4.name")}</h2>
          {t.rich("distros.debian.step-4.text", {
            text: (chunk) => <p>{chunk}</p>,
            link: (chunk) => <Link href={"./"}>{chunk}</Link>,
          })}
        </li>
      </ol>
    </>
  )
}

const Rocky_Linux = ({ locale }: { locale: string }) => {
  const t = useTranslations()
  return (
    <>
      <div className="flex flex-col items-center">
        <motion.picture layoutId="distro-logo-Rocky-Linux">
          <Image
            width={128}
            height={128}
            src={"/img/distro/rockylinux.svg"}
            alt="Rocky Linux"
          />
        </motion.picture>
        <motion.h1 layoutId="distro-name-Rocky-Linux">
          {t("distros.rocky_linux.distroName")}
        </motion.h1>
      </div>
      <ol className="distrotut">
        <HowToJsonLd
          useAppDir={true}
          name={t("distros.rocky_linux.distroName")}
          image="https://flathub.org/img/distro/rockylinux.svg"
          estimatedCost={{ currency: "USD", value: "0" }}
          step={[
            {
              url: "https://flathub.org/setup/rocky_linux",
              name: t("distros.rocky_linux.step-1.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.rocky_linux.step-1.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/rocky_linux",
              name: t("distros.rocky_linux.step-2.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.rocky_linux.step-2.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/rocky_linux",
              name: t("distros.rocky_linux.step-3.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.rocky_linux.step-3.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
          ]}
        />

        <li>
          <h2>{t("distros.rocky_linux.step-1.name")}</h2>
          {t.rich("distros.rocky_linux.step-1.text", {
            text: (chunk) => <p>{chunk}</p>,
            code: (chunk) => <CodeCopy text={"sudo dnf install flatpak"} />,
          })}
        </li>

        <li>
          <h2>{t("distros.rocky_linux.step-2.name")}</h2>
          {t.rich("distros.rocky_linux.step-2.text", {
            text: (chunk) => <p>{chunk}</p>,
            filelink: (chunk) => (
              <a href="https://dl.flathub.org/repo/flathub.flatpakrepo">
                {chunk}
              </a>
            ),
            code: (chunk) => (
              <CodeCopy
                text={
                  "flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo"
                }
              />
            ),
          })}
        </li>

        <li>
          <h2>{t("distros.rocky_linux.step-3.name")}</h2>
          {t.rich("distros.rocky_linux.step-3.text", {
            text: (chunk) => <p>{chunk}</p>,
            link: (chunk) => <Link href={"./"}>{chunk}</Link>,
          })}
        </li>
      </ol>
    </>
  )
}

const CentOS_Stream = ({ locale }: { locale: string }) => {
  const t = useTranslations()
  return (
    <>
      <div className="flex flex-col items-center">
        <motion.picture layoutId="distro-logo-CentOS">
          <Image
            width={128}
            height={128}
            src={"/img/distro/centos.svg"}
            alt="CentOS Stream"
          />
        </motion.picture>
        <motion.h1 layoutId="distro-name-CentOS">
          {t("distros.centos.distroName")}
        </motion.h1>
      </div>
      <ol className="distrotut">
        {t.rich("distros.centos.introduction", {
          text: (chunk) => <p>{chunk}</p>,
          filelink: (chunk) => (
            <a href="https://dl.flathub.org/repo/flathub.flatpakrepo">
              {chunk}
            </a>
          ),
          link: (chunk) => <Link href="./">{chunk}</Link>,
        })}
      </ol>
    </>
  )
}

const AlmaLinux = ({ locale }: { locale: string }) => {
  const t = useTranslations()
  return (
    <>
      <div className="flex flex-col items-center">
        <motion.picture layoutId="distro-logo-AlmaLinux">
          <Image
            width={128}
            height={128}
            src={"/img/distro/almalinux.svg"}
            alt="AlmaLinux"
          />
        </motion.picture>
        <motion.h1 layoutId="distro-name-AlmaLinux">
          {t("distros.almalinux.distroName")}
        </motion.h1>
      </div>
      <ol className="distrotut">
        {t.rich("distros.almalinux.introduction", {
          text: (chunk) => <p>{chunk}</p>,
          filelink: (chunk) => (
            <a href="https://dl.flathub.org/repo/flathub.flatpakrepo">
              {chunk}
            </a>
          ),
          link: (chunk) => <Link href="./">{chunk}</Link>,
        })}
      </ol>
    </>
  )
}

const Gentoo = ({ locale }: { locale: string }) => {
  const t = useTranslations()
  return (
    <>
      <div className="flex flex-col items-center">
        <motion.picture layoutId="distro-logo-Gentoo">
          <Image
            width={128}
            height={128}
            src={"/img/distro/gentoo.svg"}
            alt="Gentoo"
          />
        </motion.picture>
        <motion.h1 layoutId="distro-name-Gentoo">
          {t("distros.gentoo.distroName")}
        </motion.h1>
      </div>
      <ol className="distrotut">
        <HowToJsonLd
          useAppDir={true}
          name={t("distros.gentoo.distroName")}
          image="https://flathub.org/img/distro/gentoo.svg"
          estimatedCost={{ currency: "USD", value: "0" }}
          step={[
            {
              url: "https://flathub.org/setup/gentoo",
              name: t("distros.gentoo.step-1.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.gentoo.step-1.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/gentoo",
              name: t("distros.gentoo.step-2.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.gentoo.step-2.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/gentoo",
              name: t("distros.gentoo.step-3.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.gentoo.step-3.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
          ]}
        />

        <li>
          <h2>{t("distros.gentoo.step-1.name")}</h2>
          {t.rich("distros.gentoo.step-1.text", {
            text: (chunk) => <p>{chunk}</p>,
            code: (chunk) => (
              <CodeCopy text={"emerge --ask --verbose sys-apps/flatpak"} />
            ),
          })}
        </li>

        <li>
          <h2>{t("distros.gentoo.step-2.name")}</h2>
          {t.rich("distros.gentoo.step-2.text", {
            text: (chunk) => <p>{chunk}</p>,
            code: (chunk) => (
              <CodeCopy
                text={
                  "flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo"
                }
              />
            ),
          })}
        </li>

        <li>
          <h2>{t("distros.gentoo.step-3.name")}</h2>
          {t.rich("distros.gentoo.step-3.text", {
            text: (chunk) => <p>{chunk}</p>,
            link: (chunk) => <Link href="./">{chunk}</Link>,
          })}
        </li>
      </ol>
    </>
  )
}

const Kubuntu = ({ locale }: { locale: string }) => {
  const t = useTranslations()
  return (
    <>
      <div className="flex flex-col items-center">
        <motion.picture layoutId="distro-logo-Kubuntu">
          <Image
            width={128}
            height={128}
            src={"/img/distro/kubuntu.svg"}
            alt="Kubuntu"
          />
        </motion.picture>
        <motion.h1 layoutId="distro-name-Kubuntu">
          {t("distros.kubuntu.distroName")}
        </motion.h1>
      </div>
      <ol className="distrotut">
        <HowToJsonLd
          useAppDir={true}
          name={t("distros.kubuntu.distroName")}
          image="https://flathub.org/img/distro/kubuntu.svg"
          estimatedCost={{ currency: "USD", value: "0" }}
          step={[
            {
              url: "https://flathub.org/setup/kubuntu",
              name: t("distros.kubuntu.step-1.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.kubuntu.step-1.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/kubuntu",
              name: t("distros.kubuntu.step-2.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.kubuntu.step-2.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/kubuntu",
              name: t("distros.kubuntu.step-3.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.kubuntu.step-3.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/kubuntu",
              name: t("distros.kubuntu.step-4.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.kubuntu.step-4.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
          ]}
        />

        <li>
          <h2>{t("distros.kubuntu.step-1.name")}</h2>
          {t.rich("distros.kubuntu.step-1.text", {
            text: (chunk) => <p>{chunk}</p>,
          })}
        </li>

        <li>
          <h2>{t("distros.kubuntu.step-2.name")}</h2>
          {t.rich("distros.kubuntu.step-2.text", {
            text: (chunk) => <p>{chunk}</p>,
            code: (chunk) => (
              <CodeCopy text={"sudo apt install kde-config-flatpak"} />
            ),
          })}
        </li>

        <li>
          <h2>{t("distros.kubuntu.step-3.name")}</h2>
          {t.rich("distros.kubuntu.step-3.text", {
            text: (chunk) => <p>{chunk}</p>,
          })}
        </li>

        <li>
          <h2>{t("distros.kubuntu.step-4.name")}</h2>
          {t.rich("distros.kubuntu.step-4.text", {
            text: (chunk) => <p>{chunk}</p>,
            link: (chunk) => <Link href="./">{chunk}</Link>,
          })}
        </li>
      </ol>
    </>
  )
}

const Solus = ({ locale }: { locale: string }) => {
  const t = useTranslations()
  return (
    <>
      <div className="flex flex-col items-center">
        <motion.picture layoutId="distro-logo-Solus">
          <Image
            width={128}
            height={128}
            src={"/img/distro/solus.svg"}
            alt="Solus"
          />
        </motion.picture>
        <motion.h1 layoutId="distro-name-Solus">
          {t("distros.solus.distroName")}
        </motion.h1>
      </div>
      <ol className="distrotut">
        <HowToJsonLd
          useAppDir={true}
          name={t("distros.solus.distroName")}
          image="https://flathub.org/img/distro/solus.svg"
          estimatedCost={{ currency: "USD", value: "0" }}
          step={[
            {
              url: "https://flathub.org/setup/solus",
              name: t("distros.solus.step-1.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.solus.step-1.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/solus",
              name: t("distros.solus.step-2.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.solus.step-2.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/solus",
              name: t("distros.solus.step-3.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.solus.step-3.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
          ]}
        />

        {t.rich("distros.solus.introduction", {
          text: (chunk) => <p>{chunk}</p>,
        })}
        <li>
          <h2>{t("distros.solus.step-1.name")}</h2>
          {t.rich("distros.solus.step-1.text", {
            text: (chunk) => <p>{chunk}</p>,
            code: (chunk) => <CodeCopy text={"sudo eopkg install flatpak"} />,
          })}
        </li>

        <li>
          <h2>{t("distros.solus.step-2.name")}</h2>
          {t.rich("distros.solus.step-2.text", {
            text: (chunk) => <p>{chunk}</p>,
            filelink: (chunk) => (
              <a href="https://dl.flathub.org/repo/flathub.flatpakrepo">
                {chunk}
              </a>
            ),
            code: (chunk) => (
              <CodeCopy
                text={
                  "flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo"
                }
              />
            ),
          })}
        </li>

        <li>
          <h2>{t("distros.solus.step-3.name")}</h2>
          {t.rich("distros.solus.step-3.text", {
            text: (chunk) => <p>{chunk}</p>,
            link: (chunk) => <Link href="./">{chunk}</Link>,
          })}
        </li>
      </ol>
    </>
  )
}

const Alpine = ({ locale }: { locale: string }) => {
  const t = useTranslations()
  return (
    <>
      <div className="flex flex-col items-center">
        <motion.picture layoutId="distro-logo-Alpine">
          <Image
            width={128}
            height={128}
            src={"/img/distro/alpine.svg"}
            alt="Alpine"
          />
        </motion.picture>
        <motion.h1 layoutId="distro-name-Alpine">
          {t("distros.alpine.distroName")}
        </motion.h1>
      </div>
      <ol className="distrotut">
        <HowToJsonLd
          useAppDir={true}
          name={t("distros.alpine.distroName")}
          image="https://flathub.org/img/distro/alpine.svg"
          estimatedCost={{ currency: "USD", value: "0" }}
          step={[
            {
              url: "https://flathub.org/setup/alpine",
              name: t("distros.alpine.step-1.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.alpine.step-1.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/alpine",
              name: t("distros.alpine.step-2.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.alpine.step-2.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/alpine",
              name: t("distros.alpine.step-3.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.alpine.step-3.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/alpine",
              name: t("distros.alpine.step-4.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.alpine.step-4.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
          ]}
        />

        <li>
          <h2>{t("distros.alpine.step-1.name")}</h2>
          {t.rich("distros.alpine.step-1.text", {
            text: (chunk) => <p>{chunk}</p>,
            code: (chunk) => <CodeCopy text={"doas apk add flatpak"} />,
          })}
        </li>

        <li>
          <h2>{t("distros.alpine.step-2.name")}</h2>
          {t.rich("distros.alpine.step-2.text", {
            text: (chunk) => <p>{chunk}</p>,
            code: (chunk) => (
              <CodeCopy text={"doas apk add gnome-software-plugin-flatpak"} />
            ),
            codeDiscover: (chunk) => (
              <CodeCopy text={"doas apk add discover-backend-flatpak"} />
            ),
          })}
        </li>

        <li>
          <h2>{t("distros.alpine.step-3.name")}</h2>
          {t.rich("distros.alpine.step-3.text", {
            text: (chunk) => <p>{chunk}</p>,
            filelink: (chunk) => (
              <a href="https://dl.flathub.org/repo/flathub.flatpakrepo">
                {chunk}
              </a>
            ),
            code: (chunk) => (
              <CodeCopy
                text={
                  "flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo"
                }
              />
            ),
          })}
        </li>

        <li>
          <h2>{t("distros.alpine.step-4.name")}</h2>
          {t.rich("distros.alpine.step-4.text", {
            text: (chunk) => <p>{chunk}</p>,
            link: (chunk) => <Link href="./">{chunk}</Link>,
          })}
        </li>
      </ol>
    </>
  )
}

const Mageia = ({ locale }: { locale: string }) => {
  const t = useTranslations()
  return (
    <>
      <div className="flex flex-col items-center">
        <motion.picture layoutId="distro-logo-Mageia">
          <Image
            width={128}
            height={128}
            src={"/img/distro/mageia.svg"}
            alt="Mageia"
          />
        </motion.picture>
        <motion.h1 layoutId="distro-name-Mageia">
          {t("distros.mageia.distroName")}
        </motion.h1>
      </div>
      <ol className="distrotut">
        <HowToJsonLd
          useAppDir={true}
          name={t("distros.mageia.distroName")}
          image="https://flathub.org/img/distro/mageia.svg"
          estimatedCost={{ currency: "USD", value: "0" }}
          step={[
            {
              url: "https://flathub.org/setup/mageia",
              name: t("distros.mageia.step-1.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.mageia.step-1.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/mageia",
              name: t("distros.mageia.step-2.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.mageia.step-2.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/mageia",
              name: t("distros.mageia.step-3.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.mageia.step-3.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
          ]}
        />

        <li>
          <h2>{t("distros.mageia.step-1.name")}</h2>
          {t.rich("distros.mageia.step-1.text", {
            text: (chunk) => <p>{chunk}</p>,
            strong: (chunk) => <strong>{chunk}</strong>,
            code: (chunk) => <CodeCopy text={"dnf install flatpak"} />,
            codeUrpmi: (chunk) => <CodeCopy text={"urpmi flatpak"} />,
          })}
        </li>

        <li>
          <h2>{t("distros.mageia.step-2.name")}</h2>
          {t.rich("distros.mageia.step-2.text", {
            text: (chunk) => <p>{chunk}</p>,
            filelink: (chunk) => (
              <a href="https://dl.flathub.org/repo/flathub.flatpakrepo">
                {chunk}
              </a>
            ),
            code: (chunk) => (
              <CodeCopy
                text={
                  "flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo"
                }
              />
            ),
          })}
        </li>

        <li>
          <h2>{t("distros.mageia.step-3.name")}</h2>
          {t.rich("distros.mageia.step-3.text", {
            text: (chunk) => <p>{chunk}</p>,
            link: (chunk) => <Link href="./">{chunk}</Link>,
          })}
        </li>
      </ol>
    </>
  )
}

const OpenMandriva_Lx = ({ locale }: { locale: string }) => {
  const t = useTranslations()
  return (
    <>
      <div className="flex flex-col items-center">
        <motion.picture layoutId="distro-logo-OpenMandriva-Lx">
          <Image
            width={128}
            height={128}
            src={"/img/distro/openmandriva.svg"}
            alt="OpenMandriva Lx"
          />
        </motion.picture>
        <motion.h1 layoutId="distro-name-OpenMandriva-Lx">
          {t("distros.openmandriva_lx.distroName")}
        </motion.h1>
      </div>
      <ol className="distrotut">
        {t.rich("distros.openmandriva_lx.introduction", {
          header: (chunk) => <h2>{chunk}</h2>,
          text: (chunk) => <p>{chunk}</p>,
        })}
      </ol>
    </>
  )
}

const Pop_OS = ({ locale }: { locale: string }) => {
  const t = useTranslations()
  return (
    <>
      <div className="flex flex-col items-center">
        <motion.picture layoutId="distro-logo-Pop!_OS">
          <Image
            width={128}
            height={128}
            src={"/img/distro/pop-os.svg"}
            alt="Pop!_OS"
          />
        </motion.picture>
        <motion.h1 layoutId="distro-name-Pop!_OS">
          {t("distros.pop_os.distroName")}
        </motion.h1>
      </div>
      <ol className="distrotut">
        {t.rich("distros.pop_os.introduction", {
          text: (chunk) => <h2>{chunk}</h2>,
        })}
      </ol>
    </>
  )
}

const Elementary_OS = ({ locale }: { locale: string }) => {
  const t = useTranslations()
  return (
    <>
      <div className="flex flex-col items-center">
        <motion.picture layoutId="distro-logo-elementary-OS">
          <source
            srcSet={"/img/distro/elementary-os-dark.svg"}
            media="(prefers-color-scheme: dark)"
          />
          <Image
            width={128}
            height={128}
            src={"/img/distro/elementary-os.svg"}
            alt="elementary OS"
          />
        </motion.picture>
        <motion.h1 layoutId="distro-name-elementary-OS">
          {t("distros.elementary_os.distroName")}
        </motion.h1>
      </div>
      <ol className="distrotut">
        <HowToJsonLd
          useAppDir={true}
          name={t("distros.elementary_os.distroName")}
          image="https://flathub.org/img/distro/elementary-os.svg"
          estimatedCost={{ currency: "USD", value: "0" }}
          step={[
            {
              url: "https://flathub.org/setup/elementary_os",
              name: t("distros.elementary_os.step-1.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.elementary_os.step-1.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
          ]}
        />

        <li>
          <h2>{t("distros.elementary_os.step-1.name")}</h2>
          {t.rich("distros.elementary_os.step-1.text", {
            text: (chunk) => <p>{chunk}</p>,
            link: (chunk) => <Link href="./">{chunk}</Link>,
          })}
        </li>
      </ol>
    </>
  )
}

const Raspberry_Pi_OS = ({ locale }: { locale: string }) => {
  const t = useTranslations()
  return (
    <>
      <div className="flex flex-col items-center">
        <motion.picture layoutId="distro-logo-Raspberry-Pi-OS">
          <Image
            width={128}
            height={128}
            src={"/img/distro/raspberry-pi-os.svg"}
            alt="Raspberry Pi OS"
          />
        </motion.picture>
        <motion.h1 layoutId="distro-name-Raspberry-Pi-OS">
          {t("distros.raspberry_pi_os.distroName")}
        </motion.h1>
      </div>
      <ol className="distrotut">
        <HowToJsonLd
          useAppDir={true}
          name={t("distros.raspberry_pi_os.distroName")}
          image="https://flathub.org/img/distro/raspberry-pi-os.svg"
          estimatedCost={{ currency: "USD", value: "0" }}
          step={[
            {
              url: "https://flathub.org/setup/raspberry_pi_os",
              name: t("distros.raspberry_pi_os.step-1.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.raspberry_pi_os.step-1.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/raspberry_pi_os",
              name: t("distros.raspberry_pi_os.step-2.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.raspberry_pi_os.step-2.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/raspberry_pi_os",
              name: t("distros.raspberry_pi_os.step-3.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.raspberry_pi_os.step-3.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
          ]}
        />

        <li>
          <h2>{t("distros.raspberry_pi_os.step-1.name")}</h2>
          {t.rich("distros.raspberry_pi_os.step-1.text", {
            text: (chunk) => <p>{chunk}</p>,
            code: (chunk) => <CodeCopy text={"sudo apt install flatpak"} />,
          })}
        </li>

        <li>
          <h2>{t("distros.raspberry_pi_os.step-2.name")}</h2>
          {t.rich("distros.raspberry_pi_os.step-2.text", {
            text: (chunk) => <p>{chunk}</p>,
            strong: (chunk) => <strong>{chunk}</strong>,
            code: (chunk) => (
              <CodeCopy
                text={
                  "flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo"
                }
              />
            ),
          })}
        </li>

        <li>
          <h2>{t("distros.raspberry_pi_os.step-3.name")}</h2>
          {t.rich("distros.raspberry_pi_os.step-3.text", {
            text: (chunk) => <p>{chunk}</p>,
            link: (chunk) => <Link href="./">{chunk}</Link>,
          })}
        </li>
      </ol>
    </>
  )
}

const Void_Linux = ({ locale }: { locale: string }) => {
  const t = useTranslations()
  return (
    <>
      <div className="flex flex-col items-center">
        <motion.picture layoutId="distro-logo-Void-Linux">
          <source
            srcSet={"/img/distro/void-dark.svg"}
            media="(prefers-color-scheme: dark)"
          />
          <Image
            width={128}
            height={128}
            src={"/img/distro/void.svg"}
            alt="Void Linux"
          />
        </motion.picture>
        <motion.h1 layoutId="distro-name-Void-Linux">
          {t("distros.void_linux.distroName")}
        </motion.h1>
      </div>
      <ol className="distrotut">
        <HowToJsonLd
          useAppDir={true}
          name={t("distros.void_linux.distroName")}
          image="https://flathub.org/img/distro/void.svg"
          estimatedCost={{ currency: "USD", value: "0" }}
          step={[
            {
              url: "https://flathub.org/setup/void_linux",
              name: t("distros.void_linux.step-1.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.void_linux.step-1.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/void_linux",
              name: t("distros.void_linux.step-2.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.void_linux.step-2.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/void_linux",
              name: t("distros.void_linux.step-3.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.void_linux.step-3.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
          ]}
        />

        <li>
          <h2>{t("distros.void_linux.step-1.name")}</h2>
          {t.rich("distros.void_linux.step-1.text", {
            text: (chunk) => <p>{chunk}</p>,
            code: (chunk) => <CodeCopy text={"sudo xbps-install -S flatpak"} />,
          })}
        </li>

        <li>
          <h2>{t("distros.void_linux.step-2.name")}</h2>
          {t.rich("distros.void_linux.step-2.text", {
            text: (chunk) => <p>{chunk}</p>,
            code: (chunk) => (
              <CodeCopy
                text={
                  "flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo"
                }
              />
            ),
          })}
        </li>

        <li>
          <h2>{t("distros.void_linux.step-3.name")}</h2>
          {t.rich("distros.void_linux.step-3.text", {
            text: (chunk) => <p>{chunk}</p>,
            link: (chunk) => <Link href="./">{chunk}</Link>,
          })}
        </li>
      </ol>
    </>
  )
}

const NixOS = ({ locale }: { locale: string }) => {
  const t = useTranslations()
  return (
    <>
      <div className="flex flex-col items-center">
        <motion.picture layoutId="distro-logo-NixOS">
          <Image
            width={128}
            height={128}
            src={"/img/distro/nixos.svg"}
            alt="NixOS"
          />
        </motion.picture>
        <motion.h1 layoutId="distro-name-NixOS">
          {t("distros.nixos.distroName")}
        </motion.h1>
      </div>
      <ol className="distrotut">
        <HowToJsonLd
          useAppDir={true}
          name={t("distros.nixos.distroName")}
          image="https://flathub.org/img/distro/nixos.svg"
          estimatedCost={{ currency: "USD", value: "0" }}
          step={[
            {
              url: "https://flathub.org/setup/nixos",
              name: t("distros.nixos.step-1.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.nixos.step-1.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/nixos",
              name: t("distros.nixos.step-2.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.nixos.step-2.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/nixos",
              name: t("distros.nixos.step-3.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.nixos.step-3.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
          ]}
        />

        <li>
          <h2>{t("distros.nixos.step-1.name")}</h2>
          {t.rich("distros.nixos.step-1.text", {
            text: (chunk) => <p>{chunk}</p>,
            strong: (chunk) => <strong>{chunk}</strong>,
            code: (chunk) => (
              <CodeCopy text={"services.flatpak.enable = true;"} />
            ),
            codeRebuild: (chunk) => (
              <CodeCopy text={"sudo nixos-rebuild switch"} />
            ),
            doclink: (chunk) => (
              <a href="https://nixos.org/manual/nixos/stable/index.html#module-services-flatpak">
                {chunk}
              </a>
            ),
          })}
        </li>

        <li>
          <h2>{t("distros.nixos.step-2.name")}</h2>
          {t.rich("distros.nixos.step-2.text", {
            text: (chunk) => <p>{chunk}</p>,
            code: (chunk) => (
              <CodeCopy
                text={
                  "flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo"
                }
              />
            ),
          })}
        </li>

        <li>
          <h2>{t("distros.nixos.step-3.name")}</h2>
          {t.rich("distros.nixos.step-3.text", {
            text: (chunk) => <p>{chunk}</p>,
            link: (chunk) => <Link href="./">{chunk}</Link>,
          })}
        </li>
      </ol>
    </>
  )
}

const PureOS = ({ locale }: { locale: string }) => {
  const t = useTranslations()
  return (
    <>
      <div className="flex flex-col items-center">
        <motion.picture layoutId="distro-logo-PureOS">
          <source
            srcSet={"/img/distro/pureos-dark.svg"}
            media="(prefers-color-scheme: dark)"
          />
          <Image
            width={128}
            height={128}
            src={"/img/distro/pureos.svg"}
            alt="PureOS"
          />
        </motion.picture>
        <motion.h1 layoutId="distro-name-PureOS">
          {t("distros.pureos.distroName")}
        </motion.h1>
      </div>
      <ol className="distrotut">
        {t.rich("distros.pureos.introduction", {
          filelink: (chunk) => (
            <a href="https://dl.flathub.org/repo/flathub.flatpakrepo">
              {chunk}
            </a>
          ),
          link: (chunk) => <Link href={"/."}>{chunk}</Link>,
          text: (chunk) => <p>{chunk}</p>,
        })}
      </ol>
    </>
  )
}

const Zorin_OS = ({ locale }: { locale: string }) => {
  const t = useTranslations()
  return (
    <>
      <div className="flex flex-col items-center">
        <motion.picture layoutId="distro-logo-Zorin-OS">
          <Image
            width={128}
            height={128}
            src={"/img/distro/zorin-os.svg"}
            alt="Zorin OS"
          />
        </motion.picture>
        <motion.h1 layoutId="distro-name-Zorin-OS">
          {t("distros.zorin_os.distroName")}
        </motion.h1>
      </div>
      <ol className="distrotut">
        {t.rich("distros.zorin_os.introduction", {
          header: (chunk) => <h2>{chunk}</h2>,
          text: (chunk) => <p>{chunk}</p>,
        })}
      </ol>
    </>
  )
}

const Deepin = ({ locale }: { locale: string }) => {
  const t = useTranslations()
  return (
    <>
      <div className="flex flex-col items-center">
        <motion.picture layoutId="distro-logo-Deepin">
          <Image
            width={128}
            height={128}
            src={"/img/distro/deepin.svg"}
            alt="Deepin"
          />
        </motion.picture>
        <motion.h1 layoutId="distro-name-Deepin">
          {t("distros.deepin.distroName")}
        </motion.h1>
      </div>
      <ol className="distrotut">
        <HowToJsonLd
          useAppDir={true}
          name={t("distros.deepin.distroName")}
          image="https://flathub.org/img/distro/deepin.svg"
          estimatedCost={{ currency: "USD", value: "0" }}
          step={[
            {
              url: "https://flathub.org/setup/deepin",
              name: t("distros.deepin.step-1.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.deepin.step-1.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/deepin",
              name: t("distros.deepin.step-2.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.deepin.step-2.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/deepin",
              name: t("distros.deepin.step-3.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.deepin.step-3.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/deepin",
              name: t("distros.deepin.step-4.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.deepin.step-4.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
          ]}
        />

        <li>
          <h2>{t("distros.deepin.step-1.name")}</h2>
          {t.rich("distros.deepin.step-1.text", {
            text: (chunk) => <p>{chunk}</p>,
            code: (chunk) => <CodeCopy text={"sudo apt install flatpak"} />,
          })}
        </li>

        <li>
          <h2>{t("distros.deepin.step-2.name")}</h2>
          {t.rich("distros.deepin.step-2.text", {
            text: (chunk) => <p>{chunk}</p>,
            code: (chunk) => (
              <CodeCopy
                text={
                  "flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo"
                }
              />
            ),
          })}
        </li>

        <li>
          <h2>{t("distros.deepin.step-3.name")}</h2>
          {t.rich("distros.deepin.step-3.text", {
            text: (chunk) => <p>{chunk}</p>,
            code: (chunk) => (
              <CodeCopy
                text={`flatpak install flathub org.gtk.Gtk3theme.deepin
 flatpak install flathub org.gtk.Gtk3theme.deepin-dark`}
              />
            ),
          })}
        </li>

        <li>
          <h2>{t("distros.deepin.step-4.name")}</h2>
          {t.rich("distros.deepin.step-4.text", {
            text: (chunk) => <p>{chunk}</p>,
            link: (chunk) => <Link href="./">{chunk}</Link>,
          })}
        </li>
      </ol>
    </>
  )
}

const Pardus = ({ locale }: { locale: string }) => {
  const t = useTranslations()
  return (
    <>
      <div className="flex flex-col items-center">
        <motion.picture layoutId="distro-logo-Pardus">
          <Image
            width={128}
            height={128}
            src={"/img/distro/pardus.svg"}
            alt="Pardus"
          />
        </motion.picture>
        <motion.h1 layoutId="distro-name-Pardus">
          {t("distros.pardus.distroName")}
        </motion.h1>
      </div>
      <ol className="distrotut">
        <HowToJsonLd
          useAppDir={true}
          name={t("distros.pardus.distroName")}
          image="https://flathub.org/img/distro/pardus.svg"
          estimatedCost={{ currency: "USD", value: "0" }}
          step={[
            {
              url: "https://flathub.org/setup/pardus",
              name: t("distros.pardus.step-1.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.pardus.step-1.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/pardus",
              name: t("distros.pardus.step-2.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.pardus.step-2.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/pardus",
              name: t("distros.pardus.step-3.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.pardus.step-3.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/pardus",
              name: t("distros.pardus.step-4.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.pardus.step-4.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
          ]}
        />

        <li>
          <h2>{t("distros.pardus.step-1.name")}</h2>
          {t.rich("distros.pardus.step-1.text", {
            text: (chunk) => <p>{chunk}</p>,
            code: (chunk) => <CodeCopy text={"sudo apt install flatpak"} />,
          })}
        </li>

        <li>
          <h2>{t("distros.pardus.step-2.name")}</h2>
          {t.rich("distros.pardus.step-2.text", {
            text: (chunk) => <p>{chunk}</p>,
            code: (chunk) => (
              <CodeCopy
                text={"sudo apt install gnome-software-plugin-flatpak"}
              />
            ),
          })}
        </li>

        <li>
          <h2>{t("distros.pardus.step-3.name")}</h2>
          {t.rich("distros.pardus.step-3.text", {
            text: (chunk) => <p>{chunk}</p>,
            code: (chunk) => (
              <CodeCopy
                text={
                  "flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo"
                }
              />
            ),
          })}
        </li>

        <li>
          <h2>{t("distros.pardus.step-4.name")}</h2>
          {t.rich("distros.pardus.step-4.text", {
            text: (chunk) => <p>{chunk}</p>,
            link: (chunk) => <Link href="./">{chunk}</Link>,
          })}
        </li>
      </ol>
    </>
  )
}

const MX_Linux = ({ locale }: { locale: string }) => {
  const t = useTranslations()
  return (
    <>
      <div className="flex flex-col items-center">
        <motion.picture layoutId="distro-logo-MX-Linux">
          <Image
            width={128}
            height={128}
            src={"/img/distro/mxlinux.svg"}
            alt="MX Linux"
          />
        </motion.picture>
        <motion.h1 layoutId="distro-name-MX-Linux">
          {t("distros.mx_linux.distroName")}
        </motion.h1>
      </div>
      <ol className="distrotut">
        <HowToJsonLd
          useAppDir={true}
          name={t("distros.mx_linux.distroName")}
          image="https://flathub.org/img/distro/mxlinux.svg"
          estimatedCost={{ currency: "USD", value: "0" }}
          step={[
            {
              url: "https://flathub.org/setup/mx_linux",
              name: t("distros.mx_linux.step-1.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.mx_linux.step-1.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/mx_linux",
              name: t("distros.mx_linux.step-2.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.mx_linux.step-2.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
          ]}
        />

        <li>
          <h2>{t("distros.mx_linux.step-1.name")}</h2>
          {t.rich("distros.mx_linux.step-1.text", {
            text: (chunk) => <p>{chunk}</p>,
            strong: (chunk) => <strong>{chunk}</strong>,
          })}
        </li>

        <li>
          <h2>{t("distros.mx_linux.step-2.name")}</h2>
          {t.rich("distros.mx_linux.step-2.text", {
            text: (chunk) => <p>{chunk}</p>,
            link: (chunk) => <Link href="./">{chunk}</Link>,
          })}
        </li>
      </ol>
    </>
  )
}

const Pisi_GNULinux = ({ locale }: { locale: string }) => {
  const t = useTranslations()
  return (
    <>
      <div className="flex flex-col items-center">
        <motion.picture layoutId="distro-logo-Pisi-GNULinux">
          <source
            srcSet={"/img/distro/pisi-dark.svg"}
            media="(prefers-color-scheme: dark)"
          />
          <Image
            width={128}
            height={128}
            src={"/img/distro/pisi.svg"}
            alt="Pisi GNU/Linux"
          />
        </motion.picture>
        <motion.h1 layoutId="distro-name-Pisi-GNULinux">
          {t("distros.pisi_gnulinux.distroName")}
        </motion.h1>
      </div>
      <ol className="distrotut">
        <HowToJsonLd
          useAppDir={true}
          name={t("distros.pisi_gnulinux.distroName")}
          image="https://flathub.org/img/distro/pisi.svg"
          estimatedCost={{ currency: "USD", value: "0" }}
          step={[
            {
              url: "https://flathub.org/setup/pisi_gnulinux",
              name: t("distros.pisi_gnulinux.step-1.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.pisi_gnulinux.step-1.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/pisi_gnulinux",
              name: t("distros.pisi_gnulinux.step-2.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.pisi_gnulinux.step-2.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/pisi_gnulinux",
              name: t("distros.pisi_gnulinux.step-3.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.pisi_gnulinux.step-3.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
          ]}
        />

        <li>
          <h2>{t("distros.pisi_gnulinux.step-1.name")}</h2>
          {t.rich("distros.pisi_gnulinux.step-1.text", {
            text: (chunk) => <p>{chunk}</p>,
            code: (chunk) => <CodeCopy text={"sudo pisi it flatpak"} />,
          })}
        </li>

        <li>
          <h2>{t("distros.pisi_gnulinux.step-2.name")}</h2>
          {t.rich("distros.pisi_gnulinux.step-2.text", {
            text: (chunk) => <p>{chunk}</p>,
            code: (chunk) => (
              <CodeCopy
                text={
                  "flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo"
                }
              />
            ),
          })}
        </li>

        <li>
          <h2>{t("distros.pisi_gnulinux.step-3.name")}</h2>
          {t.rich("distros.pisi_gnulinux.step-3.text", {
            text: (chunk) => <p>{chunk}</p>,
            link: (chunk) => <Link href="./">{chunk}</Link>,
          })}
        </li>
      </ol>
    </>
  )
}

const EndeavourOS = ({ locale }: { locale: string }) => {
  const t = useTranslations()
  return (
    <>
      <div className="flex flex-col items-center">
        <motion.picture layoutId="distro-logo-EndeavourOS">
          <source
            srcSet={"/img/distro/endeavouros-dark.svg"}
            media="(prefers-color-scheme: dark)"
          />
          <Image
            width={128}
            height={128}
            src={"/img/distro/endeavouros.svg"}
            alt="EndeavourOS"
          />
        </motion.picture>
        <motion.h1 layoutId="distro-name-EndeavourOS">
          {t("distros.endeavouros.distroName")}
        </motion.h1>
      </div>
      <ol className="distrotut">
        <HowToJsonLd
          useAppDir={true}
          name={t("distros.endeavouros.distroName")}
          image="https://flathub.org/img/distro/endeavouros.svg"
          estimatedCost={{ currency: "USD", value: "0" }}
          step={[
            {
              url: "https://flathub.org/setup/endeavouros",
              name: t("distros.endeavouros.step-1.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.endeavouros.step-1.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/endeavouros",
              name: t("distros.endeavouros.step-2.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.endeavouros.step-2.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/endeavouros",
              name: t("distros.endeavouros.step-3.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.endeavouros.step-3.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
          ]}
        />

        <li>
          <h2>{t("distros.endeavouros.step-1.name")}</h2>
          {t.rich("distros.endeavouros.step-1.text", {
            text: (chunk) => <p>{chunk}</p>,
            code: (chunk) => <CodeCopy text={"sudo pacman -S flatpak"} />,
            codeUpdate: (chunk) => <CodeCopy text={"sudo pacman -Syu"} />,
          })}
        </li>

        <li>
          <h2>{t("distros.endeavouros.step-2.name")}</h2>
          {t.rich("distros.endeavouros.step-2.text", {
            text: (chunk) => <p>{chunk}</p>,
            code: (chunk) => (
              <CodeCopy
                text={
                  "flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo"
                }
              />
            ),
          })}
        </li>

        <li>
          <h2>{t("distros.endeavouros.step-3.name")}</h2>
          {t.rich("distros.endeavouros.step-3.text", {
            text: (chunk) => <p>{chunk}</p>,
            link: (chunk) => <Link href="./">{chunk}</Link>,
          })}
        </li>
      </ol>
    </>
  )
}

const KDE_neon = ({ locale }: { locale: string }) => {
  const t = useTranslations()
  return (
    <>
      <div className="flex flex-col items-center">
        <motion.picture layoutId="distro-logo-KDE-neon">
          <Image
            width={128}
            height={128}
            src={"/img/distro/kdeneon.svg"}
            alt="KDE neon"
          />
        </motion.picture>
        <motion.h1 layoutId="distro-name-KDE-neon">
          {t("distros.kde_neon.distroName")}
        </motion.h1>
      </div>
      <ol className="distrotut">
        {t.rich("distros.kde_neon.introduction", {
          text: (chunk) => <h2>{chunk}</h2>,
        })}
      </ol>
    </>
  )
}

const GNU_Guix = ({ locale }: { locale: string }) => {
  const t = useTranslations()
  return (
    <>
      <div className="flex flex-col items-center">
        <motion.picture layoutId="distro-logo-GNU-Guix">
          <source
            srcSet={"/img/distro/guix-dark.svg"}
            media="(prefers-color-scheme: dark)"
          />
          <Image
            width={128}
            height={128}
            src={"/img/distro/guix.svg"}
            alt="GNU Guix"
          />
        </motion.picture>
        <motion.h1 layoutId="distro-name-GNU-Guix">
          {t("distros.gnu_guix.distroName")}
        </motion.h1>
      </div>
      <ol className="distrotut">
        <HowToJsonLd
          useAppDir={true}
          name={t("distros.gnu_guix.distroName")}
          image="https://flathub.org/img/distro/guix.svg"
          estimatedCost={{ currency: "USD", value: "0" }}
          step={[
            {
              url: "https://flathub.org/setup/gnu_guix",
              name: t("distros.gnu_guix.step-1.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.gnu_guix.step-1.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/gnu_guix",
              name: t("distros.gnu_guix.step-2.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.gnu_guix.step-2.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/gnu_guix",
              name: t("distros.gnu_guix.step-3.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.gnu_guix.step-3.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
          ]}
        />

        <li>
          <h2>{t("distros.gnu_guix.step-1.name")}</h2>
          {t.rich("distros.gnu_guix.step-1.text", {
            text: (chunk) => <p>{chunk}</p>,
            code: (chunk) => <CodeCopy text={"guix install flatpak"} />,
          })}
        </li>

        <li>
          <h2>{t("distros.gnu_guix.step-2.name")}</h2>
          {t.rich("distros.gnu_guix.step-2.text", {
            text: (chunk) => <p>{chunk}</p>,
            code: (chunk) => (
              <CodeCopy
                text={
                  "flatpak --user remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo"
                }
              />
            ),
          })}
        </li>

        <li>
          <h2>{t("distros.gnu_guix.step-3.name")}</h2>
          {t.rich("distros.gnu_guix.step-3.text", {
            text: (chunk) => <p>{chunk}</p>,
            link: (chunk) => <Link href="./">{chunk}</Link>,
          })}
        </li>
      </ol>
    </>
  )
}

const Crystal_Linux = ({ locale }: { locale: string }) => {
  const t = useTranslations()
  return (
    <>
      <div className="flex flex-col items-center">
        <motion.picture layoutId="distro-logo-Crystal-Linux">
          <Image
            width={128}
            height={128}
            src={"/img/distro/crystallinux.svg"}
            alt="Crystal Linux"
          />
        </motion.picture>
        <motion.h1 layoutId="distro-name-Crystal-Linux">
          {t("distros.crystal_linux.distroName")}
        </motion.h1>
      </div>
      <ol className="distrotut">
        <HowToJsonLd
          useAppDir={true}
          name={t("distros.crystal_linux.distroName")}
          image="https://flathub.org/img/distro/crystallinux.svg"
          estimatedCost={{ currency: "USD", value: "0" }}
          step={[
            {
              url: "https://flathub.org/setup/crystal_linux",
              name: t("distros.crystal_linux.step-1.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.crystal_linux.step-1.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/crystal_linux",
              name: t("distros.crystal_linux.step-2.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.crystal_linux.step-2.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
            {
              url: "https://flathub.org/setup/crystal_linux",
              name: t("distros.crystal_linux.step-3.name"),
              itemListElement: [
                {
                  type: "HowToDirection",
                  text: t
                    .raw("distros.crystal_linux.step-3.text")
                    .replace(/<[^>]*>/g, "")
                    .replace(/s{2,}/g, " ")
                    .trim(),
                },
              ],
            },
          ]}
        />

        {t.rich("distros.crystal_linux.introduction", {
          header: (chunk) => <h2>{chunk}</h2>,
          text: (chunk) => <p>{chunk}</p>,
        })}
        <li>
          <h2>{t("distros.crystal_linux.step-1.name")}</h2>
          {t.rich("distros.crystal_linux.step-1.text", {
            text: (chunk) => <p>{chunk}</p>,
            codeUpdate: (chunk) => <CodeCopy text={"ame upg"} />,
            code: (chunk) => <CodeCopy text={"ame ins flatpak"} />,
          })}
        </li>

        <li>
          <h2>{t("distros.crystal_linux.step-2.name")}</h2>
          {t.rich("distros.crystal_linux.step-2.text", {
            text: (chunk) => <p>{chunk}</p>,
            code: (chunk) => (
              <CodeCopy
                text={
                  "flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo"
                }
              />
            ),
          })}
        </li>

        <li>
          <h2>{t("distros.crystal_linux.step-3.name")}</h2>
          {t.rich("distros.crystal_linux.step-3.text", {
            text: (chunk) => <p>{chunk}</p>,
            link: (chunk) => <Link href="./">{chunk}</Link>,
          })}
        </li>
      </ol>
    </>
  )
}

const Vanilla_OS = ({ locale }: { locale: string }) => {
  const t = useTranslations()
  return (
    <>
      <div className="flex flex-col items-center">
        <motion.picture layoutId="distro-logo-Vanilla-OS">
          <Image
            width={128}
            height={128}
            src={"/img/distro/vanillaos.svg"}
            alt="Vanilla OS"
          />
        </motion.picture>
        <motion.h1 layoutId="distro-name-Vanilla-OS">
          {t("distros.vanilla_os.distroName")}
        </motion.h1>
      </div>
      <ol className="distrotut">
        {t.rich("distros.vanilla_os.introduction", {
          header: (chunk) => <h2>{chunk}</h2>,
          link: (chunk) => <Link href={"/."}>{chunk}</Link>,
          code: (chunk) => (
            <CodeCopy
              text={
                "host-shell flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo"
              }
            />
          ),
          text: (chunk) => <p>{chunk}</p>,
        })}
      </ol>
    </>
  )
}

const Salix = ({ locale }: { locale: string }) => {
  const t = useTranslations()
  return (
    <>
      <div className="flex flex-col items-center">
        <motion.picture layoutId="distro-logo-Salix">
          <Image
            width={128}
            height={128}
            src={"/img/distro/salix.svg"}
            alt="Salix"
          />
        </motion.picture>
        <motion.h1 layoutId="distro-name-Salix">
          {t("distros.salix.distroName")}
        </motion.h1>
      </div>
      <ol className="distrotut">
        {t.rich("distros.salix.introduction", {
          header: (chunk) => <h2>{chunk}</h2>,
          link: (chunk) => <Link href={"/."}>{chunk}</Link>,
          text: (chunk) => <p>{chunk}</p>,
        })}
      </ol>
    </>
  )
}
