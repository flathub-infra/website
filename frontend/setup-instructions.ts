// frontend/setup-instructions.ts
import * as fs from "fs"
import { parse } from "yaml"
import { simpleGit } from "simple-git"
import * as prettier from "prettier"

const distroYamlPath = "src/data/distro.yml"
const distrosTsPath = "src/components/setup/Distros.tsx"
const enTranslationsPath = "public/locales/en/distros.json"

export interface Distro {
  name: string
  logo: string
  steps?: Step[]
  introduction?: string
  logo_dark?: string
  slug?: string
}

export interface Step {
  name: string
  text: string
}

async function generateSetupInstructions() {
  if (fs.existsSync("flatpak.github.io")) {
    fs.rmSync("flatpak.github.io", { recursive: true })
  }

  const git = simpleGit()

  // Clone flatpak.github.io
  await git.clone("git@github.com:flatpak/flatpak.github.io.git", {
    "--depth": "1",
  })

  // Copy distro.yml file
  fs.copyFileSync("flatpak.github.io/data/distro.yml", distroYamlPath)

  // Read distro.yml file
  const distroYaml = fs.readFileSync(distroYamlPath, "utf8")
  const parsedDistros: Distro[] = parse(distroYaml)

  fs.rmSync(distrosTsPath)

  const translations = {}

  // Iterate over each distro
  for (const distro of parsedDistros) {
    const originalName = distro.name.replaceAll("/", "")
    let name = distro.name
      .replaceAll("/", "")
      .replaceAll(" ", "_")
      .replaceAll("!", "")
    // Uppercase first letter
    name = name.charAt(0).toUpperCase() + name.slice(1)
    const logo = distro.logo
    const slugName = name.toLowerCase()
    const introduction = distro.introduction
    const steps = distro.steps

    translations[slugName] = {
      distroName: distro.name,
    }

    // Create temporary file for distro setup instructions
    const tempFilePath = `src/components/setup/${slugName}.tsx`
    fs.writeFileSync(tempFilePath, "")

    if (steps) {
      // HowToJsonLd
      fs.appendFileSync(tempFilePath, "<HowToJsonLd\n")
      fs.appendFileSync(
        tempFilePath,
        `name={t('distros:${slugName}.distroName')}\n`,
      )
      fs.appendFileSync(
        tempFilePath,
        `image="https://flathub.org/img/distro/${logo}"\n`,
      )
      fs.appendFileSync(
        tempFilePath,
        "estimatedCost={{ currency: 'USD', value: '0' }}\n",
      )
      fs.appendFileSync(tempFilePath, "step={[\n")

      let index = 1
      for (const step of steps) {
        fs.appendFileSync(
          tempFilePath,
          `{url: 'https://flathub.org/setup/${slugName}',
          name: t('distros:${slugName}.step-${index}.name'),
          itemListElement: [{type: 'HowToDirection', text: t('distros:${slugName}.step-${index}.text').replace(/<[^>]*>/g, "").replace(/\s{2,}/g, " ").trim()}]},`,
        )

        index++
      }

      fs.appendFileSync(tempFilePath, "]\n")
      fs.appendFileSync(tempFilePath, "}/>\n\n")
    }

    // Write introduction to temporary file
    if (introduction) {
      fs.appendFileSync(
        tempFilePath,
        `<Trans i18nKey="distros:${slugName}.introduction">\n${introduction}</Trans>\n\n`,
      )
    }

    // Write steps to temporary file
    if (steps) {
      let index = 1
      for (const step of steps) {
        const stepName = step.name
        const stepText = step.text.trim()
        fs.appendFileSync(
          tempFilePath,
          `<li><h2><Trans i18nKey="distros:${slugName}.step-${index}.name">${stepName}</Trans></h2>\n<Trans i18nKey="distros:${slugName}.step-${index}.text">${stepText}</Trans></li>\n\n`,
        )

        index++
      }
    }

    // Convert comment to JSX comment
    const tempFileContent = fs.readFileSync(tempFilePath, "utf8")
    const modifiedContent = tempFileContent
      .replace(/<!--/g, "{/* ")
      .replace(/-->/g, " */}")

    // Replace all \" with "
    const modifiedContent2 = modifiedContent.replace(/\\\"/g, '"')

    // Replace class= with className=
    const modifiedContent3 = modifiedContent2.replace(/class=/g, "className=")

    // Use sed to replace <terminal-command> tags with <CodeCopy text={...} />
    const modifiedContent4 =
      `export const ${name} = () => {const {t} = useTranslation()
      return <><h1>{t("distros:${slugName}.distroName")}</h1><ol className='distrotut'>
      ` + modifiedContent3.replace(/<terminal-command>/g, "<CodeCopy text={`")
    const modifiedContent5 = modifiedContent4.replace(
      /<\/terminal-command>/g,
      "`} />",
    )

    const modifiedContent6 = modifiedContent5 + `</ol></>}\n`

    fs.writeFileSync(tempFilePath, modifiedContent6)

    // Postfix with distroMap.set("Fedora", <Fedora />)
    const distroMapStatement = `distroMap.set("${originalName}", <${name} />);`
    fs.appendFileSync(tempFilePath, distroMapStatement)

    // Concat to shared file and a newline
    fs.appendFileSync(distrosTsPath, fs.readFileSync(tempFilePath, "utf8"))
    fs.appendFileSync(distrosTsPath, "\n\n")

    // Remove temporary file
    fs.unlinkSync(tempFilePath)
  }

  // Prefix with import CodeCopy from "src/components/application/CodeCopy"; and a newline
  const importStatement =
    'import CodeCopy from "src/components/application/CodeCopy";\n'

  // Prefix with import { useTranslation } from "next-i18next";
  const useTranslationStatement =
    'import { Trans, useTranslation } from "next-i18next";\n'

  // Prefix with import { HowToJsonLd } from "next-seo";
  const nextSeoStatement = 'import { HowToJsonLd } from "next-seo";\n'

  // Prefix with export const distroMap = new Map<string, JSX.Element>()
  const distroMapStatement =
    "export const distroMap = new Map<string, JSX.Element>();\n"

  const jsxImportStatement = "import type { JSX } from 'react';\n"

  fs.writeFileSync(
    distrosTsPath,
    distroMapStatement +
      useTranslationStatement +
      nextSeoStatement +
      importStatement +
      jsxImportStatement +
      fs.readFileSync(distrosTsPath, "utf8"),
  )

  // Run prettier on distros.tsx
  const prettierConfig = await prettier.resolveConfig(distrosTsPath)
  const formattedFile = await prettier.format(
    fs.readFileSync(distrosTsPath, "utf8"),
    {
      ...prettierConfig,
      filepath: distrosTsPath,
    },
  )
  fs.writeFileSync(distrosTsPath, formattedFile)

  fs.writeFileSync(
    enTranslationsPath,
    JSON.stringify(translations, null, 2),
    "utf8",
  )

  // Copy images
  fs.cpSync("flatpak.github.io/source/img/distro", "public/img/distro", {
    recursive: true,
  })

  // Remove flatpak.github.io directory
  fs.rmSync("flatpak.github.io", { recursive: true })
}

generateSetupInstructions()
