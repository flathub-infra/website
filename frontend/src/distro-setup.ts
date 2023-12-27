import { readFile } from "node:fs/promises"
import { parse } from "yaml"

export type DistroSetup = {
  name: string
  slug?: string
  logo: string
  introduction: string
  steps: { name: string; text: string }[]
  logo_dark?: string
}

export async function fetchSetupInstructions() {
  const file = await readFile("./src/data/distro.yml", "utf8")

  const parsedDistros: DistroSetup[] = parse(file)

  const mappedDistros = parsedDistros.map((instruction) => {
    return {
      ...instruction,
      logo: `img/distro/${instruction.logo}`,
      logo_dark: instruction.logo_dark
        ? `img/distro/${instruction.logo_dark}`
        : null,
    }
  })

  return mappedDistros
}
