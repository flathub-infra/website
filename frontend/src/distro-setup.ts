import { readFile } from "node:fs/promises"
import { parse } from "yaml"

export async function fetchSetupInstructions() {
  const file = await readFile("./src/data/distro.yml", "utf8")

  const parsedDistros: {
    name: string
    logo: string
    info: string
    logo_dark?: string
  }[] = parse(file)

  const mappedDistros = parsedDistros.map((instruction) => {
    return {
      ...instruction,
      logo: `img/distro/${instruction.logo}`,
      logo_dark: instruction.logo_dark
        ? `img/distro/${instruction.logo_dark}`
        : null,
    }
  })

  console.log(
    `Setup instructions parsed. Returned items: ${mappedDistros.length}.`,
  )

  return mappedDistros
}
