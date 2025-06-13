import { promises as fs } from "node:fs"
import path from "node:path"

async function createInterRegular() {
  const fontPath = path.join(
    process.cwd(),
    "public/assets/fonts/Inter-Regular.ttf",
  )
  const font = await fs.readFile(fontPath)

  return {
    name: "Inter-Regular",
    data: font,
    weight: 400,
    style: "normal",
  }
}

async function createInterSemiBold() {
  const fontPath = path.join(
    process.cwd(),
    "public/assets/fonts/Inter-SemiBold.ttf",
  )
  const font = await fs.readFile(fontPath)

  return {
    name: "Inter-SemiBold",
    data: font,
    weight: 600,
    style: "normal",
  }
}

async function createInterBlack() {
  const fontPath = path.join(
    process.cwd(),
    "public/assets/fonts/Inter-Black.ttf",
  )
  const font = await fs.readFile(fontPath)

  return {
    name: "Inter-Black",
    data: font,
    weight: 900,
    style: "normal",
  }
}

async function createNotoTCRegular() {
  const fontPath = path.join(
    process.cwd(),
    "public/assets/fonts/NotoSansTC-Regular.ttf",
  )
  const font = await fs.readFile(fontPath)

  return {
    name: "NotoSansTC-Regular",
    data: font,
    weight: 400,
    style: "normal",
  }
}

async function createNotoTCSemiBold() {
  const fontPath = path.join(
    process.cwd(),
    "public/assets/fonts/NotoSansTC-SemiBold.ttf",
  )
  const font = await fs.readFile(fontPath)

  return {
    name: "NotoSansTC-SemiBold",
    data: font,
    weight: 600,
    style: "normal",
  }
}

async function createNotoTCBlack() {
  const fontPath = path.join(
    process.cwd(),
    "public/assets/fonts/NotoSansTC-Black.ttf",
  )
  const font = await fs.readFile(fontPath)

  return {
    name: "NotoSansTC-Black",
    data: font,
    weight: 900,
    style: "normal",
  }
}

async function createNotoSCRegular() {
  const fontPath = path.join(
    process.cwd(),
    "public/assets/fonts/NotoSansSC-Regular.ttf",
  )
  const font = await fs.readFile(fontPath)

  return {
    name: "NotoSansSC-Regular",
    data: font,
    weight: 400,
    style: "normal",
  }
}

async function createNotoSCSemiBold() {
  const fontPath = path.join(
    process.cwd(),
    "public/assets/fonts/NotoSansSC-SemiBold.ttf",
  )
  const font = await fs.readFile(fontPath)

  return {
    name: "NotoSansSC-SemiBold",
    data: font,
    weight: 600,
    style: "normal",
  }
}

async function createNotoSCBlack() {
  const fontPath = path.join(
    process.cwd(),
    "public/assets/fonts/NotoSansSC-Black.ttf",
  )
  const font = await fs.readFile(fontPath)

  return {
    name: "NotoSansSC-Black",
    data: font,
    weight: 900,
    style: "normal",
  }
}

async function createNotoKRRegular() {
  const fontPath = path.join(
    process.cwd(),
    "public/assets/fonts/NotoSansKR-Regular.ttf",
  )
  const font = await fs.readFile(fontPath)

  return {
    name: "NotoSansKR-Regular",
    data: font,
    weight: 400,
    style: "normal",
  }
}

async function createNotoKRSemiBold() {
  const fontPath = path.join(
    process.cwd(),
    "public/assets/fonts/NotoSansKR-SemiBold.ttf",
  )
  const font = await fs.readFile(fontPath)

  return {
    name: "NotoSansKR-SemiBold",
    data: font,
    weight: 600,
    style: "normal",
  }
}

async function createNotoKRBlack() {
  const fontPath = path.join(
    process.cwd(),
    "public/assets/fonts/NotoSansKR-Black.ttf",
  )
  const font = await fs.readFile(fontPath)

  return {
    name: "NotoSansKR-Black",
    data: font,
    weight: 900,
    style: "normal",
  }
}

async function createNotoGurmukhiRegular() {
  const fontPath = path.join(
    process.cwd(),
    "public/assets/fonts/NotoSansGurmukhi-Regular.ttf",
  )
  const font = await fs.readFile(fontPath)

  return {
    name: "NotoSansGurmukhi-Regular",
    data: font,
    weight: 400,
    style: "normal",
  }
}

async function createNotoGurmukhiSemiBold() {
  const fontPath = path.join(
    process.cwd(),
    "public/assets/fonts/NotoSansGurmukhi-SemiBold.ttf",
  )
  const font = await fs.readFile(fontPath)

  return {
    name: "NotoSansGurmukhi-SemiBold",
    data: font,
    weight: 600,
    style: "normal",
  }
}

