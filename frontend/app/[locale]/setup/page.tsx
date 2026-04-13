import { notFound } from "next/navigation"
import { fetchSetupInstructions } from "../../../src/distro-setup"
import { Metadata } from "next"
import SetupClient from "./setup-client"
import { getTranslations, setRequestLocale } from "next-intl/server"

export const dynamic = "force-static"

export async function generateStaticParams() {
  return []
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })

  return {
    title: t("setup-flathub"),
    description: t("setup-flathub-description"),
  }
}

const setupFaqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is Flatpak?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Flatpak is a universal packaging format for Linux desktop applications. It lets developers distribute apps that work across all major Linux distributions without modification.",
      },
    },
    {
      "@type": "Question",
      name: "How do I install Flatpak on Ubuntu?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "To install Flatpak on Ubuntu, run: sudo apt install flatpak. Then add the Flathub repository with: flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo. Restart your system to complete the setup.",
      },
    },
    {
      "@type": "Question",
      name: "How do I install Flatpak on Fedora?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Flatpak is installed by default on Fedora. To add the Flathub app store, run: flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo",
      },
    },
    {
      "@type": "Question",
      name: "How do I install a Flatpak app from Flathub?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Once Flathub is set up, install any app using: flatpak install flathub APP_ID. For example: flatpak install flathub org.mozilla.firefox. You can also install apps directly from the Flathub website by clicking the Install button.",
      },
    },
    {
      "@type": "Question",
      name: "Is Flathub free to use?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, Flathub is free to use. The majority of apps on Flathub are free and open source software. Some apps may offer optional donations or paid features.",
      },
    },
    {
      "@type": "Question",
      name: "Which Linux distributions support Flatpak?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Flatpak is supported on virtually all major Linux distributions including Ubuntu, Fedora, Debian, Arch Linux, Linux Mint, openSUSE, Manjaro, Pop!_OS, elementary OS, and many more.",
      },
    },
  ],
}

export default async function SetupPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  // Enable static rendering
  setRequestLocale(locale)

  const instructions = await fetchSetupInstructions()

  if (!instructions) {
    notFound()
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(setupFaqJsonLd) }}
      />
      <SetupClient instructions={instructions} />
    </>
  )
}
