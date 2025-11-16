import { readFile } from "node:fs/promises"
import { parse } from "yaml"
import { ASSET_BASE_URL } from "./env"

export type DistroSetup = {
  name: string
  slug?: string
  logo: string
  introduction: string
  steps: { name: string; text: string }[]
  logo_dark?: string
  translatedNameKey: string
}

export async function fetchSetupInstructions() {
  const file = await readFile("./src/data/distro.yml", "utf8")

  const parsedDistros: DistroSetup[] = parse(file)

  const mappedDistros = parsedDistros.map((instruction) => {
    return {
      ...instruction,
      logo: `${ASSET_BASE_URL}/img/distro/${instruction.logo}`,
      logo_dark: instruction.logo_dark
        ? `${ASSET_BASE_URL}/img/distro/${instruction.logo_dark}`
        : null,
      translatedNameKey: `distros.${instruction.name
        .replaceAll(" ", "_")
        .replaceAll("!", "")
        .replaceAll("/", "")
        .toLowerCase()}.distroName`,
    }
  })

  return mappedDistros
}
