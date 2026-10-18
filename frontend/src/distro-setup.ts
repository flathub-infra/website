import { ASSET_BASE_URL } from "./env"

export type DistroSetup = {
  name: string
  slug?: string
  logo: string
  logo_dark: string | null
  translatedNameKey: string
}

const distros: {
  name: string
  slug?: string
  logo: string
  logo_dark?: string
}[] = [
  { name: "Ubuntu", logo: "ubuntu.svg" },
  { name: "Fedora", logo: "fedora.svg" },
  { name: "Manjaro", logo: "manjaro.svg" },
  { name: "Endless OS", logo: "endless.svg" },
  { name: "ALT Linux", logo: "altlinux.svg", logo_dark: "altlinux-dark.svg" },
  { name: "Chrome OS", logo: "chrome-os.svg" },
  { name: "Red Hat Enterprise Linux", logo: "redhat.svg" },
  { name: "Linux Mint", logo: "mint.svg" },
  { name: "openSUSE", logo: "opensuse.svg" },
  { name: "Arch", logo: "arch.svg" },
  { name: "Debian", logo: "debian.svg" },
  { name: "Rocky Linux", logo: "rockylinux.svg" },
  { name: "CentOS Stream", logo: "centos.svg" },
  { name: "AlmaLinux", logo: "almalinux.svg" },
  { name: "Gentoo", logo: "gentoo.svg" },
  { name: "Kubuntu", logo: "kubuntu.svg" },
  { name: "Solus", logo: "solus.svg" },
  { name: "Alpine", logo: "alpine.svg" },
  { name: "Mageia", logo: "mageia.svg" },
  { name: "OpenMandriva Lx", logo: "openmandriva.svg" },
  { name: "Pop!_OS", logo: "pop-os.svg" },
  {
    name: "elementary OS",
    logo: "elementary-os.svg",
    logo_dark: "elementary-os-dark.svg",
  },
  { name: "Raspberry Pi OS", logo: "raspberry-pi-os.svg" },
  { name: "Void Linux", logo: "void.svg", logo_dark: "void-dark.svg" },
  { name: "NixOS", logo: "nixos.svg" },
  { name: "PureOS", logo: "pureos.svg", logo_dark: "pureos-dark.svg" },
  { name: "Zorin OS", logo: "zorin-os.svg" },
  { name: "Deepin", logo: "deepin.svg" },
  { name: "Pardus", logo: "pardus.svg" },
  { name: "MX Linux", logo: "mxlinux.svg" },
  {
    name: "Pisi GNU/Linux",
    slug: "Pisi GNU Linux",
    logo: "pisi.svg",
    logo_dark: "pisi-dark.svg",
  },
  {
    name: "EndeavourOS",
    logo: "endeavouros.svg",
    logo_dark: "endeavouros-dark.svg",
  },
  { name: "KDE neon", logo: "kdeneon.svg" },
  { name: "GNU Guix", logo: "guix.svg", logo_dark: "guix-dark.svg" },
  { name: "Crystal Linux", logo: "crystallinux.svg" },
  { name: "Vanilla OS", logo: "vanillaos.svg" },
  { name: "Salix", logo: "salix.svg" },
  { name: "Slackware", logo: "slackware.svg" },
  { name: "T2 SDE", logo: "t2sde.svg" },
  { name: "Nura", logo: "postmarketOS.svg" },
]

export function getDistros(): DistroSetup[] {
  return distros.map((instruction) => {
    const translatedNameKey =
      instruction.name === "CentOS Stream"
        ? "distros.centos.distroName"
        : `distros.${instruction.name
            .replaceAll(" ", "_")
            .replaceAll("!", "")
            .replaceAll("/", "")
            .toLowerCase()}.distroName`

    return {
      ...instruction,
      logo: `${ASSET_BASE_URL}/img/distro/${instruction.logo}`,
      logo_dark: instruction.logo_dark
        ? `${ASSET_BASE_URL}/img/distro/${instruction.logo_dark}`
        : null,
      translatedNameKey,
    }
  })
}