async function createNotoGurmukhiBlack() {
  const fontPath = path.join(
    process.cwd(),
    "public/assets/fonts/NotoSansGurmukhi-Black.ttf",
  )
  const font = await fs.readFile(fontPath)

  return {
    name: "NotoSansGurmukhi-Black",
    data: font,
    weight: 900,
    style: "normal",
  }
}

async function createNotoHebrewRegular() {
  const fontPath = path.join(
    process.cwd(),
    "public/assets/fonts/NotoSansHebrew-Regular.ttf",
  )
  const font = await fs.readFile(fontPath)

  return {
    name: "NotoSansHebrew-Regular",
    data: font,
    weight: 400,
    style: "normal",
  }
}

async function createNotoHebrewSemiBold() {
  const fontPath = path.join(
    process.cwd(),
    "public/assets/fonts/NotoSansHebrew-SemiBold.ttf",
  )
  const font = await fs.readFile(fontPath)

  return {
    name: "NotoSansHebrew-SemiBold",
    data: font,
    weight: 600,
    style: "normal",
  }
}

async function createNotoHebrewBlack() {
  const fontPath = path.join(
    process.cwd(),
    "public/assets/fonts/NotoSansHebrew-Black.ttf",
  )
  const font = await fs.readFile(fontPath)

  return {
    name: "NotoSansHebrew-Black",
    data: font,
    weight: 900,
    style: "normal",
  }
}

async function createNotoRegular() {
  const fontPath = path.join(
    process.cwd(),
    "public/assets/fonts/NotoSans-Regular.ttf",
  )
  const font = await fs.readFile(fontPath)

  return {
    name: "NotoSans-Regular",
    data: font,
    weight: 400,
    style: "normal",
  }
}

async function createNotoSemiBold() {
  const fontPath = path.join(
    process.cwd(),
    "public/assets/fonts/NotoSans-SemiBold.ttf",
  )
  const font = await fs.readFile(fontPath)

  return {
    name: "NotoSans-SemiBold",
    data: font,
    weight: 600,
    style: "normal",
  }
}

async function createNotoBlack() {
  const fontPath = path.join(
    process.cwd(),
    "public/assets/fonts/NotoSans-Black.ttf",
  )
  const font = await fs.readFile(fontPath)

  return {
    name: "NotoSans-Black",
    data: font,
    weight: 900,
    style: "normal",
  }
}

async function createNotoTamilRegular() {
  const fontPath = path.join(
    process.cwd(),
    "public/assets/fonts/NotoSansTamil-Regular.ttf",
  )
  const font = await fs.readFile(fontPath)

  return {
    name: "NotoSansTamil-Regular",
    data: font,
    weight: 400,
    style: "normal",
  }
}

async function createNotoTamilSemiBold() {
  const fontPath = path.join(
    process.cwd(),
    "public/assets/fonts/NotoSansTamil-SemiBold.ttf",
  )
  const font = await fs.readFile(fontPath)

  return {
    name: "NotoSansTamil-SemiBold",
    data: font,
    weight: 600,
    style: "normal",
  }
}

async function createNotoTamilBlack() {
  const fontPath = path.join(
    process.cwd(),
    "public/assets/fonts/NotoSansTamil-Black.ttf",
  )
  const font = await fs.readFile(fontPath)

  return {
    name: "NotoSansTamil-Black",
    data: font,
    weight: 900,
    style: "normal",
  }
}

async function createNotoArabicRegular() {
  const fontPath = path.join(
    process.cwd(),
    "public/assets/fonts/NotoSansArabic-Regular.ttf",
  )
  const font = await fs.readFile(fontPath)

  return {
    name: "NotoSansArabic-Regular",
    data: font,
    weight: 400,
    style: "normal",
  }
}

export const fonts = [
  (await createInterRegular()) as any,
  (await createInterSemiBold()) as any,
  (await createInterBlack()) as any,

  (await createNotoTCRegular()) as any,
  (await createNotoTCSemiBold()) as any,
  (await createNotoTCBlack()) as any,

  (await createNotoTamilRegular()) as any,
  (await createNotoTamilSemiBold()) as any,
  (await createNotoTamilBlack()) as any,

  (await createNotoSCRegular()) as any,
  (await createNotoSCSemiBold()) as any,
  (await createNotoSCBlack()) as any,

  (await createNotoRegular()) as any,
  (await createNotoSemiBold()) as any,
  (await createNotoBlack()) as any,

  (await createNotoHebrewRegular()) as any,
  (await createNotoHebrewSemiBold()) as any,
  (await createNotoHebrewBlack()) as any,

  (await createNotoKRRegular()) as any,
  (await createNotoKRSemiBold()) as any,
  (await createNotoKRBlack()) as any,

  (await createNotoGurmukhiRegular()) as any,
  (await createNotoGurmukhiSemiBold()) as any,
  (await createNotoGurmukhiBlack()) as any,
]
