import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

// Update the version and checksum together when adopting a new dataset.
const sourceUrl =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_admin_0_countries_deu.geojson"
const sourceSha256 =
  "fc4d56c6bc256f779e0ba21579f81d64885f5296dba3c23c3e78a9b89a7aa0fb"
const destination = fileURLToPath(
  new URL("../src/data/countries.topo.json", import.meta.url),
)

const response = await fetch(sourceUrl)
if (!response.ok)
  throw new Error(`Boundary download failed: ${response.status}`)
const source = Buffer.from(await response.arrayBuffer())
const checksum = createHash("sha256").update(source).digest("hex")
if (checksum !== sourceSha256) throw new Error("Boundary checksum mismatch")

const countries = JSON.parse(source.toString())
countries.features = countries.features.flatMap((country) => {
  const countryCode = country.properties.ISO_A2_EH
  if (!/^[A-Z]{2}$/.test(countryCode)) return []
  return [{ ...country, properties: { countryCode } }]
})

const directory = await mkdtemp(join(tmpdir(), "flathub-country-map-"))
try {
  const input = join(directory, "countries.geojson")
  const output = join(directory, "countries.topo.json")
  await writeFile(input, JSON.stringify(countries))
  execFileSync(
    "pnpm",
    [
      "dlx",
      "mapshaper@0.7.74",
      "-i",
      input,
      "-rename-layers",
      "countries",
      "-dissolve",
      "countryCode",
      "-simplify",
      "1.5%",
      "keep-shapes",
      "-o",
      "format=topojson",
      "quantization=100000",
      output,
    ],
    { stdio: "inherit" },
  )
  const topology = JSON.parse(await readFile(output, "utf8"))
  const geometries = topology.objects.countries.geometries
  const codes = geometries.map((country) => country.properties.countryCode)
  if (new Set(codes).size !== 239 || codes.length !== 239) {
    throw new Error(`Unexpected country coverage: ${codes.length}`)
  }
  await writeFile(destination, `${JSON.stringify(topology)}\n`)
  console.log(`Generated ${codes.length} country and territory boundaries`)
} finally {
  await rm(directory, { recursive: true, force: true })
}
