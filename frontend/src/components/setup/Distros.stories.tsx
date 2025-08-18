import type { Meta, StoryObj } from "@storybook/react"
import { distroMap } from "./Distros"

const meta = {
  title: "Setup/Distros",
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const allDistros = distroMap("en")

export const Ubuntu: Story = {
  render: () => (
    <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
      <div className="space-y-4">{allDistros.get("Ubuntu")}</div>
    </div>
  ),
}

export const Fedora: Story = {
  render: () => (
    <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
      <div className="space-y-4">{allDistros.get("Fedora")}</div>
    </div>
  ),
}

export const Manjaro: Story = {
  render: () => (
    <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
      <div className="space-y-4">{allDistros.get("Manjaro")}</div>
    </div>
  ),
}

export const EndlessOS: Story = {
  render: () => (
    <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
      <div className="space-y-4">{allDistros.get("Endless OS")}</div>
    </div>
  ),
}

export const ALTLinux: Story = {
  render: () => (
    <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
      <div className="space-y-4">{allDistros.get("ALT Linux")}</div>
    </div>
  ),
}

export const ChromeOS: Story = {
  render: () => (
    <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
      <div className="space-y-4">{allDistros.get("Chrome OS")}</div>
    </div>
  ),
}

export const RHEL: Story = {
  render: () => (
    <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
      <div className="space-y-4">
        {allDistros.get("Red Hat Enterprise Linux")}
      </div>
    </div>
  ),
}

export const LinuxMint: Story = {
  render: () => (
    <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
      <div className="space-y-4">{allDistros.get("Linux Mint")}</div>
    </div>
  ),
}

export const OpenSUSE: Story = {
  render: () => (
    <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
      <div className="space-y-4">{allDistros.get("openSUSE")}</div>
    </div>
  ),
}

export const Arch: Story = {
  render: () => (
    <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
      <div className="space-y-4">{allDistros.get("Arch")}</div>
    </div>
  ),
}

export const Debian: Story = {
  render: () => (
    <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
      <div className="space-y-4">{allDistros.get("Debian")}</div>
    </div>
  ),
}

export const RockyLinux: Story = {
  render: () => (
    <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
      <div className="space-y-4">{allDistros.get("Rocky Linux")}</div>
    </div>
  ),
}

export const CentOSStream: Story = {
  render: () => (
    <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
      <div className="space-y-4">{allDistros.get("CentOS")}</div>
    </div>
  ),
}

export const AlmaLinux: Story = {
  render: () => (
    <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
      <div className="space-y-4">{allDistros.get("AlmaLinux")}</div>
    </div>
  ),
}

export const Gentoo: Story = {
  render: () => (
    <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
      <div className="space-y-4">{allDistros.get("Gentoo")}</div>
    </div>
  ),
}

export const Kubuntu: Story = {
  render: () => (
    <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
      <div className="space-y-4">{allDistros.get("Kubuntu")}</div>
    </div>
  ),
}

export const Solus: Story = {
  render: () => (
    <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
      <div className="space-y-4">{allDistros.get("Solus")}</div>
    </div>
  ),
}

export const Alpine: Story = {
  render: () => (
    <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
      <div className="space-y-4">{allDistros.get("Alpine")}</div>
    </div>
  ),
}

export const Mageia: Story = {
  render: () => (
    <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
      <div className="space-y-4">{allDistros.get("Mageia")}</div>
    </div>
  ),
}

export const OpenMandrivaLx: Story = {
  render: () => (
    <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
      <div className="space-y-4">{allDistros.get("OpenMandriva Lx")}</div>
    </div>
  ),
}

export const PopOS: Story = {
  render: () => (
    <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
      <div className="space-y-4">{allDistros.get("Pop!_OS")}</div>
    </div>
  ),
}

export const ElementaryOS: Story = {
  render: () => (
    <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
      <div className="space-y-4">{allDistros.get("elementary OS")}</div>
    </div>
  ),
}

export const RaspberryPiOS: Story = {
  render: () => (
    <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
      <div className="space-y-4">{allDistros.get("Raspberry Pi OS")}</div>
    </div>
  ),
}

export const VoidLinux: Story = {
  render: () => (
    <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
      <div className="space-y-4">{allDistros.get("Void Linux")}</div>
    </div>
  ),
}

export const NixOS: Story = {
  render: () => (
    <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
      <div className="space-y-4">{allDistros.get("NixOS")}</div>
    </div>
  ),
}

export const PureOS: Story = {
  render: () => (
    <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
      <div className="space-y-4">{allDistros.get("PureOS")}</div>
    </div>
  ),
}

export const ZorinOS: Story = {
  render: () => (
    <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
      <div className="space-y-4">{allDistros.get("Zorin OS")}</div>
    </div>
  ),
}

export const Deepin: Story = {
  render: () => (
    <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
      <div className="space-y-4">{allDistros.get("Deepin")}</div>
    </div>
  ),
}

export const Pardus: Story = {
  render: () => (
    <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
      <div className="space-y-4">{allDistros.get("Pardus")}</div>
    </div>
  ),
}

export const MXLinux: Story = {
  render: () => (
    <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
      <div className="space-y-4">{allDistros.get("MX Linux")}</div>
    </div>
  ),
}

export const PisiGNULinux: Story = {
  render: () => (
    <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
      <div className="space-y-4">{allDistros.get("Pisi GNULinux")}</div>
    </div>
  ),
}

export const EndeavourOS: Story = {
  render: () => (
    <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
      <div className="space-y-4">{allDistros.get("EndeavourOS")}</div>
    </div>
  ),
}

export const KDENeon: Story = {
  render: () => (
    <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
      <div className="space-y-4">{allDistros.get("KDE neon")}</div>
    </div>
  ),
}

export const GNUGuix: Story = {
  render: () => (
    <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
      <div className="space-y-4">{allDistros.get("GNU Guix")}</div>
    </div>
  ),
}

export const CrystalLinux: Story = {
  render: () => (
    <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
      <div className="space-y-4">{allDistros.get("Crystal Linux")}</div>
    </div>
  ),
}

export const VanillaOS: Story = {
  render: () => (
    <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
      <div className="space-y-4">{allDistros.get("Vanilla OS")}</div>
    </div>
  ),
}

export const Salix: Story = {
  render: () => (
    <div className="prose mx-auto dark:prose-invert prose-pre:rounded-xl">
      <div className="space-y-4">{allDistros.get("Salix")}</div>
    </div>
  ),
}
